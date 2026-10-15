const automator = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');
(async () => {
  const mini = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + (process.env.TEXTA_AUTO_PORT || '9420') });
  const timer = setTimeout(() => { mini.disconnect(); process.exit(2); }, 30000);
  try {
    const page = await mini.currentPage();
    console.log('Page:', page.path, 'Size:', await page.size());
    const input = await page.$('.word-input');
    console.log('Input size:', await input.size(), 'radius:', await input.style('border-radius'));
    const html = await page.windowProperty('document.documentElement.outerHTML');
    const captures = path.join(require('os').tmpdir(), 'texta-mini-verification');
    fs.mkdirSync(captures, { recursive: true });
    fs.writeFileSync(path.join(captures, 'simulator-dom.html'), html);
    console.log('Saved actual simulator DOM (' + html.length + ' characters).');
    const result = await mini.evaluate(() => new Promise(resolve => wx.request({
      url: 'https://api-texta.yanyihan.top/api/health', timeout: 10000,
      success: res => resolve({ status: res.statusCode, ok: !!(res.data && res.data.ok), service: res.data && res.data.service }),
      fail: error => resolve({ error: error.errMsg })
    })));
    console.log('Actual wx.request API health:', JSON.stringify(result));
  } finally { clearTimeout(timer); mini.disconnect(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
