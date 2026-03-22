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

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function reviewRequest(id, action) {
  const token = getToken();
  const note = action === "reject" ? window.prompt("请输入驳回原因：", "凭证不清晰，请重新提交") || "" : "";
  const response = await fetch(apiUrl(`/api/admin/vip-requests/${id}/${action}`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ note })
  });
  const data = await response.json();
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
  const response = await fetch(apiUrl("/api/admin/vip-requests?status=pending"), {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
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
      (x) => `
      <div class="admin-item">
        <div><strong>${escapeHtml(x.userEmail)}</strong>（${escapeHtml(x.payerName || "")}）</div>
        <div class="fav-meta">金额: ${escapeHtml(x.amount)} 元 | 提交时间: ${escapeHtml(x.createdAt)}</div>
        <div class="fav-meta">凭证号: ${escapeHtml(x.proofCode || "(未填)")}</div>
        <div class="fav-meta">凭证图: ${x.proofImageUrl ? `<a href="${escapeHtml(x.proofImageUrl)}" target="_blank">查看</a>` : "(未填)"}</div>
        <div class="fav-meta">备注: ${escapeHtml(x.note || "(无)")}</div>
        <div class="actions" style="margin-top:8px;">
          <button data-id="${escapeHtml(x.id)}" data-action="approve" type="button">通过</button>
          <button data-id="${escapeHtml(x.id)}" data-action="reject" type="button">驳回</button>
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
