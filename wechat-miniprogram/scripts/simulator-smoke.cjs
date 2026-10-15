const automator = require('miniprogram-automator');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const article = require('../tests/fixture.cjs');
// DevTools watches the project root; writing capture files there can reload and destroy pages.
const artifactDir = process.env.TEXTA_ARTIFACT_DIR || path.join(require('os').tmpdir(), 'texta-mini-verification');
fs.mkdirSync(artifactDir, { recursive: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const mini = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + (process.env.TEXTA_AUTO_PORT || '9420') });
  const errors = [], report = [];
  mini.on('exception', error => errors.push(error));
  const timer = setTimeout(() => { console.error('Simulator check timed out'); mini.disconnect(); process.exit(2); }, 180000);
  async function captureDOM(page, name) {
    await sleep(350);
    const html = await page.windowProperty('document.documentElement.outerHTML');
    fs.writeFileSync(path.join(artifactDir, name + '.html'), html);
    const dimensions = await page.size();
    assert.ok(dimensions.width <= 440, 'Page causes horizontal overflow: ' + JSON.stringify(dimensions));
    report.push({ page: page.path, dimensions });
  }
  async function currentAt(expected) {
    for (let i = 0; i < 40; i++) {
      const page = await mini.currentPage();
      if (page.path === expected) { await sleep(500); return mini.currentPage(); }
      await sleep(250);
    }
    throw new Error('Navigation did not reach ' + expected + '; errors: ' + JSON.stringify(errors));
  }
  try {
    await mini.evaluate(article => {
      const global = getApp().globalData;
      global.__smokeOriginal = { session: wx.getStorageSync('texta_session'), draft: wx.getStorageSync('texta_draft'), article: global.currentArticle };
      global.__smokeArticle = article;
      global.__smokeCloud = { favorites: [], notebookEntries: [], vocabPrefs: {}, libraryFolders: [{ id: 'web-folder', name: '网页词汇夹', updatedAt: '2026-10-06T00:00:00.000Z' }] };
      wx.removeStorageSync('texta_session');
    }, article);
    await mini.mockWxMethod('request', 'function(options) {\n' +
      'const fixture = ' + JSON.stringify(article) + ';\n' +
      'const remote = {favorites: [], notebookEntries: [], vocabPrefs: {}, libraryFolders: [{id: "web-folder", name: "网页词汇夹", updatedAt: "2026-10-06T00:00:00.000Z"}]};\n' +
      (function(options) {
      let data = {}, statusCode = 200;
      if (options.url.endsWith('/api/health')) data = { ok: true };
      else if (options.url.endsWith('/api/auth/login')) data = { token: 'smoke-test-token', expiresAt: Date.now() + 3600000, user: { id: 'smoke-test-user', name: '模拟器测试账号', email: 'smoke@example.com' } };
      else if (options.url.endsWith('/api/usage')) data = { usage: { used: 1, remaining: 4, limit: 5, isUnlimited: false }, plan: 'free', user: { id: 'smoke-test-user', name: '模拟器测试账号', email: 'smoke@example.com' } };
      else if (options.url.endsWith('/api/generate')) data = fixture;
      else if (options.url.endsWith('/api/spellcheck')) data = { items: [{ word: 'journay', ok: false, suggestion: 'journey' }] };
      else if (options.url.endsWith('/api/library/sync')) data = { ok: true };
      else if (options.url.endsWith('/api/library')) data = remote;
      else if (options.url.endsWith('/api/auth/logout')) data = { ok: true };
      else { statusCode = 404; data = { error: 'Unhandled smoke endpoint' }; }
      return { statusCode, data };
    }).toString().replace(/^function\(options\)\s*\{/, '').replace(/\}\s*$/, '') + '\n}');
    await mini.reLaunch('/pages/index/index');
    let page = await currentAt('pages/index/index');
    console.log('Checking home and login…');
    await captureDOM(page, '01-home');
    await page.callMethod('login');
    page = await currentAt('pages/auth/auth');
    await page.callMethod('onInput', { currentTarget: { dataset: { field: 'email' } }, detail: { value: 'smoke@example.com' } });
    await page.callMethod('onInput', { currentTarget: { dataset: { field: 'password' } }, detail: { value: 'test-password' } });
    await page.callMethod('agreement', { detail: { value: ['agree'] } });
    await captureDOM(page, '02-auth');
    await page.callMethod('submit');
    console.log('Login feedback:', await page.data('error'));
    console.log('Actual routes after login:', await mini.evaluate(() => getCurrentPages().map(page => page.route)));
    console.log('Raw page after login:', await mini.connection.send('App.getCurrentPage'));
    page = await currentAt('pages/index/index');
    console.log('Checking spelling and generation…');
    assert.equal(page.path, 'pages/index/index');
    await page.callMethod('onInput', { detail: { value: 'journay, curious' } });
    assert.equal((await page.data('suggestions')).length, 1);
    await page.callMethod('replaceSuggestion', { currentTarget: { dataset: { index: 0 } } });
    assert.match(await page.data('input'), /journey/);
    await page.callMethod('generate'); page = await currentAt('pages/result/result');
    assert.equal(page.path, 'pages/result/result'); await captureDOM(page, '03-reading');
    console.log('Checking reading and vocabulary…');
    const marked = await page.$('.highlight'); assert.ok(marked); await marked.tap(); await sleep(300);
    assert.equal(await page.data('wordOpen'), true);
    const sheet = await page.$('word-sheet'); await sheet.callMethod('addWord');
    assert.equal(await sheet.data('inNotebook'), true); await captureDOM(page, '04-definition');
    await sheet.callMethod('toggleMastery'); assert.equal(await sheet.data('mastered'), true);
    await sheet.callMethod('close'); await page.callMethod('save'); assert.equal(await page.data('saved'), true);
    await page.callMethod('changeView', { currentTarget: { dataset: { view: 'glossary' } } }); await captureDOM(page, '05-glossary');
    // Run the actual canvas and filesystem export path without opening an external viewer.
    console.log('Checking actual PDF, Word and text exports…');
    const exports = await mini.evaluate(async () => {
      const exporter = require('utils/export.js');
      const page = getCurrentPages()[getCurrentPages().length - 1];
      const article = page.data.article;
      const results = {};
      for (const type of ['docx', 'pdf', 'txt']) {
        const filePath = await exporter.exportArticle(page, article, type);
        results[type] = wx.getFileSystemManager().readFileSync(filePath, 'base64');
      }
      return results;
    });
    for (const type of ['docx', 'pdf', 'txt']) fs.writeFileSync(path.join(artifactDir, 'sample-export.' + type), Buffer.from(exports[type], 'base64'));
    report.push({ exports: Object.fromEntries(Object.entries(exports).map(([type, data]) => [type, Buffer.from(data, 'base64').length])) });
    await mini.switchTab('/pages/library/library'); page = await currentAt('pages/library/library'); await sleep(400);
    console.log('Checking library, review and profile…');
    assert.equal((await page.data('favorites')).length, 1); await captureDOM(page, '06-favorites');
    await page.callMethod('changeTab', { currentTarget: { dataset: { tab: 'notebook' } } });
    await page.callMethod('changeCategory', { currentTarget: { dataset: { category: 'mastered' } } });
    assert.equal((await page.data('notebook')).length, 1); await captureDOM(page, '07-notebook');
    await page.callMethod('reviewWords'); await sleep(400); page = await mini.currentPage(); assert.equal(await page.data('count'), 1);
    await mini.switchTab('/pages/profile/profile'); page = await currentAt('pages/profile/profile'); await sleep(400); await captureDOM(page, '08-profile');
    assert.equal(await page.data('notebookCount'), 1);
    page = await mini.navigateTo('/pages/legal/legal?type=privacy'); await captureDOM(page, '09-privacy');
    assert.ok((await page.data('sections')).length > 5);
    assert.equal(errors.length, 0, 'Runtime errors: ' + JSON.stringify(errors));
    fs.writeFileSync(path.join(artifactDir, 'simulator-report.json'), JSON.stringify({ mockedApi: true, report, runtimeErrors: errors }, null, 2));
    console.log('Simulator checks passed: login, spelling, generation, reading, vocabulary, mastery, cloud sync, review, profile, privacy and real file exports. API responses were mocked.');
    console.log('Artifacts:', artifactDir);
  } finally {
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
      await mini.switchTab('/pages/index/index');
    } finally { clearTimeout(timer); mini.disconnect(); }
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
