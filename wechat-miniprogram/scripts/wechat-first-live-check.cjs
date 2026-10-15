const automator = require('miniprogram-automator');
const fs = require('node:fs');
const path = require('node:path');
let stage = 'connect';
(async () => {
  const mini = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' });
  const timer = setTimeout(() => { mini.disconnect(); process.exit(2); }, 55000);
  try {
    stage = 'evaluate';
    const result = await mini.evaluate(() => new Promise(resolve => {
      const request = (route, data, token) => new Promise(done => wx.request({
        url: 'https://api-texta.yanyihan.top' + route, method: data ? 'POST' : 'GET', data, timeout: 15000,
        header: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        success: r => done({ status: r.statusCode, data: r.data || {} }), fail: () => done({ status: 0, data: {} })
      }));
      const login = () => new Promise(done => wx.login({ timeout: 10000,
        success: r => r.code ? request('/api/auth/wechat/login', { code: r.code }).then(done) : done({ status: 0, data: {} }),
        fail: () => done({ status: 0, data: {} })
      }));
      login().then(first => {
        if (first.status !== 200 || !first.data.token) return resolve({ ok: false, stage: 'first-login', status: first.status, error: first.data.error || null });
        Promise.all([request('/api/usage', null, first.data.token), request('/api/library', null, first.data.token), login()]).then(results => {
          const usage = results[0], library = results[1], second = results[2];
          const sameUser = first.data.user.id === (second.data.user || {}).id;
          const checked = { ok: second.status === 200 && Boolean(second.data.token) && sameUser && usage.status === 200 && library.status === 200,
            stage: 'repeat-login', status: second.status, firstCreated: first.data.created === true,
            sameUser, emailBound: Boolean(first.data.user.email), plan: usage.data.plan,
            usageAccessible: usage.status === 200, libraryAccessible: library.status === 200,
            credentialsPersisted: false, emailBindingTested: false };
          const cleanup = [request('/api/auth/logout', {}, first.data.token)];
          if (second.data.token) cleanup.push(request('/api/auth/logout', {}, second.data.token));
          Promise.all(cleanup).then(() => resolve(checked));
        });
      });
    }));
    const report = { checkedAt: new Date().toISOString(), mocked: false, ...result };
    fs.writeFileSync(path.join(__dirname, '../artifacts/wechat-first-live-check-20261007.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report)); if (!result.ok) process.exitCode = 1;
  } finally { clearTimeout(timer); mini.disconnect(); }
})().catch(error => {
  const message = String(error.message || '').split('\n')[0].slice(0, 180).replace(/tk_[a-f0-9]+/g, '[redacted]');
  console.error(JSON.stringify({ error: 'Live check failed', stage, name: error.name, code: error.code || null, message })); process.exitCode = 1;
});
