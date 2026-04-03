const usageStatusEl = document.getElementById("usageStatus");
const usageUserListEl = document.getElementById("usageUserList");
const refreshUsageBtnEl = document.getElementById("refreshUsageBtn");

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

async function ensureAdmin() {
  const token = getToken();
  if (!token) {
    location.href = "./index.html";
    return null;
  }

  const response = await fetch(apiUrl("/api/auth/me"), {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    localStorage.removeItem("texta_auth_token");
    location.href = "./index.html";
    return null;
  }

  const data = await response.json();
  const user = data.user || null;
  if (String(user?.role || "").toLowerCase() !== "admin") {
    location.href = "./app.html";
    return null;
  }
  return user;
}

function renderUserCard(user) {
  const periods = Array.isArray(user.periods) ? user.periods : [];
  const periodsHtml =
    periods.length > 0
      ? periods
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
      : '<div class="usage-empty">暂无详细时段记录</div>';

  const legacyText =
    Number(user.legacyUsageCount || 0) > 0
      ? `<div class="fav-meta">另有 ${Number(user.legacyUsageCount || 0)} 次历史使用仅保留按天累计，详细时段为新功能上线后开始记录。</div>`
      : "";

  return `
    <div class="admin-item usage-item">
      <div class="usage-user-head">
        <div>
          <div><strong>${escapeHtml(user.name || user.email || "未命名用户")}</strong></div>
          <div class="fav-meta">${escapeHtml(user.email || "")}</div>
          <div class="fav-meta">身份：${escapeHtml(formatRolePlan(user))} | 注册时间：${formatDisplayTime(user.createdAt)}</div>
        </div>
        <div class="usage-badge">总使用 ${Number(user.totalUsage || 0)} 次</div>
      </div>

      <div class="usage-stats">
        <div class="usage-stat">
          <div class="usage-stat-label">总次数</div>
          <div class="usage-stat-value">${Number(user.totalUsage || 0)}</div>
        </div>
        <div class="usage-stat">
          <div class="usage-stat-label">详细时段次数</div>
          <div class="usage-stat-value">${Number(user.detailedUsageCount || 0)}</div>
        </div>
        <div class="usage-stat">
          <div class="usage-stat-label">最近使用</div>
          <div class="usage-stat-value" style="font-size: 14px;">${formatDisplayTime(user.latestUsedAt)}</div>
        </div>
      </div>

      <div class="usage-periods">${periodsHtml}</div>
      ${legacyText}
    </div>
  `;
}

async function loadUsageOverview() {
  usageStatusEl.textContent = "正在加载所有用户使用记录...";
  const response = await fetch(apiUrl("/api/admin/usage-overview"), {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "加载失败");
  }

  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length === 0) {
    usageUserListEl.innerHTML = '<div class="usage-empty">暂无用户数据</div>';
    usageStatusEl.textContent = "当前没有可展示的用户数据。";
    return;
  }

  usageUserListEl.innerHTML = items.map(renderUserCard).join("");
  usageStatusEl.textContent = `共 ${items.length} 位用户，已按历史总使用次数排序。`;
}

refreshUsageBtnEl.addEventListener("click", async () => {
  try {
    await loadUsageOverview();
  } catch (error) {
    usageStatusEl.textContent = `刷新失败：${error.message}`;
  }
});

ensureAdmin()
  .then(async (user) => {
    if (!user) return;
    await loadUsageOverview();
  })
  .catch((error) => {
    usageStatusEl.textContent = `初始化失败：${error.message}`;
  });
