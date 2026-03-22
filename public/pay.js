const upgradeNowBtnEl = document.getElementById("upgradeNowBtn");
const payMsgEl = document.getElementById("payMsg");

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

upgradeNowBtnEl.addEventListener("click", async () => {
  const token = getToken();
  if (!token) {
    location.href = "./index.html";
    return;
  }

  upgradeNowBtnEl.disabled = true;
  payMsgEl.textContent = "正在处理开通请求...";
  try {
    const response = await fetch(apiUrl("/api/upgrade/vip"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      }
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "开通失败");
    }
    payMsgEl.textContent = "VIP 已开通，正在返回主页面...";
    setTimeout(() => {
      location.href = "./app.html";
    }, 700);
  } catch (error) {
    payMsgEl.textContent = `开通失败：${error.message}`;
  } finally {
    upgradeNowBtnEl.disabled = false;
  }
});

ensureLoggedIn().then((user) => {
  if (!user) return;
  if (String(user.role || "").toLowerCase() === "admin" || String(user.plan || "").toLowerCase() === "vip") {
    payMsgEl.textContent = "你当前已是 VIP/管理员，无需重复开通。";
  }
});
