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

function getUserIdFromQuery() {
  const params = new URLSearchParams(location.search);
  return String(params.get("userId") || "").trim();
}

function getFilteredDailyUsage(item) {
  const source = Array.isArray(item?.dailyUsage) ? item.dailyUsage : [];
  return source.slice(-30);
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
    <div class="usage-simple-card">
      <div class="usage-simple-label">用户名</div>
      <div class="usage-simple-name">${escapeHtml(item.name || item.email || "未命名用户")}</div>
    </div>
    <div class="usage-simple-card usage-simple-card-accent">
      <div class="usage-simple-label">总使用次数</div>
      <div class="usage-simple-count">${Number(item.totalUsage || 0)}</div>
    </div>
  `;
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

function renderDetail(item) {
  const dailyUsage = getFilteredDailyUsage(item);
  const hourlyUsage = Array.isArray(item.hourlyUsage) ? item.hourlyUsage : [];

  detailContentEl.innerHTML = `
    <div class="usage-detail-panel">
      <div class="usage-detail-title">按天使用趋势</div>
      <div class="usage-chart">
        ${
          dailyUsage.length > 0
            ? renderDailyColumns(dailyUsage)
            : '<div class="usage-empty">暂无按天使用记录</div>'
        }
      </div>
    </div>

    <div class="usage-detail-panel">
      <div class="usage-detail-title">按小时使用热度</div>
      <div class="usage-chart">
        ${
          hourlyUsage.some((hour) => Number(hour.count || 0) > 0)
            ? renderHourHeatmap(hourlyUsage)
            : '<div class="usage-empty">暂无详细小时记录</div>'
        }
      </div>
    </div>
  `;
}

async function loadDetail() {
  const userId = getUserIdFromQuery();
  if (!userId) {
    detailSummaryRowEl.innerHTML = "";
    detailContentEl.innerHTML = '<div class="usage-empty">请从用户列表进入详情页。</div>';
    return;
  }

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
    return;
  }

  renderSummary(item);
  renderDetail(item);
}

detailRefreshBtnEl.addEventListener("click", async () => {
  await loadDetail();
});

ensureAdmin().then(async (user) => {
  if (!user) return;
  await loadDetail();
});
