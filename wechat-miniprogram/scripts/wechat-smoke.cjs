const automator = require('miniprogram-automator');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const out = path.join(require('node:os').tmpdir(), 'texta-wechat-login-20261007');
fs.mkdirSync(out, { recursive: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const mini = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' });
  console.log('Connected to simulator.');
  const errors = [], captures = [];
  mini.on('exception', error => errors.push(error));
  const timer = setTimeout(() => { mini.disconnect(); process.exit(2); }, 90000);
  async function at(route) {
    for (let i = 0; i < 40; i++) { const page = await mini.currentPage(); if (page.path === route) { await pause(250); return page; } await pause(200); }
    throw Error('Navigation did not reach ' + route);
  }
  async function capture(page, name) {
    await pause(200); const size = await page.size(); assert.ok(size.width <= 440);
    await mini.screenshot({ path: path.join(out, name + '.png') }); captures.push({ name, size });
  }
  try {
    console.log('Backing up test state…');
    await mini.evaluate(() => {
      const global = getApp().globalData;
      global.__wechatSmokeOriginal = { session: wx.getStorageSync('texta_session'), article: global.currentArticle, theme: wx.getStorageSync('texta_theme_preference'), library: wx.getStorageSync('texta_library_wechat-ui-test') };
      global.__wechatSmoke = { bound: false, enabled: true, codes: 0, requests: [] };
      wx.removeStorageSync('texta_session'); wx.removeStorageSync('texta_library_wechat-ui-test'); wx.setStorageSync('texta_theme_preference', 'light');
    });
    console.log('Installing wx.login fixture…');
    await mini.mockWxMethod('login', function() {
      const state = getApp().globalData.__wechatSmoke;
      return { code: 'fixture-code-' + ++state.codes };
    }.toString());
    console.log('Installing request fixture…');
    await mini.mockWxMethod('request', function(options) {
      const state = getApp().globalData.__wechatSmoke, route = options.url.split('.top')[1];
      state.requests.push(route);
      const user = { id: 'wechat-ui-test', name: '模拟器账号', email: 'wechat-ui@example.invalid' };
      if (route === '/api/auth/wechat/status') return { statusCode: 200, data: { enabled: state.enabled, bound: state.bound } };
      if (route === '/api/auth/wechat/login' && !state.bound) return { statusCode: 200, data: { ok: true, bindingRequired: true } };
      if (route === '/api/auth/login' || route === '/api/auth/wechat/login') return { statusCode: 200, data: { token: 'fixture-token', user, expiresAt: Date.now() + 60000 } };
      if (route === '/api/auth/wechat/bind') { state.bound = true; return { statusCode: 200, data: { ok: true, bound: true } }; }
      if (route === '/api/library') return { statusCode: 200, data: { favorites: [], notebookEntries: [], vocabPrefs: {}, libraryFolders: [] } };
      if (route === '/api/usage') return { statusCode: 200, data: { user, plan: 'free', usage: { used: 0, remaining: 10, limit: 10 } } };
      return { statusCode: 404, data: {} };
    }.toString());
    console.log('Opening authentication…');
    await mini.switchTab('/pages/index/index');
    await mini.navigateTo('/pages/auth/auth'); let page = await at('pages/auth/auth'); await pause(350);
    assert.equal(await page.data('wechatReady'), true); await capture(page, 'auth-light');
    await page.callMethod('agreement', { detail: { value: ['agree'] } });
    await page.callMethod('wechatLogin'); assert.equal(await page.data('bindingNeeded'), true); await capture(page, 'email-binding-needed');
    await page.callMethod('onInput', { currentTarget: { dataset: { field: 'email' } }, detail: { value: 'wechat-ui@example.invalid' } });
    await page.callMethod('onInput', { currentTarget: { dataset: { field: 'password' } }, detail: { value: 'fixture-password' } });
    await page.callMethod('submit'); assert.equal((await page.data('bindingUser')).id, 'wechat-ui-test'); await capture(page, 'binding-confirmation');
    await page.callMethod('bindWechat'); await at('pages/index/index');
    await mini.switchTab('/pages/profile/profile'); page = await at('pages/profile/profile'); await pause(350);
    assert.equal(await page.data('wechatBound'), true); await capture(page, 'profile-bound');
    await mini.evaluate(() => wx.removeStorageSync('texta_session'));
    await mini.navigateTo('/pages/auth/auth'); page = await at('pages/auth/auth');
    await page.callMethod('agreement', { detail: { value: ['agree'] } }); await page.callMethod('wechatLogin'); await at('pages/profile/profile');
    assert.equal(await mini.evaluate(() => wx.getStorageSync('texta_session').user.id), 'wechat-ui-test');
    await mini.evaluate(() => { wx.removeStorageSync('texta_session'); getApp().globalData.__wechatSmoke.enabled = false; wx.setStorageSync('texta_theme_preference', 'dark'); });
    await mini.navigateTo('/pages/auth/auth'); page = await at('pages/auth/auth'); await pause(350);
    assert.equal(await page.data('wechatReady'), false); await capture(page, 'auth-disabled-dark');
    const state = await mini.evaluate(() => ({ codes: getApp().globalData.__wechatSmoke.codes, paths: getApp().globalData.__wechatSmoke.requests }));
    assert.equal(state.codes, 3); assert.ok(!state.paths.includes('/api/generate')); assert.equal(errors.length, 0, JSON.stringify(errors));
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ captures, mockWxLogin: true, mockApi: true, generationCalled: false, runtimeErrors: errors, ...state }, null, 2));
    console.log('WeChat login simulator workflow passed:', out);
  } finally {
    try {
      await mini.restoreWxMethod('request'); await mini.restoreWxMethod('login');
      await mini.evaluate(() => {
        const global = getApp().globalData, old = global.__wechatSmokeOriginal;
        if (!old) return;
        for (const [key, value] of [['texta_session', old.session], ['texta_theme_preference', old.theme], ['texta_library_wechat-ui-test', old.library]]) {
          if (value) wx.setStorageSync(key, value); else wx.removeStorageSync(key);
        }
        global.currentArticle = old.article; delete global.__wechatSmokeOriginal; delete global.__wechatSmoke;
      });
      await mini.switchTab('/pages/index/index');
    } finally { clearTimeout(timer); mini.disconnect(); }
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
