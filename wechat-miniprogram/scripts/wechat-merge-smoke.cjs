const automator = require('miniprogram-automator');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const out = path.join(__dirname, '../artifacts/wechat-merge-20261007');
fs.mkdirSync(out, { recursive: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const mini = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' });
  const errors = [], captures = [];
  mini.on('exception', error => errors.push(error));
  const timer = setTimeout(() => { mini.disconnect(); process.exit(2); }, 55000);
  async function at(route) {
    for (let i = 0; i < 40; i++) { const page = await mini.currentPage(); if (page.path === route) { await pause(250); return page; } await pause(150); }
    throw Error('Navigation did not reach ' + route);
  }
  async function capture(page, name) {
    await pause(200); const size = await page.size(); assert.ok(size.width <= 440);
    await mini.screenshot({ path: path.join(out, name + '.png') }); captures.push({ name, size });
  }
  try {
    await mini.evaluate(() => {
      const global = getApp().globalData;
      const keys = ['texta_session', 'texta_theme_preference', 'texta_library_merge-ui-source', 'texta_library_merge-ui-target', 'texta_history_merge-ui-source', 'texta_history_merge-ui-target'];
      global.__mergeSmokeOriginal = { values: keys.map(key => [key, wx.getStorageSync(key)]), article: global.currentArticle };
      global.__mergeSmoke = { requests: [], merged: false };
      wx.setStorageSync('texta_theme_preference', 'light');
      wx.setStorageSync('texta_session', { token: 'fixture-source-token', expiresAt: Date.now() + 60000, user: { id: 'merge-ui-source', name: '模拟器微信账号', email: '' } });
      const article = { id: 'fixture-reading', title: 'Journey', article: 'A journey begins.', words: ['journey'], lexicon: [], createdAt: '2026-10-07T00:00:00.000Z', updatedAt: '2026-10-07T00:00:00.000Z' };
      wx.setStorageSync('texta_library_merge-ui-source', { favorites: [article], notebookEntries: [], libraryFolders: [], vocabPrefs: {}, dirty: true, revision: 1 });
      wx.removeStorageSync('texta_library_merge-ui-target');
      wx.setStorageSync('texta_history_merge-ui-source', [article]); wx.removeStorageSync('texta_history_merge-ui-target');
    });
    await mini.mockWxMethod('request', function(options) {
      const state = getApp().globalData.__mergeSmoke, route = options.url.split('.top')[1];
      state.requests.push(route);
      const target = { id: 'merge-ui-target', email: 'existing@example.invalid', name: '原邮箱账号', plan: 'pro' };
      const user = state.merged ? target : { id: 'merge-ui-source', name: '模拟器微信账号', email: '', plan: 'free' };
      if (route === '/api/auth/wechat/status') return { statusCode: 200, data: { enabled: true, bound: true } };
      if (route === '/api/library') return { statusCode: 200, data: { favorites: [], notebookEntries: [], vocabPrefs: {}, libraryFolders: [] } };
      if (route === '/api/library/sync') return { statusCode: 200, data: { ok: true } };
      if (route === '/api/usage') return { statusCode: 200, data: { user, plan: state.merged ? 'pro' : 'free', usage: { used: 6, remaining: 94, limit: 100 } } };
      if (route === '/api/auth/wechat/email') {
        if (!options.data.mergeExisting || options.data.password !== 'fixture-original-password') return { statusCode: 400, data: { error: '邮箱或原账号密码不正确，未进行合并。' } };
        state.merged = true;
        return { statusCode: 200, data: { ok: true, merged: true, mergedFrom: 'merge-ui-source', user: target, token: 'fixture-target-token', expiresAt: Date.now() + 60000 } };
      }
      return { statusCode: 404, data: {} };
    }.toString());
    await mini.switchTab('/pages/profile/profile'); let page = await at('pages/profile/profile');
    await page.callMethod('bindEmail'); page = await at('pages/auth/auth');
    await page.callMethod('changeEmailMode', { currentTarget: { dataset: { mode: 'existing' } } });
    await capture(page, 'existing-account-settings');
    await page.callMethod('agreement', { detail: { value: ['agree'] } });
    for (const [field, value] of [['email', 'existing@example.invalid'], ['password', 'wrong-password']])
      await page.callMethod('onInput', { currentTarget: { dataset: { field } }, detail: { value } });
    await page.callMethod('bindEmail'); assert.match(await page.data('error'), /未进行合并/);
    assert.equal(await mini.evaluate(() => wx.getStorageSync('texta_session').user.id), 'merge-ui-source');
    await capture(page, 'wrong-password');
    await page.callMethod('onInput', { currentTarget: { dataset: { field: 'password' } }, detail: { value: 'fixture-original-password' } });
    await page.callMethod('bindEmail'); page = await at('pages/profile/profile'); await pause(300);
    assert.equal((await page.data('user')).email, 'existing@example.invalid'); await capture(page, 'merged-profile');
    const result = await mini.evaluate(() => ({ targetId: wx.getStorageSync('texta_session').user.id,
      historyRetained: wx.getStorageSync('texta_history_merge-ui-target').length === 1,
      sourceBackupRetained: wx.getStorageSync('texta_history_merge-ui-source').length === 1,
      favoriteRetained: wx.getStorageSync('texta_library_merge-ui-target').favorites.length === 1,
      paths: getApp().globalData.__mergeSmoke.requests }));
    assert.equal(result.targetId, 'merge-ui-target'); assert.ok(result.historyRetained && result.favoriteRetained && result.sourceBackupRetained);
    assert.ok(!result.paths.includes('/api/generate')); assert.equal(errors.length, 0, JSON.stringify(errors));
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ mocked: true, ok: true, captures, runtimeErrors: errors, ...result }, null, 2));
    console.log('PASS: simulator original-password failure, existing-email association, profile switch, local history/favorite preservation.');
  } finally {
    try {
      await mini.restoreWxMethod('request');
      await mini.evaluate(() => {
        const global = getApp().globalData, old = global.__mergeSmokeOriginal; if (!old) return;
        for (const [key, value] of old.values) { if (value) wx.setStorageSync(key, value); else wx.removeStorageSync(key); }
        global.currentArticle = old.article; delete global.__mergeSmokeOriginal; delete global.__mergeSmoke;
      });
      await mini.switchTab('/pages/index/index');
    } finally { clearTimeout(timer); mini.disconnect(); }
  }
})().catch(error => { console.error(String(error.message).slice(0, 200)); process.exitCode = 1; });
