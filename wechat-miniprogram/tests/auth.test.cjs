const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers.cjs');
function fill(page) { page.setData({ email: 'learner@example.com', password: 'valid-password', agreed: true }); }
test('successful login saves only token and public profile, clears old reading context and returns to caller', async () => {
  const env = setup(), page = env.page('auth/auth.js'); fill(page); env.app.globalData.currentArticle = { article: 'old account' };
  env.handle(options => options.success({ statusCode: 200, data: options.url.endsWith('/api/auth/login')
    ? { token: 'session-token', user: { id: 'learner', name: 'Learner' }, expiresAt: Date.now() + 100000 }
    : { favorites: [], notebookEntries: [], vocabPrefs: {}, libraryFolders: [] } }));
  await page.submit();
  assert.equal(env.api.session().user.id, 'learner'); assert.equal(env.api.session().password, undefined);
  assert.equal(page.data.password, ''); assert.equal(page.data.loading, false); assert.equal(env.app.globalData.currentArticle, null);
  assert.ok(env.navigation.includes('back'));
});
test('registration performs register then login, not an invented automatic session', async () => {
  const env = setup(), page = env.page('auth/auth.js'); fill(page); page.setData({ mode: 'register', name: 'Learner' });
  env.handle(options => options.success({ statusCode: options.url.endsWith('/register') ? 201 : 200,
    data: options.url.endsWith('/login') ? { token: 'session', user: { id: 'learner' } } : { ok: true } }));
  await page.submit();
  assert.deepEqual(env.requests.slice(0, 2).map(row => row.url.split('/').pop()), ['register', 'login']);
  assert.equal(env.requests[0].data.name, 'Learner'); assert.equal(env.api.signedIn(), true);
});
test('registration success followed by login failure offers login without re-registering', async () => {
  const env = setup(), page = env.page('auth/auth.js'); fill(page); page.setData({ mode: 'register' });
  env.handle(options => options.success({ statusCode: options.url.endsWith('/register') ? 201 : 503, data: { error: 'Failed to login.' } }));
  await page.submit(); assert.equal(page.data.mode, 'login'); assert.match(page.data.error, /已注册成功/);
  assert.equal(env.api.signedIn(), false);
});
test('terms consent is required before any login request', async () => {
  const env = setup(), page = env.page('auth/auth.js'); fill(page); page.setData({ agreed: false });
  await page.submit(); assert.equal(env.requests.length, 0); assert.match(page.data.error, /同意/);
});
test('incomplete login responses never create an unusable session', async () => {
  const env = setup(), page = env.page('auth/auth.js'); fill(page);
  env.handle(options => options.success({ statusCode: 200, data: { token: 'token-without-user' } }));
  await page.submit(); assert.equal(env.api.signedIn(), false); assert.match(page.data.error, /不完整/);
});
test('logout clears session and result while retaining isolated unsynced learning records', async () => {
  const env = setup(); env.login(); env.library.addWord({ word: 'journey' }); env.app.globalData.currentArticle = { article: 'private' };
  const page = env.page('profile/profile.js'); page.logout(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(env.api.signedIn(), false); assert.equal(env.app.globalData.currentArticle, null);
  assert.equal(env.library.read().notebookEntries.length, 0); env.login(); assert.equal(env.library.read().notebookEntries.length, 1);
});
