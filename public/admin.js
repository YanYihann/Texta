const adminStatusEl = document.getElementById("adminStatus");
const requestListEl = document.getElementById("requestList");
const refreshBtnEl = document.getElementById("refreshBtn");

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
        continue;
      }
    }
  }

  throw lastError || new Error("请求失败");
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

async function reviewRequest(id, action) {
  const token = getToken();
  const note =
    action === "reject" ? window.prompt("请输入驳回原因：", "凭证不清晰，请重新提交") || "" : "";
  const { response, data } = await fetchJson(`/api/admin/vip-requests/${id}/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ note })
  });

  if (!response.ok) {
    throw new Error(data.error || "操作失败");
  }
}

function bindActions() {
  requestListEl.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      if (!id || !action) return;

      btn.disabled = true;
      try {
        await reviewRequest(id, action);
        adminStatusEl.textContent = action === "approve" ? "已通过申请。" : "已驳回申请。";
        await loadRequests();
      } catch (error) {
        adminStatusEl.textContent = `操作失败：${error.message}`;
      } finally {
        btn.disabled = false;
      }
    });
  });
}

async function loadRequests() {
  const token = getToken();
  adminStatusEl.textContent = "正在加载待审核申请...";

  const { response, data } = await fetchJson("/api/admin/vip-requests?status=pending", {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(data.error || "加载失败");
  }

  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length === 0) {
    requestListEl.innerHTML = '<div class="fav-meta">暂无待审核申请</div>';
    adminStatusEl.textContent = "当前没有待审核申请。";
    return;
  }

  requestListEl.innerHTML = items
    .map(
      (item) => `
        <div class="admin-item">
          <div><strong>${escapeHtml(item.userEmail)}</strong>，${escapeHtml(item.payerName || "未填写付款人")}</div>
          <div class="fav-meta">金额：${escapeHtml(item.amount)} 元 | 提交时间：${escapeHtml(item.createdAt)}</div>
          <div class="fav-meta">凭证号：${escapeHtml(item.proofCode || "(未填写)")}</div>
          <div class="fav-meta">凭证图：${item.proofImageUrl ? `<a href="${escapeHtml(item.proofImageUrl)}" target="_blank" rel="noreferrer">查看</a>` : "(未填写)"}</div>
          <div class="fav-meta">备注：${escapeHtml(item.note || "(无)")}</div>
          <div class="actions" style="margin-top: 8px;">
            <button data-id="${escapeHtml(item.id)}" data-action="approve" type="button">通过</button>
            <button data-id="${escapeHtml(item.id)}" data-action="reject" type="button">驳回</button>
          </div>
        </div>
      `
    )
    .join("");

  adminStatusEl.textContent = `待审核申请：${items.length} 条`;
  bindActions();
}

refreshBtnEl.addEventListener("click", async () => {
  try {
    await loadRequests();
  } catch (error) {
    adminStatusEl.textContent = `刷新失败：${error.message}`;
  }
});

ensureAdmin()
  .then(async (user) => {
    if (!user) return;
    await loadRequests();
  })
  .catch((error) => {
    adminStatusEl.textContent = `初始化失败：${error.message}`;
  });
