const usageStatusEl = document.getElementById("usageStatus");
const usageUserListEl = document.getElementById("usageUserList");
const usageSummaryRowEl = document.getElementById("usageSummaryRow");
const refreshUsageBtnEl = document.getElementById("refreshUsageBtn");
const usageSearchInputEl = document.getElementById("usageSearchInput");
const usageRoleFilterEl = document.getElementById("usageRoleFilter");
const usageSortSelectEl = document.getElementById("usageSortSelect");

const API_BASE = String(window.TEXTA_API_BASE || "").trim().replace(/\/$/, "");
let allUsers = [];
let pendingPlanUserId = "";

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
  if (plan === "vip") return "VIP 用户";
  return "普通用户";
}

function getRoleKey(user) {
  const role = String(user?.role || "").toLowerCase();
  const plan = String(user?.plan || "").toLowerCase();
  if (role === "admin") return "admin";
  if (plan === "vip") return "vip";
  return "user";
}

function isAdminUser(user) {
  return String(user?.role || "").toLowerCase() === "admin";
}

function getPlanActionLabel(user) {
  const plan = String(user?.plan || "free").toLowerCase();
  return plan === "vip" ? "Set to User" : "Set to VIP";
}

function getPlanActionTarget(user) {
  const plan = String(user?.plan || "free").toLowerCase();
  return plan === "vip" ? "free" : "vip";
}

function renderPlanAction(user) {
  if (isAdminUser(user)) return "";
  const userId = String(user?.id || "");
  const isBusy = pendingPlanUserId === userId;
  return `
    <button
      type="button"
      class="usage-plan-btn"
      data-plan-toggle="1"
      data-user-id="${escapeHtml(userId)}"
      data-target-plan="${getPlanActionTarget(user)}"
      ${isBusy ? "disabled" : ""}
    >
      ${isBusy ? "Processing..." : getPlanActionLabel(user)}
    </button>
  `;
}

function toTimeValue(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  const time = new Date(text).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortUsers(items) {
  const mode = String(usageSortSelectEl?.value || "totalUsage");
  const sorted = [...items];

  sorted.sort((a, b) => {
    if (mode === "latestUsedAt") {
      const diff = toTimeValue(b.latestUsedAt) - toTimeValue(a.latestUsedAt);
      if (diff !== 0) return diff;
    } else if (mode === "createdAt") {
      const diff = toTimeValue(b.createdAt) - toTimeValue(a.createdAt);
      if (diff !== 0) return diff;
    } else {
      const diff = Number(b.totalUsage || 0) - Number(a.totalUsage || 0);
      if (diff !== 0) return diff;
    }

    const usageDiff = Number(b.totalUsage || 0) - Number(a.totalUsage || 0);
    if (usageDiff !== 0) return usageDiff;
    return toTimeValue(b.createdAt) - toTimeValue(a.createdAt);
  });

  return sorted;
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
  const displayName = escapeHtml(user.name || user.email || "Unnamed user");
  const email = escapeHtml(user.email || "");
  const rolePlan = escapeHtml(formatRolePlan(user));
  const createdAt = formatDisplayTime(user.createdAt);

  return `
    <div class="admin-item usage-item">
      <div class="usage-user-head">
        <div><strong>${displayName}</strong></div>
        <div class="fav-meta">${email}</div>
        <div class="fav-meta usage-meta-line">Role: ${rolePlan} | Created: ${createdAt}</div>
      </div>
      <div class="usage-right">
        <div class="usage-count-box">
          <div class="usage-count-label">Usage Total</div>
          <div class="usage-count-number">${Number(user.totalUsage || 0)}</div>
        </div>
        ${renderPlanAction(user)}
        <a class="upgrade-link usage-detail-btn" href="./admin-usage-detail.html?userId=${encodeURIComponent(user.id)}">Details</a>
      </div>
    </div>
  `;
}

function mergeUpdatedUser(updatedUser) {
  if (!updatedUser || !updatedUser.id) return;
  const idx = allUsers.findIndex((item) => item.id === updatedUser.id);
  if (idx === -1) return;
  allUsers[idx] = { ...allUsers[idx], ...updatedUser };
}

async function changeUserPlan(userId, targetPlan) {
  const { response, data } = await fetchJson(
    `/api/admin/users/${encodeURIComponent(userId)}/plan`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ plan: targetPlan })
    },
    0
  );

  if (!response.ok) {
    throw new Error(data.error || "Failed to update plan");
  }

  if (data?.user) {
    mergeUpdatedUser(data.user);
  }
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
  const sortedItems = sortUsers(items);

  renderSummary(sortedItems);

  if (sortedItems.length === 0) {
    usageUserListEl.innerHTML = '<div class="usage-empty">没有匹配到用户</div>';
    usageStatusEl.textContent = "请调整搜索关键词或筛选条件。";
    return;
  }

  usageUserListEl.innerHTML = sortedItems.map(renderUserCard).join("");
  usageStatusEl.textContent = `共找到 ${sortedItems.length} 位用户。`;
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
usageSortSelectEl?.addEventListener("change", filterUsers);

refreshUsageBtnEl.addEventListener("click", async () => {
  try {
    await loadUsageOverview();
  } catch (error) {
    usageStatusEl.textContent = `Refresh failed: ${error.message}`;
  }
});

usageUserListEl.addEventListener("click", async (event) => {
  const target = event.target;
  const button = target instanceof Element ? target.closest("[data-plan-toggle='1']") : null;
  if (!button) return;

  const userId = String(button.getAttribute("data-user-id") || "").trim();
  const targetPlan = String(button.getAttribute("data-target-plan") || "").trim().toLowerCase();
  if (!userId || !["free", "vip"].includes(targetPlan)) return;

  try {
    pendingPlanUserId = userId;
    filterUsers();
    usageStatusEl.textContent = targetPlan === "vip" ? "Upgrading to VIP..." : "Switching to normal user...";
    await changeUserPlan(userId, targetPlan);
    pendingPlanUserId = "";
    filterUsers();
    usageStatusEl.textContent = targetPlan === "vip" ? "Updated: now VIP" : "Updated: now normal user";
  } catch (error) {
    pendingPlanUserId = "";
    filterUsers();
    usageStatusEl.textContent = `Update failed: ${error.message}`;
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
