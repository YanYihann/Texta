const automator = require('miniprogram-automator');
(async () => {
  const mini = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + (process.env.TEXTA_AUTO_PORT || '9420') });
  try {
    await mini.restoreWxMethod('request');
    await mini.evaluate(() => {
      const global = getApp().globalData, old = global.__smokeOriginal;
      if (old) {
        if (old.session) wx.setStorageSync('texta_session', old.session); else wx.removeStorageSync('texta_session');
        if (old.draft) wx.setStorageSync('texta_draft', old.draft); else wx.removeStorageSync('texta_draft');
        global.currentArticle = old.article;
      }
      ['texta_library_smoke-test-user', 'texta_history_smoke-test-user'].forEach(key => wx.removeStorageSync(key));
      delete global.__smokeOriginal; delete global.__smokeArticle; delete global.__smokeCloud;
    });
    await mini.reLaunch('/pages/index/index');
    console.log('Removed smoke mocks and restored the prior session and draft.');
  } finally { mini.disconnect(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
