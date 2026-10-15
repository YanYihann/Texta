const api = require('./api');

function loginCode() {
  return new Promise((resolve, reject) => {
    if (!wx.login) { reject(new Error('当前微信版本暂不支持快捷登录，请使用邮箱登录。')); return; }
    wx.login({ timeout: 10000,
      success(result) { if (result.code) resolve(result.code); else reject(new Error('微信未返回登录凭证，请重试。')); },
      fail() { reject(new Error('无法获取微信登录凭证，请重试或使用邮箱登录。')); }
    });
  });
}
async function status() {
  try {
    const value = await api.request('/api/auth/wechat/status', { timeout: 12000 });
    return { enabled: value.enabled === true, bound: value.bound === true };
  } catch (_) { return { enabled: false, bound: false }; }
}
async function login() {
  return api.request('/api/auth/wechat/login', { method: 'POST', auth: false, data: { code: await loginCode() } });
}
async function bind(token) {
  const code = await loginCode();
  if (!token || !api.signedIn() || api.session().token !== token) throw new Error('账号状态已改变，请重新登录后绑定。');
  const result = await api.request('/api/auth/wechat/bind', { method: 'POST', data: { code } });
  if (!api.signedIn() || api.session().token !== token) throw new Error('账号状态已改变，请重新打开账号页面确认绑定结果。');
  if (!result.ok || !result.bound) throw new Error('微信绑定结果不完整，请重试。');
  return result;
}
module.exports = { status, login, bind };
