const detailStatusEl = document.getElementById("detailStatus");
const detailContentEl = document.getElementById("detailContent");
const detailSummaryRowEl = document.getElementById("detailSummaryRow");
const detailControlsEl = document.getElementById("detailControls");
const detailRefreshBtnEl = document.getElementById("detailRefreshBtn");

const API_BASE = String(window.TEXTA_API_BASE || "").trim().replace(/\/$/, "");
let currentDetailItem = null;
let activeDayRange = "30";

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function getToken() {
  return localStorage.getItem("texta_auth_token") || "";
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseJsonResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    const isHtml = /^\s*</.test(text);
    const hint = isHtml ? "服务正在启动或返回了页面，请稍后重试。" : "服务返回了无法解析的数据。";
    throw new Error(hint);
  }
}

async function fetchJson(path, options = {}, retryCount = 1) {
  let lastError = null;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const response = await fetch(apiUrl(path), options);
      const data = await parseJsonResponse(response);
      return { response, data };
    } catch (error) {
      lastError = error;
      if (attempt < retryCount) {
        await sleep(1800);
      }
    }
  }

  throw lastError || new Error("请求失败");
}

function formatDisplayTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "暂无";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return escapeHtml(raw);
  }
  return escapeHtml(
    date.toLocaleString("zh-CN", {
      hour12: false
    })
  );
}

function formatRolePlan(user) {
  const role = String(user?.role || "").toLowerCase();
  const plan = String(user?.plan || "").toLowerCase();
  if (role === "admin") return "管理员";
  if (plan === "vip") return "VIP用户";
  return "普通用户";
}

function getUserIdFromQuery() {
  const params = new URLSearchParams(location.search);
  return String(params.get("userId") || "").trim();
}

function getPeakHour(item) {
  const hours = Array.isArray(item?.hourlyUsage) ? item.hourlyUsage : [];
  const top = hours.reduce(
    (best, hour) => (Number(hour.count || 0) > Number(best.count || 0) ? hour : best),
    { hourLabel: "暂无", count: 0 }
  );
  if (Number(top.count || 0) <= 0) {
    return { label: "暂无", count: 0 };
  }
  return { label: String(top.hourLabel || "暂无"), count: Number(top.count || 0) };
}

function getFilteredDailyUsage(item) {
  const source = Array.isArray(item?.dailyUsage) ? item.dailyUsage : [];
  if (activeDayRange === "7") {
    return source.slice(-7);
  }
  if (activeDayRange === "30") {
    return source.slice(-30);
  }
  return source.slice(-90);
}

async function ensureAdmin() {
  const token = getToken();
  if (!token) {
    location.href = "./index.html";
    return null;
  }

  const { response, data } = await fetchJson("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    localStorage.removeItem("texta_auth_token");
    location.href = "./index.html";
    return null;
  }

  const user = data.user || null;
  if (String(user?.role || "").toLowerCase() !== "admin") {
    location.href = "./app.html";
    return null;
  }
  return user;
}

function renderSummary(item) {
  const peakHour = getPeakHour(item);
  detailSummaryRowEl.innerHTML = `
    <div class="usage-summary-card usage-summary-card-accent">
      <div class="usage-summary-title">用户</div>
      <div class="usage-summary-number usage-summary-name">${escapeHtml(item.name || item.email || "未命名用户")}</div>
      <div class="usage-summary-meta">${escapeHtml(item.email || "")}</div>
    </div>
    <div class="usage-summary-card">
      <div class="usage-summary-title">总使用次数</div>
      <div class="usage-summary-number">${Number(item.totalUsage || 0)}</div>
      <div class="usage-summary-meta">账号累计</div>
    </div>
    <div class="usage-summary-card">
      <div class="usage-summary-title">详细记录次数</div>
      <div class="usage-summary-number">${Number(item.detailedUsageCount || 0)}</div>
      <div class="usage-summary-meta">用于图表统计</div>
    </div>
    <div class="usage-summary-card">
      <div class="usage-summary-title">高峰小时</div>
      <div class="usage-summary-number">${escapeHtml(peakHour.label)}</div>
      <div class="usage-summary-meta">共 ${peakHour.count} 次</div>
    </div>
  `;
}

function renderControls() {
  detailControlsEl.innerHTML = `
    <div class="usage-range-card">
      <div class="usage-range-title">按天趋势范围</div>
      <div class="usage-range-switch">
        <button type="button" class="usage-range-btn${activeDayRange === "7" ? " active" : ""}" data-range="7">近7天</button>
        <button type="button" class="usage-range-btn${activeDayRange === "30" ? " active" : ""}" data-range="30">近30天</button>
        <button type="button" class="usage-range-btn${activeDayRange === "90" ? " active" : ""}" data-range="90">近90天</button>
      </div>
    </div>
  `;

  detailControlsEl.querySelectorAll("[data-range]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextRange = String(btn.getAttribute("data-range") || "30");
      if (nextRange === activeDayRange) return;
      activeDayRange = nextRange;
      if (currentDetailItem) {
        renderControls();
        renderDetail(currentDetailItem);
      }
    });
  });
}

function renderDailyColumns(items) {
  const maxValue = Math.max(...items.map((item) => Number(item.count || 0)), 1);
  return `
    <div class="usage-column-chart">
      ${items
        .map((item) => {
          const count = Number(item.count || 0);
          const height = Math.max((count / maxValue) * 100, count > 0 ? 6 : 0);
          const shortLabel = String(item.dateKey || "").slice(5);
          return `
            <div class="usage-column-item">
              <div class="usage-column-top">${count}</div>
              <div class="usage-column-track">
                <div class="usage-column-fill" style="height:${height}%;"></div>
              </div>
              <div class="usage-column-label">${escapeHtml(shortLabel)}</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function getHeatLevel(value, maxValue) {
  if (maxValue <= 0 || value <= 0) return "0";
  const ratio = value / maxValue;
  if (ratio >= 0.8) return "5";
  if (ratio >= 0.6) return "4";
  if (ratio >= 0.4) return "3";
  if (ratio >= 0.2) return "2";
  return "1";
}

function renderHourHeatmap(items) {
  const maxValue = Math.max(...items.map((item) => Number(item.count || 0)), 0);
  return `
    <div class="usage-heatmap-grid">
      ${items
        .map((item) => {
          const count = Number(item.count || 0);
          const level = getHeatLevel(count, maxValue);
          return `
            <div class="usage-heatmap-cell" data-level="${level}">
              <div class="usage-heatmap-hour">${escapeHtml(item.hourLabel || "")}</div>
              <div class="usage-heatmap-count">${count}</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderPeriodCards(items) {
  return items
    .map(
      (period) => `
        <div class="usage-period-item">
          <div>
            <div>${escapeHtml(period.periodLabel || "未知时段")}</div>
            <div class="fav-meta">最近一次：${formatDisplayTime(period.latestUsedAt)}</div>
          </div>
          <div class="usage-period-count">${Number(period.count || 0)} 次</div>
        </div>
      `
    )
    .join("");
}

function renderDetail(item) {
  const dailyUsage = getFilteredDailyUsage(item);
  const hourlyUsage = Array.isArray(item.hourlyUsage) ? item.hourlyUsage : [];
  const recentPeriods = Array.isArray(item.recentPeriods) ? item.recentPeriods.slice(0, 20) : [];
  const legacyNote =
    Number(item.legacyUsageCount || 0) > 0
      ? `<div class="usage-mini-note">另有 ${Number(item.legacyUsageCount || 0)} 次历史使用仅保留按天累计，因此小时热度图只统计新功能上线后的详细日志。</div>`
      : "";

  detailContentEl.innerHTML = `
    <div class="usage-detail-panel usage-detail-hero">
      <div class="usage-detail-title">用户信息</div>
      <div class="usage-hero-grid">
        <div class="usage-hero-card">
          <div class="usage-hero-label">身份</div>
          <div class="usage-hero-value">${escapeHtml(formatRolePlan(item))}</div>
        </div>
        <div class="usage-hero-card">
          <div class="usage-hero-label">注册时间</div>
          <div class="usage-hero-value usage-hero-small">${formatDisplayTime(item.createdAt)}</div>
        </div>
        <div class="usage-hero-card">
          <div class="usage-hero-label">最近使用</div>
          <div class="usage-hero-value usage-hero-small">${formatDisplayTime(item.latestUsedAt)}</div>
        </div>
      </div>
    </div>

    <div class="usage-detail-panel">
      <div class="usage-detail-head">
        <div class="usage-detail-title">按天使用趋势</div>
        <div class="usage-detail-tag">当前范围：近${activeDayRange}天</div>
      </div>
      <div class="usage-chart">
        ${
          dailyUsage.length > 0
            ? renderDailyColumns(dailyUsage)
            : '<div class="usage-empty">暂无按天使用记录</div>'
        }
      </div>
      <div class="usage-mini-note">柱子越高，代表当天使用次数越多。</div>
    </div>

    <div class="usage-detail-panel">
      <div class="usage-detail-head">
        <div class="usage-detail-title">按小时使用热度</div>
        <div class="usage-detail-tag">24小时分布</div>
      </div>
      <div class="usage-chart">
        ${
          hourlyUsage.some((hour) => Number(hour.count || 0) > 0)
            ? renderHourHeatmap(hourlyUsage)
            : '<div class="usage-empty">暂无详细小时记录</div>'
        }
      </div>
      ${legacyNote}
    </div>

    <div class="usage-detail-panel">
      <div class="usage-detail-head">
        <div class="usage-detail-title">最近使用时段</div>
        <div class="usage-detail-tag">最近20条聚合时段</div>
      </div>
      <div class="usage-period-list">
        ${
          recentPeriods.length > 0
            ? renderPeriodCards(recentPeriods)
            : '<div class="usage-empty">暂无详细时段记录</div>'
        }
      </div>
    </div>
  `;
}

async function loadDetail() {
  const userId = getUserIdFromQuery();
  if (!userId) {
    detailStatusEl.textContent = "缺少用户参数。";
    detailSummaryRowEl.innerHTML = "";
    detailControlsEl.innerHTML = "";
    detailContentEl.innerHTML = '<div class="usage-empty">请从用户列表进入详情页。</div>';
    return;
  }

  detailStatusEl.textContent = "正在加载用户详情...";
  const { response, data } = await fetchJson(`/api/admin/usage-users/${encodeURIComponent(userId)}/detail`, {
    headers: { Authorization: `Bearer ${getToken()}` }
  });

  if (!response.ok) {
    throw new Error(data.error || "加载失败");
  }

  const item = data.item || null;
  if (!item) {
    detailSummaryRowEl.innerHTML = "";
    detailControlsEl.innerHTML = "";
    detailContentEl.innerHTML = '<div class="usage-empty">没有找到该用户。</div>';
    detailStatusEl.textContent = "没有找到对应的用户数据。";
    return;
  }

  currentDetailItem = item;
  renderSummary(item);
  renderControls();
  renderDetail(item);
  detailStatusEl.textContent = `已加载 ${item.name || item.email || "该用户"} 的使用详情。`;
}

detailRefreshBtnEl.addEventListener("click", async () => {
  try {
    await loadDetail();
  } catch (error) {
    detailStatusEl.textContent = `刷新失败：${error.message}`;
  }
});

ensureAdmin()
  .then(async (user) => {
    if (!user) return;
    await loadDetail();
  })
  .catch((error) => {
    detailStatusEl.textContent = `初始化失败：${error.message}`;
  });
