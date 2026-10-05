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
  if (["plus","vip"].includes(plan)) return user.permanentPlan === "plus" ? "永久 Plus" : "Plus 用户";
  if (plan === "pro") return user.permanentPlan === "pro" ? "永久 Pro" : "Pro 用户";
  return "普通用户";
}

function getRoleKey(user) {
  const role = String(user?.role || "").toLowerCase();
  const plan = String(user?.plan || "").toLowerCase();
  if (role === "admin") return "admin";
  if (["plus","vip"].includes(plan)) return "plus";
  if (plan === "pro") return "pro";
  return "user";
}

function isAdminUser(user) {
  return String(user?.role || "").toLowerCase() === "admin";
}

function renderPlanAction(user) {
  if (isAdminUser(user)) return '';
  const options={free:'Free',plus_monthly:'Plus 一个月',pro_monthly:'Pro 一个月',plus_lifetime:'永久 Plus',pro_lifetime:'永久 Pro'};
  return '<select aria-label="设置账户套餐" data-plan-select="'+escapeHtml(user.id)+'" '+(pendingPlanUserId===user.id?'disabled':'')+'><option value="">设置套餐…</option>'+Object.entries(options).map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('')+'</select>';
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

async function changeUserPlan(userId, targetPlan, term) {
  const { response, data } = await fetchJson(
    `/api/admin/users/${encodeURIComponent(userId)}/plan`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ plan: targetPlan, term })
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
  refreshUsageBtnEl.disabled = true;
  refreshUsageBtnEl.setAttribute("aria-busy", "true");
  try {
    await loadUsageOverview();
  } catch (error) {
    usageStatusEl.textContent = `Refresh failed: ${error.message}`;
  } finally {
    refreshUsageBtnEl.disabled = false;
    refreshUsageBtnEl.removeAttribute("aria-busy");
  }
});

usageUserListEl.addEventListener('change',async event=>{
  const select=event.target.closest('[data-plan-select]'); if(!select || !select.value)return;
  const userId=select.dataset.planSelect, [targetPlan,term]=select.value.split('_');
  const name=allUsers.find(user=>user.id===userId)?.name || userId;
  if(!confirm('将 '+name+' 的套餐设置为 '+select.selectedOptions[0].textContent+'？')) {select.value='';return;}
  try {
    pendingPlanUserId=userId;filterUsers();await changeUserPlan(userId,targetPlan,term);
    usageStatusEl.textContent='套餐已更新。';
  } catch(error) {usageStatusEl.textContent='更新失败：'+error.message;}
  finally {pendingPlanUserId='';filterUsers();}
});

ensureAdmin()
  .then(async (user) => {
    if (!user) return;
    await loadUsageOverview();
  })
  .catch((error) => {
    usageStatusEl.textContent = `初始化失败：${error.message}`;
  });
