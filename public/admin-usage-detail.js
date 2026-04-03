const detailStatusEl = document.getElementById("detailStatus");
const detailContentEl = document.getElementById("detailContent");
const detailSummaryRowEl = document.getElementById("detailSummaryRow");
const detailRefreshBtnEl = document.getElementById("detailRefreshBtn");

const API_BASE = String(window.TEXTA_API_BASE || "").trim().replace(/\/$/, "");

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
  detailSummaryRowEl.innerHTML = `
    <div class="usage-summary-card">
      <div class="usage-summary-title">用户</div>
      <div class="usage-summary-number" style="font-size: 20px;">${escapeHtml(item.name || item.email || "未命名用户")}</div>
    </div>
    <div class="usage-summary-card">
      <div class="usage-summary-title">总使用次数</div>
      <div class="usage-summary-number">${Number(item.totalUsage || 0)}</div>
    </div>
    <div class="usage-summary-card">
      <div class="usage-summary-title">详细记录次数</div>
      <div class="usage-summary-number">${Number(item.detailedUsageCount || 0)}</div>
    </div>
  `;
}

function renderBars(items, labelKey, valueKey) {
  const maxValue = Math.max(...items.map((item) => Number(item[valueKey] || 0)), 1);
  return items
    .map((item) => {
      const value = Number(item[valueKey] || 0);
      const width = Math.max((value / maxValue) * 100, value > 0 ? 4 : 0);
      return `
        <div class="usage-bar-row">
          <div class="usage-bar-label">${escapeHtml(item[labelKey] || "")}</div>
          <div class="usage-bar-track">
            <div class="usage-bar-fill" style="width:${width}%;"></div>
          </div>
          <div class="usage-bar-value">${value}</div>
        </div>
      `;
    })
    .join("");
}

function renderDetail(item) {
  const dailyUsage = Array.isArray(item.dailyUsage) ? item.dailyUsage.slice(-20) : [];
  const hourlyUsage = Array.isArray(item.hourlyUsage) ? item.hourlyUsage : [];
  const recentPeriods = Array.isArray(item.recentPeriods) ? item.recentPeriods.slice(0, 20) : [];
  const legacyNote =
    Number(item.legacyUsageCount || 0) > 0
      ? `<div class="usage-mini-note">另有 ${Number(item.legacyUsageCount || 0)} 次历史使用仅保留按天累计，因此小时分布图只统计新功能上线后的详细日志。</div>`
      : "";

  detailContentEl.innerHTML = `
    <div class="usage-detail-panel">
      <div class="usage-detail-title">用户信息</div>
      <div class="usage-chart">
        <div><strong>${escapeHtml(item.name || item.email || "未命名用户")}</strong></div>
        <div class="fav-meta">${escapeHtml(item.email || "")}</div>
        <div class="fav-meta">身份：${escapeHtml(formatRolePlan(item))}</div>
        <div class="fav-meta">注册时间：${formatDisplayTime(item.createdAt)}</div>
        <div class="fav-meta">最近使用：${formatDisplayTime(item.latestUsedAt)}</div>
      </div>
    </div>

    <div class="usage-detail-panel">
      <div class="usage-detail-title">按天使用趋势</div>
      <div class="usage-chart">
        ${dailyUsage.length > 0 ? renderBars(dailyUsage, "dateKey", "count") : '<div class="usage-empty">暂无按天使用记录</div>'}
      </div>
      <div class="usage-mini-note">默认展示最近 20 天的使用次数。</div>
    </div>

    <div class="usage-detail-panel">
      <div class="usage-detail-title">按小时使用分布</div>
      <div class="usage-chart">
        ${hourlyUsage.some((item) => Number(item.count || 0) > 0) ? renderBars(hourlyUsage, "hourLabel", "count") : '<div class="usage-empty">暂无详细小时记录</div>'}
      </div>
      ${legacyNote}
    </div>

    <div class="usage-detail-panel">
      <div class="usage-detail-title">最近使用时段</div>
      <div class="usage-period-list">
        ${
          recentPeriods.length > 0
            ? recentPeriods
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
                .join("")
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
    detailContentEl.innerHTML = '<div class="usage-empty">没有找到该用户。</div>';
    detailStatusEl.textContent = "没有找到对应的用户数据。";
    return;
  }

  renderSummary(item);
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
