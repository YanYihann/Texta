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
const AUTH_REQUEST_TIMEOUT_MS = 25000;
const AUTH_RETRY_COUNT = 2;
let warmupPromise = null;

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isRetriableStatus(status) {
  return [408, 429, 500, 502, 503, 504].includes(Number(status));
}

function isRetriableFetchError(error) {
  return error?.name === "AbortError" || error instanceof TypeError;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = AUTH_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

async function apiFetch(path, options = {}) {
  const retryCount = Number(options.retryCount ?? AUTH_RETRY_COUNT);
  const timeoutMs = Number(options.timeoutMs ?? AUTH_REQUEST_TIMEOUT_MS);
  const retryDelayMs = Number(options.retryDelayMs ?? 900);
  const { retryCount: _retryCount, timeoutMs: _timeoutMs, retryDelayMs: _retryDelayMs, ...fetchOptions } = options;
  let lastError = null;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const response = await fetchWithTimeout(apiUrl(path), fetchOptions, timeoutMs);
      if (attempt < retryCount && isRetriableStatus(response.status)) {
        await wait(retryDelayMs * (attempt + 1));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= retryCount || !isRetriableFetchError(error)) {
        throw error;
      }
      await wait(retryDelayMs * (attempt + 1));
    }
  }

  throw lastError || new Error("Network request failed");
}

function warmupApi() {
  if (!API_BASE) return Promise.resolve(false);
  if (!warmupPromise) {
    warmupPromise = apiFetch("/api/health", {
      method: "GET",
      retryCount: 1,
      timeoutMs: 18000,
      retryDelayMs: 1200
    })
      .then((response) => response.ok)
      .catch(() => false);
  }
  return warmupPromise;
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
  setAuthMessage("登录中...如果后端刚启动，首次连接可能需要稍等。", false);
  try {
    await Promise.race([warmupApi(), wait(5000)]);
    const response = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      retryCount: AUTH_RETRY_COUNT,
      timeoutMs: AUTH_REQUEST_TIMEOUT_MS
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "登录失败");
    }

    localStorage.setItem("texta_auth_token", data.token || "");
    location.href = "./app.html";
  } catch (error) {
    const message = error?.name === "AbortError" || error instanceof TypeError
      ? "登录失败：网络连接超时或后端正在启动，请再点一次登录。"
      : `登录失败：${error.message}`;
    setAuthMessage(message);
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
  setAuthMessage("注册中...如果后端刚启动，首次连接可能需要稍等。", false);
  try {
    await Promise.race([warmupApi(), wait(5000)]);
    const regResp = await apiFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
      retryCount: AUTH_RETRY_COUNT,
      timeoutMs: AUTH_REQUEST_TIMEOUT_MS
    });
    const regData = await regResp.json();
    if (!regResp.ok) {
      throw new Error(regData.error || "注册失败");
    }

    const loginResp = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      retryCount: AUTH_RETRY_COUNT,
      timeoutMs: AUTH_REQUEST_TIMEOUT_MS
    });
    const loginData = await loginResp.json();
    if (!loginResp.ok) {
      throw new Error(loginData.error || "注册后自动登录失败");
    }

    localStorage.setItem("texta_auth_token", loginData.token || "");
    localStorage.setItem("texta_guide_force_open", "1");
    location.href = "./app.html";
  } catch (error) {
    const message = error?.name === "AbortError" || error instanceof TypeError
      ? "注册失败：网络连接超时或后端正在启动，请稍后重试。"
      : `注册失败：${error.message}`;
    setAuthMessage(message);
  } finally {
    registerBtnEl.disabled = false;
  }
});

setAuthMode("login");
void warmupApi();
