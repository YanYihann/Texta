const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isInternal, isExternal } = require('../policy.cjs');

test('only the production HTTPS origin can stay inside the desktop client', () => {
  assert.equal(isInternal('https://texta.yanyihan.top/app.html'), true);
  for (const url of ['http://texta.yanyihan.top/', 'https://texta.yanyihan.top.evil.test/', 'https://texta.yanyihan.top@evil.test/', 'file:///C:/Windows/', 'javascript:alert(1)', 'not a URL']) {
    assert.equal(isInternal(url), false, url);
  }
});

test('external links cannot invoke arbitrary OS protocols or local files', () => {
  for (const url of ['https://example.com/pay', 'http://example.com/', 'mailto:help@example.com']) assert.equal(isExternal(url), true, url);
  for (const url of ['file:///C:/Windows/', 'javascript:alert(1)', 'powershell:test', 'ms-settings:test', 'data:text/html,test', 'https://user:pass@example.com/', 'bad']) assert.equal(isExternal(url), false, url);
});
