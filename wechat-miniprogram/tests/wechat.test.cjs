const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers.cjs');
const flush = () => new Promise(resolve => setImmediate(resolve));
function ready(page) { page.setData({ wechatReady: true, wechatChecking: false, agreed: true }); }
function credentials(page) { page.setData({ email: 'learner@example.com', password: 'valid-password' }); }

test('WeChat consent is required before obtaining a login code or making a request', async () => {
  const env = setup(), page = env.page('auth/auth.js'); ready(page); page.setData({ agreed: false });
  let calls = 0; wx.login = () => calls++;
  await page.wechatLogin(); assert.equal(calls, 0); assert.equal(env.requests.length, 0); assert.match(page.data.error, /同意/);
});

test('bound WeChat login stores only Texta session data and keeps the existing account identity', async () => {
  const env = setup(), page = env.page('auth/auth.js'); ready(page); env.app.globalData.currentArticle = { private: true };
  wx.login = options => options.success({ code: 'fresh-wechat-code' });
  env.handle(options => options.success({ statusCode: 200, data: options.url.endsWith('/wechat/login')
    ? { token: 'texta-token', user: { id: 'same-email-account', email: 'learner@example.com' }, expiresAt: Date.now() + 60000, session_key: 'must-not-store', openid: 'must-not-store' }
    : { favorites: [], notebookEntries: [], vocabPrefs: {}, libraryFolders: [] } }));
  await page.wechatLogin();
  assert.equal(env.api.session().user.id, 'same-email-account'); assert.equal(env.api.session().openid, undefined); assert.equal(env.api.session().session_key, undefined);
  assert.deepEqual(env.requests[0].data, { code: 'fresh-wechat-code' }); assert.equal(env.requests[0].header.Authorization, undefined);
  assert.equal(env.app.globalData.currentArticle, null); assert.ok(env.navigation.includes('back')); assert.equal(page.data.loading, false);
});

test('first WeChat login enters directly without email authentication or binding', async () => {
  const env = setup(), page = env.page('auth/auth.js'); ready(page);
  wx.login = options => options.success({ code: 'fresh-code' });
  env.handle(options => options.success({ statusCode: 200, data: options.url.endsWith('/wechat/login')
    ? { ok: true, created: true, token: 'wechat-session', user: { id: 'wechat-new', email: '', name: '微信用户' }, expiresAt: Date.now() + 60000 }
    : { favorites: [], notebookEntries: [], vocabPrefs: {}, libraryFolders: [] } }));
  await page.wechatLogin();
  assert.equal(env.api.session().user.id, 'wechat-new'); assert.equal(page.data.bindingNeeded, false);
  assert.equal(page.data.emailExpanded, false); assert.ok(env.navigation.includes('back'));
  assert.ok(env.requests.every(row => !row.url.endsWith('/auth/login') && !row.url.endsWith('/wechat/bind')));
  assert.ok([...env.storage.values()].every(value => !JSON.stringify(value).includes('fresh-code')));
});

test('failed binding preserves the authenticated account and unsynced learning records', async () => {
  const env = setup(); env.login('existing'); env.library.addWord({ word: 'journey' });
  const page = env.page('auth/auth.js'); ready(page); page.setData({ bindingNeeded: true, bindingUser: env.api.session().user });
  const before = JSON.stringify(env.library.read());
  wx.login = options => options.success({ code: 'fresh-code' });
  env.handle(options => options.success({ statusCode: 409, data: { error: '已有其他绑定' } }));
  await page.bindWechat();
  assert.equal(env.api.session().user.id, 'existing'); assert.equal(JSON.stringify(env.library.read()), before);
  assert.equal(env.navigation.length, 0); assert.match(page.data.error, /其他绑定/); assert.equal(page.data.loading, false);
});

test('account switching during wx.login stops binding before any request', async () => {
  const env = setup(); env.login('alice'); const page = env.page('auth/auth.js'); ready(page);
  page.setData({ bindingNeeded: true, bindingUser: env.api.session().user });
  let pending; wx.login = options => { pending = options; };
  const task = page.bindWechat(); env.login('bob'); pending.success({ code: 'old-account-code' }); await task;
  assert.equal(env.requests.length, 0); assert.equal(env.api.session().user.id, 'bob'); assert.match(page.data.error, /状态已改变/);
});

test('duplicate taps and native login failure never send multiple or incomplete requests', async () => {
  const env = setup(), page = env.page('auth/auth.js'); ready(page); let calls = 0, pending;
  wx.login = options => { calls++; pending = options; };
  const first = page.wechatLogin(); await page.wechatLogin(); assert.equal(calls, 1);
  pending.fail({ errMsg: 'login:fail' }); await first;
  assert.equal(env.requests.length, 0); assert.equal(page.data.loading, false); assert.match(page.data.error, /凭证/);
});

test('capability failure keeps email login usable and does not advertise active WeChat login', async () => {
  const env = setup(), page = env.page('auth/auth.js');
  env.handle(options => options.success({ statusCode: 404, data: {} })); await page.loadWechat();
  assert.equal(page.data.wechatReady, false); assert.equal(page.data.wechatChecking, false);
  credentials(page); page.setData({ agreed: true });
  env.handle(options => options.success({ statusCode: 200, data: options.url.endsWith('/auth/login')
    ? { token: 'email-token', user: { id: 'existing' }, expiresAt: Date.now() + 60000 } : {} }));
  await page.submit(); assert.equal(env.api.signedIn(), true); assert.equal(env.api.session().user.id, 'existing'); await flush();
});

test('a late WeChat login response cannot replace a newer account session', async () => {
  const env = setup(), page = env.page('auth/auth.js'); ready(page);
  wx.login = options => options.success({ code: 'old-code' });
  let request; env.handle(options => { request = options; });
  const task = page.wechatLogin(); await flush(); env.login('new-account');
  request.success({ statusCode: 200, data: { token: 'old-response', user: { id: 'old-account' } } }); await task;
  assert.equal(env.api.session().user.id, 'new-account'); assert.equal(env.navigation.length, 0); assert.match(page.data.error, /状态已改变/);
});

function emailSettings(env) {
  env.api.saveSession({ token: 'wechat-token', user: { id: 'wechat-user', email: '', plan: 'pro' }, expiresAt: Date.now() + 60000 });
  const page = env.page('auth/auth.js');
  page.setData({ emailBinding: true, bindingUser: env.api.session().user, agreed: true, email: 'learner@example.com', password: 'secure-password', passwordConfirm: 'secure-password' });
  return page;
}
test('settings add email to the same account without changing its token or learning records', async () => {
  const env = setup(), page = emailSettings(env); env.library.addWord({ word: 'journey' });
  const before = JSON.stringify(env.library.read());
  env.handle(options => options.success({ statusCode: 200, data: { ok: true, user: { id: 'wechat-user', email: 'learner@example.com', plan: 'pro' } } }));
  await page.bindEmail();
  const binding = env.requests.find(row => row.url.endsWith('/wechat/email'));
  assert.equal(binding.header.Authorization, 'Bearer wechat-token');
  assert.deepEqual(binding.data, { email: 'learner@example.com', password: 'secure-password' });
  assert.equal(env.api.session().token, 'wechat-token'); assert.equal(env.api.session().user.id, 'wechat-user');
  assert.equal(env.api.session().user.plan, 'pro'); assert.equal(JSON.stringify(env.library.read()), before);
  assert.equal(page.data.password, ''); assert.equal(page.data.passwordConfirm, '');
  assert.ok([...env.storage.values()].every(value => !JSON.stringify(value).includes('secure-password')));
});
test('email settings validate confirmation and preserve the account when email is taken', async () => {
  const env = setup(), page = emailSettings(env); page.setData({ passwordConfirm: 'different' });
  await page.bindEmail(); assert.equal(env.requests.length, 0); assert.match(page.data.error, /不一致/);
  page.setData({ passwordConfirm: page.data.password });
  env.handle(options => options.success({ statusCode: 409, data: { error: '这个邮箱已有 Texta 账号' } }));
  await page.bindEmail(); assert.equal(env.api.session().user.email, ''); assert.equal(env.api.session().token, 'wechat-token');
  assert.equal(env.navigation.length, 0); assert.match(page.data.error, /已有/);
});
test('a late email settings response cannot overwrite a different account', async () => {
  const env = setup(), page = emailSettings(env); let pending;
  env.handle(options => options.url.endsWith('/wechat/email') ? pending = options : options.success({ statusCode: 200, data: {} })); const task = page.bindEmail(); await flush(); env.login('other');
  pending.success({ statusCode: 200, data: { ok: true, user: { id: 'wechat-user', email: 'learner@example.com' } } }); await task;
  assert.equal(env.api.session().user.id, 'other'); assert.equal(env.navigation.length, 0); assert.match(page.data.error, /状态已改变/);
});
test('profile opens email settings only for a signed-in account without email', () => {
  const env = setup(); emailSettings(env); const page = env.page('profile/profile.js'); page.bindEmail();
  assert.deepEqual(env.navigation, ['/pages/auth/auth?bind=email']); env.login('already-email'); page.bindEmail();
  assert.equal(env.navigation.length, 1);
});

test('existing email association migrates local history and enters only the server-confirmed target account', async () => {
  const env = setup(), page = emailSettings(env); page.setData({ emailMode: 'existing', passwordConfirm: '' });
  env.library.addWord({ word: 'journey' }); env.library.addHistory({ id: 'source-history', article: 'source' });
  env.storage.set('texta_history_email-owner', [{ id: 'target-history', article: 'target' }]);
  env.handle(options => options.success({ statusCode: 200, data: options.url.endsWith('/wechat/email')
    ? { ok: true, merged: true, mergedFrom: 'wechat-user', token: 'target-token', expiresAt: Date.now() + 60000, user: { id: 'email-owner', email: 'learner@example.com', plan: 'pro' } }
    : { favorites: [], notebookEntries: [], vocabPrefs: {}, libraryFolders: [] } }));
  await page.bindEmail(); await flush();
  const binding = env.requests.find(row => row.url.endsWith('/wechat/email'));
  assert.equal(binding.data.mergeExisting, true); assert.equal(binding.header.Authorization, 'Bearer wechat-token');
  assert.equal(env.api.session().token, 'target-token'); assert.equal(env.api.session().user.id, 'email-owner');
  assert.equal(env.library.history().length, 2); assert.ok(env.library.read().notebookEntries.some(row => row.word === 'journey'));
  assert.ok(env.requests.findIndex(row => row.url.endsWith('/library/sync')) < env.requests.findIndex(row => row === binding));
});
test('a failed pre-merge sync does not submit credentials or move local records to another account', async () => {
  const env = setup(), page = emailSettings(env); page.setData({ emailMode: 'existing' }); env.library.addWord({ word: 'journey' });
  env.handle(options => options.success({ statusCode: 503, data: { error: '资料同步暂时失败' } }));
  await page.bindEmail(); assert.ok(!env.requests.some(row => row.url.endsWith('/wechat/email')));
  assert.equal(env.api.session().user.id, 'wechat-user'); assert.equal(env.library.read().dirty, true); assert.equal(env.navigation.length, 0);
});
test('a forged merge response cannot silently change accounts', async () => {
  const env = setup(), page = emailSettings(env); page.setData({ emailMode: 'existing' });
  env.handle(options => options.success({ statusCode: 200, data: options.url.endsWith('/wechat/email')
    ? { ok: true, merged: true, mergedFrom: 'different-account', token: 'unexpected', expiresAt: Date.now() + 60000, user: { id: 'email-owner', email: 'learner@example.com' } }
    : {} }));
  await page.bindEmail(); assert.equal(env.api.session().token, 'wechat-token'); assert.match(page.data.error, /不完整/);
});
