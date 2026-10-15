const automator = require('miniprogram-automator');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const mini = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' });
  const timer = setTimeout(() => { mini.disconnect(); process.exit(2); }, 45000);
  try {
    // Check an unbound identity without creating an account or binding it.
    // Credentials stay inside the runtime and are excluded from the report.
    const result = await mini.evaluate(() => new Promise(resolve => {
      wx.login({ timeout: 10000, success(login) {
        if (!login.code) return resolve({ stage: 'wx.login', success: false });
        wx.request({
          url: 'https://api-texta.yanyihan.top/api/auth/wechat/login',
          method: 'POST', data: { code: login.code }, timeout: 20000,
          success(response) {
            const data = response.data || {};
            resolve({ stage: 'exchange', status: response.statusCode, ok: data.ok === true,
              bindingRequired: data.bindingRequired === true, hasSession: Boolean(data.token),
              error: typeof data.error === 'string' ? data.error : null });
          },
          fail() { resolve({ stage: 'request', success: false }); }
        });
      }, fail() { resolve({ stage: 'wx.login', success: false }); } });
    }));
    const report = { checkedAt: new Date().toISOString(), mocked: false, ...result };
    fs.writeFileSync(path.join(__dirname, '../artifacts/wechat-live-check-20261007.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    if (result.status !== 200 || !result.ok) process.exitCode = 1;
  } finally { clearTimeout(timer); mini.disconnect(); }
})().catch(() => { console.error('Live check failed; credentials were not logged.'); process.exitCode = 1; });
