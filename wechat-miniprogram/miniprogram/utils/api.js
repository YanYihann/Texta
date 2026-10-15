const config = require('../config');
const SESSION = 'texta_session';

function session() { return wx.getStorageSync(SESSION) || null; }
function saveSession(value) { wx.setStorageSync(SESSION, value); }
function clearSession() { wx.removeStorageSync(SESSION); }
function signedIn() {
  const value = session();
  if (!value || !value.token || !value.user || !value.user.id) return false;
  if (value.expiresAt && Number(value.expiresAt) <= Date.now()) { clearSession(); return false; }
  return true;
}
const messages = {
  'Invalid email or password.': '邮箱或密码不正确。',
  'Email already registered.': '这个邮箱已注册，请切换到登录。',
  'Unauthorized.': '登录已过期，请重新登录。',
  'Please provide a valid email.': '请输入有效的邮箱地址。',
  'Password must be at least 6 characters.': '密码至少需要 6 位。',
  'Failed to login.': '登录失败，请稍后重试。',
  'Failed to register.': '注册失败，请稍后重试。',
  'Failed to generate article.': '文章生成失败，请稍后重试。',
  'Failed to load library.': '云端资料暂时无法读取，请稍后重试。',
  'Failed to sync library.': '同步未完成，本地修改已保留。',
  'Please provide a word list only, not a full article or paragraph.': '请输入单词或短语列表，不要粘贴完整文章。'
};
function request(path, options = {}) {
  const auth = session();
  return new Promise((resolve, reject) => {
    wx.request({
      url: config.apiBase + path,
      method: options.method || 'GET',
      data: options.data,
      timeout: options.timeout || config.requestTimeout,
      header: Object.assign({ 'Content-Type': 'application/json' },
        auth && auth.token && options.auth !== false ? { Authorization: 'Bearer ' + auth.token } : {}),
      success(res) {
        const data = res.data && typeof res.data === 'object' ? res.data : {};
        if (res.statusCode >= 200 && res.statusCode < 300) { resolve(data); return; }
        if (res.statusCode === 401 && options.auth !== false && session() && auth && session().token === auth.token) clearSession();
        const raw = String(data.error || '');
        let message = messages[raw] || (/Insufficient quota/.test(raw) ? '今日剩余额度不足，请明天再试。' : raw);
        if (!message) message = '服务暂时不可用，请稍后重试。';
        const error = new Error(message);
        error.status = res.statusCode;
        error.usage = data.usage;
        reject(error);
      },
      fail(res) {
        const timeout = /timeout/i.test(res.errMsg || '');
        const error = new Error(timeout
          ? (path === '/api/generate' ? '等待生成超时。服务端可能仍在处理，请稍后检查额度，再决定是否重试。' : '连接超时，请稍后重试。')
          : '连接失败，请检查网络和小程序的服务器域名配置。');
        error.network = true;
        reject(error);
      }
    });
  });
}
function requireLogin() {
  if (signedIn()) return true;
  wx.navigateTo({ url: '/pages/auth/auth' });
  return false;
}
module.exports = { request, session, saveSession, clearSession, signedIn, requireLogin };
