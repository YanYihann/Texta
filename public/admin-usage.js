const usageStatusEl = document.getElementById("usageStatus");
const usageUserListEl = document.getElementById("usageUserList");
const usageSummaryRowEl = document.getElementById("usageSummaryRow");
const refreshUsageBtnEl = document.getElementById("refreshUsageBtn");
const usageSearchInputEl = document.getElementById("usageSearchInput");
const usageRoleFilterEl = document.getElementById("usageRoleFilter");

const API_BASE = String(window.TEXTA_API_BASE || "").trim().replace(/\/$/, "");
let allUsers = [];

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

function getRoleKey(user) {
  const role = String(user?.role || "").toLowerCase();
  const plan = String(user?.plan || "").toLowerCase();
  if (role === "admin") return "admin";
  if (plan === "vip") return "vip";
  return "user";
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

function renderSummary(items) {
  const totalUsage = items.reduce((sum, item) => sum + Number(item.totalUsage || 0), 0);
  usageSummaryRowEl.innerHTML = `
    <div class="usage-summary-card">
      <div class="usage-summary-title">当前显示用户</div>
      <div class="usage-summary-number">${items.length}</div>
    </div>
    <div class="usage-summary-card">
      <div class="usage-summary-title">全部用户</div>
      <div class="usage-summary-number">${allUsers.length}</div>
    </div>
    <div class="usage-summary-card">
      <div class="usage-summary-title">当前显示总使用次数</div>
      <div class="usage-summary-number">${totalUsage}</div>
    </div>
  `;
}

function renderUserCard(user) {
  return `
    <div class="admin-item usage-item">
      <div class="usage-user-head">
        <div><strong>${escapeHtml(user.name || user.email || "未命名用户")}</strong></div>
        <div class="fav-meta">${escapeHtml(user.email || "")}</div>
        <div class="fav-meta usage-meta-line">身份：${escapeHtml(formatRolePlan(user))} | 注册时间：${formatDisplayTime(user.createdAt)}</div>
      </div>
      <div class="usage-right">
        <div class="usage-count-box">
          <div class="usage-count-label">一共使用</div>
          <div class="usage-count-number">${Number(user.totalUsage || 0)}</div>
        </div>
        <a class="upgrade-link usage-detail-btn" href="./admin-usage-detail.html?userId=${encodeURIComponent(user.id)}">查看详情</a>
      </div>
    </div>
  `;
}

function filterUsers() {
  const keyword = String(usageSearchInputEl.value || "").trim().toLowerCase();
  const roleFilter = String(usageRoleFilterEl.value || "all").trim().toLowerCase();

  const items = allUsers.filter((user) => {
    const text = `${user.name || ""} ${user.email || ""}`.toLowerCase();
    const searchOk = !keyword || text.includes(keyword);
    const roleOk = roleFilter === "all" || getRoleKey(user) === roleFilter;
    return searchOk && roleOk;
  });

  renderSummary(items);

  if (items.length === 0) {
    usageUserListEl.innerHTML = '<div class="usage-empty">没有匹配到用户</div>';
    usageStatusEl.textContent = "请调整搜索关键词或筛选条件。";
    return;
  }

  usageUserListEl.innerHTML = items.map(renderUserCard).join("");
  usageStatusEl.textContent = `共找到 ${items.length} 位用户。`;
}

async function loadUsageOverview() {
  usageStatusEl.textContent = "正在加载所有用户使用记录...";

  const { response, data } = await fetchJson("/api/admin/usage-overview", {
    headers: { Authorization: `Bearer ${getToken()}` }
  });

  if (!response.ok) {
    throw new Error(data.error || "加载失败");
  }

  allUsers = Array.isArray(data.items) ? data.items : [];
  if (allUsers.length === 0) {
    usageSummaryRowEl.innerHTML = "";
    usageUserListEl.innerHTML = '<div class="usage-empty">暂无用户数据</div>';
    usageStatusEl.textContent = "当前没有可展示的用户数据。";
    return;
  }

  filterUsers();
}

usageSearchInputEl.addEventListener("input", filterUsers);
usageRoleFilterEl.addEventListener("change", filterUsers);

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
