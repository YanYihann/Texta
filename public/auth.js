const tabLoginEl = document.getElementById("tabLogin");
const tabRegisterEl = document.getElementById("tabRegister");
const authMsgEl = document.getElementById("authMsg");
const loginFormEl = document.getElementById("loginForm");
const registerFormEl = document.getElementById("registerForm");
const loginEmailEl = document.getElementById("loginEmail");
const loginPasswordEl = document.getElementById("loginPassword");
const loginBtnEl = document.getElementById("loginBtn");
const registerNameEl = document.getElementById("registerName");
const registerEmailEl = document.getElementById("registerEmail");
const registerPasswordEl = document.getElementById("registerPassword");
const registerBtnEl = document.getElementById("registerBtn");
const forgotPasswordBtnEl = document.getElementById("forgotPasswordBtn");
const authHelpBtnEl = document.getElementById("authHelpBtn");

const API_BASE = String(window.TEXTA_API_BASE || "").trim().replace(/\/$/, "");

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function setAuthMessage(message = "", isError = true) {
  authMsgEl.textContent = message;
  authMsgEl.classList.toggle("success", !isError && Boolean(message));
}

function setAuthMode(mode) {
  const isRegister = mode === "register";
  tabLoginEl.classList.toggle("active", !isRegister);
  tabRegisterEl.classList.toggle("active", isRegister);
  loginFormEl.classList.toggle("hidden", isRegister);
  registerFormEl.classList.toggle("hidden", !isRegister);
  setAuthMessage("");
}

tabLoginEl.addEventListener("click", () => setAuthMode("login"));
tabRegisterEl.addEventListener("click", () => setAuthMode("register"));

forgotPasswordBtnEl?.addEventListener("click", () => {
  setAuthMessage("暂未开放自助找回密码，请联系管理员处理。", false);
});

authHelpBtnEl?.addEventListener("click", () => {
  setAuthMessage("使用邮箱注册或登录，进入后即可生成单词文章。", false);
});

loginBtnEl.addEventListener("click", async () => {
  const email = String(loginEmailEl.value || "").trim();
  const password = String(loginPasswordEl.value || "");
  if (!email || !password) {
    setAuthMessage("请填写邮箱和密码。");
    return;
  }

  loginBtnEl.disabled = true;
  setAuthMessage("登录中...", false);
  try {
    const response = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "登录失败");
    }

    localStorage.setItem("texta_auth_token", data.token || "");
    location.href = "./app.html";
  } catch (error) {
    setAuthMessage(`登录失败：${error.message}`);
  } finally {
    loginBtnEl.disabled = false;
  }
});

registerBtnEl.addEventListener("click", async () => {
  const name = String(registerNameEl.value || "").trim();
  const email = String(registerEmailEl.value || "").trim();
  const password = String(registerPasswordEl.value || "");
  if (!email || !password) {
    setAuthMessage("请填写邮箱和密码。");
    return;
  }

  registerBtnEl.disabled = true;
  setAuthMessage("注册中...", false);
  try {
    const regResp = await fetch(apiUrl("/api/auth/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });
    const regData = await regResp.json();
    if (!regResp.ok) {
      throw new Error(regData.error || "注册失败");
    }

    const loginResp = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const loginData = await loginResp.json();
    if (!loginResp.ok) {
      throw new Error(loginData.error || "注册后自动登录失败");
    }

    localStorage.setItem("texta_auth_token", loginData.token || "");
    location.href = "./app.html";
  } catch (error) {
    setAuthMessage(`注册失败：${error.message}`);
  } finally {
    registerBtnEl.disabled = false;
  }
});

setAuthMode("login");
