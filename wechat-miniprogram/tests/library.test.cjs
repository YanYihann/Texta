const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers.cjs');
const stamp = '2026-10-06T12:00:00.000Z';

test('sync pulls before replacing snapshot and preserves cloud articles, words, folders and mastery', async () => {
  const env = setup(); env.login();
  const remote = { favorites: [{ id: 'web-article', article: 'Cloud content', updatedAt: stamp }],
    notebookEntries: [{ id: 'web-word', key: 'cloud', word: 'cloud', updatedAt: stamp }],
    libraryFolders: [{ id: 'web-folder', name: 'IELTS', updatedAt: stamp }], vocabPrefs: { cloud: { mastery: 'mastered', updatedAt: stamp } } };
  env.library.addWord({ word: 'journey', baseMeanings: ['旅程'] });
  env.handle(options => options.success({ statusCode: 200, data: options.method === 'GET' ? remote : { ok: true } }));
  await env.library.sync();
  assert.deepEqual(env.requests.map(row => row.method), ['GET', 'POST']);
  const sent = env.requests[1].data;
  assert.equal(sent.favorites[0].article, 'Cloud content'); assert.equal(sent.notebookEntries.length, 2);
  assert.equal(sent.libraryFolders[0].name, 'IELTS'); assert.equal(sent.vocabPrefs.cloud.mastery, 'mastered');
  assert.equal(env.library.read().dirty, false);
});
test('failed initial pull never sends a replacement and keeps local changes', async () => {
  const env = setup(); env.login(); env.library.addWord({ word: 'journey' });
  env.handle(options => options.fail({ errMsg: 'request:fail network' }));
  await assert.rejects(env.library.sync(), /连接失败/);
  assert.equal(env.requests.length, 1); assert.equal(env.library.read().dirty, true);
  assert.equal(env.library.read().notebookEntries[0].word, 'journey');
});
test('failed push retains merged cloud collections and pending flag', async () => {
  const env = setup(); env.login(); env.library.addWord({ word: 'journey' });
  env.handle(options => options.success({ statusCode: options.method === 'GET' ? 200 : 500,
    data: options.method === 'GET' ? { favorites: [{ id: 'web', updatedAt: stamp }] } : { error: 'Failed to sync library.' } }));
  await assert.rejects(env.library.sync(), /本地修改已保留/);
  assert.equal(env.library.read().dirty, true); assert.equal(env.library.read().favorites[0].id, 'web');
});
test('deletion tombstones win over older cloud rows', async () => {
  const env = setup(); env.login(); env.library.addWord({ word: 'journey' });
  const old = env.library.read().notebookEntries[0]; env.library.remove('word', 'journey');
  env.handle(options => options.success({ statusCode: 200, data: options.method === 'GET' ? { notebookEntries: [Object.assign({}, old, { updatedAt: '2020-01-01' })] } : {} }));
  await env.library.sync(); assert.ok(env.requests[1].data.notebookEntries[0].deletedAt);
});
test('mutations while a push is in flight remain pending for the next sync', async () => {
  const env = setup(); env.login(); env.library.addWord({ word: 'journey' }); let push;
  env.handle(options => options.method === 'GET' ? options.success({ statusCode: 200, data: {} }) : push = options);
  const task = env.library.sync(); await new Promise(resolve => setImmediate(resolve));
  env.library.addWord({ word: 'discover' }); push.success({ statusCode: 200, data: {} }); await task;
  assert.equal(env.library.read().dirty, true); assert.equal(env.library.read().notebookEntries.length, 2);
  env.handle(options => options.success({ statusCode: 200, data: {} })); await env.library.sync();
  assert.equal(env.requests.at(-1).data.notebookEntries.length, 2); assert.equal(env.library.read().dirty, false);
});
test('account switching during pull cannot upload the previous account data', async () => {
  const env = setup(); env.login('a'); env.library.addWord({ word: 'private' }); let pull;
  env.handle(options => { pull = options; }); const task = env.library.sync(); env.login('b');
  pull.success({ statusCode: 200, data: {} }); await assert.rejects(task, /账号已切换/);
  assert.equal(env.requests.length, 1); assert.equal(env.library.read().notebookEntries.length, 0);
  env.login('a'); assert.equal(env.library.read().notebookEntries[0].word, 'private');
});
test('history and current result are isolated by account', () => {
  const env = setup(); env.login('a'); env.library.addHistory({ id: 'private', article: 'Secret', words: [] });
  env.login('b'); assert.equal(env.library.history().length, 0); assert.equal(env.library.articleById('private'), null);
  env.api.clearSession(); assert.equal(env.library.history().length, 0);
});
test('oversized snapshots are rejected instead of silently truncating existing cloud data', async () => {
  const env = setup(); env.login(); env.library.saveArticle({ id: 'new', title: 'New', article: 'Text' });
  env.handle(options => options.success({ statusCode: 200, data: { favorites: Array.from({ length: 200 }, (_, i) => ({ id: 'old-' + i, updatedAt: stamp })) } }));
  await assert.rejects(env.library.sync(), /同步上限/); assert.equal(env.requests.length, 1); assert.equal(env.library.read().dirty, true);
});
