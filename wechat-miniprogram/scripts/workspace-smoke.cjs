const automator = require('miniprogram-automator');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixture = require('../tests/fixture.cjs');
const out = path.join(require('node:os').tmpdir(), 'texta-workspace-20261007');
fs.mkdirSync(out, { recursive: true });
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
(async () => {
  const mini = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' });
  const errors = [], report = []; let page;
  mini.on('exception', error => errors.push(error));
  const timeout = setTimeout(() => { mini.disconnect(); process.exit(2); }, 120000);
  async function capture(page,name) {
    await wait(250);
    await mini.screenshot({ path: path.join(out,name + '.png') });
    const size = await page.size(); assert.ok(size.width <= 440);
    report.push({ name, route: page.path, size });
  }
  try {
    await mini.evaluate(() => { getApp().globalData.__workspaceOriginal = { draft: wx.getStorageSync('texta_draft'), theme: wx.getStorageSync('texta_theme_preference'), article: getApp().globalData.currentArticle }; });
    page = await mini.currentPage();
    if (page.path !== 'pages/index/index') page = await mini.switchTab('/pages/index/index');
    await page.callMethod('clear');
    await page.callMethod('onDraftInput',{ detail: { value: 'journey, take part in, journay,' } });
    assert.equal(await page.data('count'),3);
    assert.equal((await page.data('suggestions'))[0].suggestion,'journey');
    await page.callMethod('replaceSuggestion',{ currentTarget: { dataset: { index: 0 } } });
    assert.equal(await page.data('count'),2);
    await page.callMethod('example');
    const switcher = await page.$('theme-switcher');
    for (const id of ['light','dark','highlighter','paper','ocean','lavender']) {
      await switcher.callMethod('choose',{ currentTarget: { dataset: { id } } });
      assert.equal(await page.data('themeId'),id); await capture(page,'input-' + id);
    }
    await page.callMethod('onDraftInput',{ detail: { value: 'opportu' } });
    assert.equal(await page.data('completion'),'opportunity');
    await page.callMethod('acceptCompletion'); await page.callMethod('commitDraft');
    await switcher.callMethod('choose',{ currentTarget: { dataset: { id: 'light' } } });
    await page.callMethod('blurEditor');
    await mini.evaluate(article => { getApp().globalData.currentArticle = article; },fixture);
    page = await mini.navigateTo('/pages/result/result');
    assert.equal(page.path,'pages/result/result');
    await capture(page,'reading-light');
    await page.callMethod('openWord',{ currentTarget: { dataset: { word: 'journey' } } });
    await capture(page,'word-sheet-light'); await page.callMethod('closeWord');
    await page.callMethod('exportFile');
    await capture(page,'export-preview');
    await mini.mockWxMethod('openDocument',{ errMsg: 'openDocument:ok' });
    for (const type of ['pdf','docx']) {
      await page.callMethod('changeExportType',{ currentTarget: { dataset: { type } } });
      await page.callMethod('confirmExport');
      assert.equal(await page.data('error'),'');
      const binary = await mini.evaluate(type => {
        const directory = wx.env.USER_DATA_PATH + '/texta-exports', fs = wx.getFileSystemManager();
        const file = fs.readdirSync(directory).filter(name => name.endsWith('.' + type)).sort().pop();
        return fs.readFileSync(directory + '/' + file,'base64');
      },type);
      fs.writeFileSync(path.join(out,'sample-export.' + type),Buffer.from(binary,'base64'));
    }
    await page.callMethod('closeExport');
    const resultSwitcher = await page.$('theme-switcher');
    await resultSwitcher.callMethod('choose',{ currentTarget: { dataset: { id: 'dark' } } });
    await capture(page,'reading-dark');
    await page.callMethod('openWord',{ currentTarget: { dataset: { word: 'journey' } } });
    await capture(page,'word-sheet-dark');
    await page.callMethod('closeWord');
    page = await mini.switchTab('/pages/profile/profile');
    assert.equal(await page.data('themeId'),'dark'); await capture(page,'profile-dark');
    assert.equal(errors.length,0,JSON.stringify(errors));
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({ report, runtimeErrors: errors, generationApiCalled: false, fixtureUsed: true },null,2));
    console.log('Workspace simulator verification passed:',out);
  } finally {
    await mini.restoreWxMethod('openDocument');
    await mini.evaluate(() => {
      const old = getApp().globalData.__workspaceOriginal;
      if (!old) return;
      if (old.draft) wx.setStorageSync('texta_draft',old.draft); else wx.removeStorageSync('texta_draft');
      if (old.theme) wx.setStorageSync('texta_theme_preference',old.theme); else wx.removeStorageSync('texta_theme_preference');
      getApp().globalData.currentArticle = old.article;
      delete getApp().globalData.__workspaceOriginal;
    });
    await mini.switchTab('/pages/index/index');
    page = await mini.currentPage(); await page.callMethod('onLoad'); await page.callMethod('onShow');
    clearTimeout(timeout); mini.disconnect();
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
