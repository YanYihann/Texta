const submitVipRequestBtnEl = document.getElementById("submitVipRequestBtn");
const payMsgEl = document.getElementById("payMsg");
const payerNameEl = document.getElementById("payerName");
const proofCodeEl = document.getElementById("proofCode");
const proofImageUrlEl = document.getElementById("proofImageUrl");
const proofNoteEl = document.getElementById("proofNote");

const API_BASE = String(window.TEXTA_API_BASE || "").trim().replace(/\/$/, "");

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function getToken() {
  return localStorage.getItem("texta_auth_token") || "";
}

async function ensureLoggedIn() {
  const token = getToken();
  if (!token) {
    location.href = "./index.html";
    return null;
  }

  try {
    const response = await fetch(apiUrl("/api/auth/me"), {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      localStorage.removeItem("texta_auth_token");
      location.href = "./index.html";
      return null;
    }
    const data = await response.json();
    return data.user || null;
  } catch {
    payMsgEl.textContent = "网络异常，请稍后重试。";
    return null;
  }
}

async function loadMyRequests() {
  const token = getToken();
  if (!token) return;
  try {
    const response = await fetch(apiUrl("/api/upgrade/request/me"), {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return;
    const data = await response.json();
    const latest = Array.isArray(data.items) ? data.items[0] : null;
    if (!latest) return;
    if (latest.status === "pending") {
      payMsgEl.textContent = "你已有待审核申请，请耐心等待管理员处理。";
    } else if (latest.status === "approved") {
      payMsgEl.textContent = "你的VIP申请已通过，可返回主页面查看。";
    } else if (latest.status === "rejected") {
      payMsgEl.textContent = `上次申请未通过：${latest.reviewNote || "请重新提交清晰凭证"}`;
    }
  } catch {
    // Ignore.
  }
}

submitVipRequestBtnEl.addEventListener("click", async () => {
  const token = getToken();
  if (!token) {
    location.href = "./index.html";
    return;
  }

  const payload = {
    payerName: String(payerNameEl.value || "").trim(),
    amount: "10",
    paidAt: new Date().toISOString(),
    proofCode: String(proofCodeEl.value || "").trim(),
    proofImageUrl: String(proofImageUrlEl.value || "").trim(),
    note: String(proofNoteEl.value || "").trim()
  };

  submitVipRequestBtnEl.disabled = true;
  payMsgEl.textContent = "提交中...";
  try {
    const response = await fetch(apiUrl("/api/upgrade/request"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "提交失败");
    }
    payMsgEl.textContent = "已提交支付凭证，等待管理员审核通过后生效。";
  } catch (error) {
    payMsgEl.textContent = `提交失败：${error.message}`;
  } finally {
    submitVipRequestBtnEl.disabled = false;
  }
});

ensureLoggedIn().then((user) => {
  if (!user) return;
  if (String(user.role || "").toLowerCase() === "admin" || String(user.plan || "").toLowerCase() === "vip") {
    payMsgEl.textContent = "你当前已是 VIP/管理员，无需重复申请。";
    submitVipRequestBtnEl.disabled = true;
    return;
  }
  loadMyRequests();
});
