const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { registerWechatAuth } = require('../auth/wechat.cjs');
const { reserveCredits, refundCredits } = require('../billing/credits.cjs');
const { createBilling } = require('../billing/service.cjs');
const appId = 'wxc1af567af0505b1e';
const early = '2026-10-01T00:00:00.000Z', late = '2026-10-07T00:00:00.000Z';

async function harness() {
  let state = {
    user: [{ id: 'wx', email: null, role: 'user', plan: 'free', name: '微信用户' },
      { id: 'email', email: 'owner@example.com', passwordHash: 'owner-hash', role: 'user', plan: 'pro', permanentPlan: 'plus', planExpiresAt: new Date('2027-01-01'), name: 'Original' }],
    wechatIdentity: [{ id: 'identity', appId, openId: 'current-wechat', userId: 'wx' }],
    session: [{ token: 'wx-token', userId: 'wx', expiresAt: BigInt(Date.now() + 60000) }, { token: 'wx-old', userId: 'wx' }, { token: 'email-token', userId: 'email' }],
    libraryFolder: [{ id: 'wx__folder', userId: 'wx', name: '微信收藏', updatedAt: late }],
    favoriteArticle: [{ id: 'wx__article', userId: 'wx', folderId: 'folder', article: 'Source reading', updatedAt: late }, { id: 'email__other', userId: 'email', article: 'Email reading', updatedAt: early }],
    notebookEntry: [{ id: 'wx-word', userId: 'wx', wordKey: 'journey', deletedAt: late, createdAt: early, updatedAt: late }, { id: 'email-word', userId: 'email', wordKey: 'journey', deletedAt: '', createdAt: late, updatedAt: early }],
    userVocabPref: [{ id: 'wx-pref', userId: 'wx', wordKey: 'journey', mastery: 'mastered', createdAt: early, updatedAt: late }, { id: 'email-pref', userId: 'email', wordKey: 'journey', mastery: 'unknown', createdAt: late, updatedAt: early }],
    usageDaily: [{ id: 'wx-day', userId: 'wx', dateKey: '2026-10-07', used: 2 }, { id: 'email-day', userId: 'email', dateKey: '2026-10-07', used: 4 }],
    usageLog: [{ id: 'usage', userId: 'wx' }], vipRequest: [{ id: 'legacy', userId: 'wx' }], paymentOrder: []
  };
  let failModel = '', retry = false, transactions = 0;
  function match(row, where) {
    return Object.entries(where || {}).every(([key, value]) => {
      if (key.includes('_')) return match(row, value);
      if (value && typeof value === 'object') return (value.lte === undefined || row[key] <= value.lte) && (value.gte === undefined || row[key] >= value.gte);
      return row[key] === value;
    });
  }
  function change(row, data) { for (const [key, value] of Object.entries(data)) row[key] = value?.increment !== undefined ? (row[key] || 0) + value.increment : value?.decrement !== undefined ? row[key] - value.decrement : value; }
  function models(data) {
    const models = {};
    for (const name of Object.keys(data)) models[name] = {
      findUnique: async ({ where }) => data[name].find(row => match(row, where)) || null,
      findMany: async ({ where }) => data[name].filter(row => match(row, where)),
      count: async ({ where }) => data[name].filter(row => match(row, where)).length,
      create: async ({ data: row }) => { if (name === failModel) throw Error('private DB failure'); data[name].push({ ...row }); return data[name].at(-1); },
      update: async ({ where, data: values }) => { const row = data[name].find(row => match(row, where)); if (!row) throw Error('missing row'); change(row, values); return row; },
      updateMany: async ({ where, data: values }) => { const rows = data[name].filter(row => match(row, where)); rows.forEach(row => change(row, values)); return { count: rows.length }; },
      deleteMany: async ({ where }) => { const size = data[name].length; data[name] = data[name].filter(row => !match(row, where)); return { count: size - data[name].length }; },
      upsert: async ({ where, create, update }) => { let row = data[name].find(row => match(row, where)); if (row) change(row, update); else { row = { ...create }; data[name].push(row); } return row; }
    };
    models.$queryRaw = async () => [];
    return models;
  }
  const db = {};
  for (const model of Object.keys(state)) db[model] = Object.fromEntries(Object.keys(models(state)[model]).map(method => [method, args => models(state)[model][method](args)]));
  let queue = Promise.resolve();
  db.$transaction = (work, options) => {
    assert.equal(options?.isolationLevel, 'Serializable');
    const result = queue.then(async () => {
      transactions++; if (retry) { retry = false; throw Object.assign(Error('retry'), { code: 'P2034' }); }
      const copy = structuredClone(state), result = await work(models(copy)); state = copy; return result;
    });
    queue = result.catch(() => {}); return result;
  };
  const app = express(); app.use(express.json());
  registerWechatAuth(app, { db, provider: { enabled: true, appId, exchange: async () => ({ appId, openId: 'current-wechat' }) },
    getUserFromToken: async req => {
      const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
      const session = state.session.find(row => row.token === token);
      return session && state.user.find(user => user.id === session.userId && !user.mergedIntoId) || null;
    }, hashPassword: () => ({ hash: 'new-hash' }), verifyPassword: (raw, hash) => raw === 'original-password' && hash === 'owner-hash',
    publicUser: user => ({ id: user.id, email: user.email, name: user.name, plan: user.plan }), sessionTtlMs: 60000 });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  async function call(body, token = 'wx-token', route = 'email') {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/auth/wechat/' + route, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  return { db, call, state: () => state, fail: name => { failModel = name; }, retry: () => { retry = true; }, transactions: () => transactions,
    close: () => new Promise(resolve => server.close(resolve)) };
}
const request = { email: 'owner@example.com', password: 'original-password', mergeExisting: true };

test('existing-email merge proves password ownership and rate-limits failures without modifying data', async () => {
  const h = await harness();
  try {
    const before = structuredClone(h.state());
    assert.equal((await h.call({ ...request, mergeExisting: false })).status, 409);
    for (let i = 0; i < 5; i++) assert.equal((await h.call({ ...request, password: 'wrong-password' })).status, 400);
    assert.equal((await h.call(request)).status, 429); assert.deepEqual(h.state(), before);
    assert.equal((await h.call(request, 'unrelated-token')).status, 401);
  } finally { await h.close(); }
});

test('merge keeps existing paid plan, unions learning data, sums usage, transfers identity and revokes old source sessions', async () => {
  const h = await harness();
  try {
    const target = structuredClone(h.state().user[1]);
    const result = await h.call({ ...request, userId: 'victim', role: 'admin' });
    assert.equal(result.status, 200); assert.equal(result.data.merged, true); assert.equal(result.data.user.id, 'email');
    assert.equal(result.data.mergedFrom, 'wx'); assert.match(result.data.token, /^tk_[a-f0-9]{48}$/);
    const s = h.state();
    for (const field of ['plan', 'permanentPlan', 'planExpiresAt', 'passwordHash', 'role', 'email']) assert.deepEqual(s.user[1][field], target[field]);
    assert.equal(s.favoriteArticle.length, 2); assert.equal(s.favoriteArticle[0].userId, 'email');
    assert.equal(s.libraryFolder[0].id, 'email__folder'); assert.ok(s.favoriteArticle.some(row => row.id === 'email__article' && row.folderId === 'folder'));
    assert.equal(s.notebookEntry.length, 1); assert.equal(s.notebookEntry[0].deletedAt, late); assert.equal(s.notebookEntry[0].createdAt, early);
    assert.equal(s.userVocabPref[0].mastery, 'mastered'); assert.equal(s.usageDaily.length, 1); assert.equal(s.usageDaily[0].used, 6);
    assert.equal(s.usageLog[0].userId, 'email'); assert.equal(s.vipRequest[0].userEmail, 'owner@example.com');
    assert.equal(s.wechatIdentity[0].userId, 'email'); assert.equal(s.user[0].mergedIntoId, 'email'); assert.equal(s.user[1].libraryMergeProtected, true);
    assert.ok(!s.session.some(row => row.userId === 'wx')); assert.ok(s.session.some(row => row.token === 'email-token'));
    assert.equal((await h.call(request)).status, 401);
    assert.equal((await h.call({ code: 'fresh-code' }, result.data.token, 'login')).data.user.id, 'email');
    assert.ok(!JSON.stringify(result.data).includes('owner-hash')); assert.ok(!JSON.stringify(result.data).includes('openid'));
  } finally { await h.close(); }
});

test('conflicting WeChat identity or paid source prevents automatic merge and preserves both accounts', async () => {
  for (const kind of ['identity', 'plan', 'order']) {
    const h = await harness();
    try {
      if (kind === 'identity') h.state().wechatIdentity.push({ id: 'other', userId: 'email', appId, openId: 'different-wechat' });
      if (kind === 'plan') h.state().user[0].plan = 'plus';
      if (kind === 'order') h.state().paymentOrder.push({ id: 'order', userId: 'wx' });
      const before = structuredClone(h.state()); assert.equal((await h.call(request)).status, 409); assert.deepEqual(h.state(), before);
    } finally { await h.close(); }
  }
});

test('partial data-copy failures roll back the entire merge and serialization conflicts retry', async () => {
  const h = await harness();
  try {
    const before = structuredClone(h.state()); h.fail('favoriteArticle');
    assert.equal((await h.call(request)).status, 503); assert.deepEqual(h.state(), before);
    h.fail(''); h.retry(); const start = h.transactions(); assert.equal((await h.call(request)).status, 200);
    assert.equal(h.transactions() - start, 2);
  } finally { await h.close(); }
});

test('retired-account reservations stop and late refunds follow the migrated usage balance', async () => {
  const h = await harness();
  try {
    const reservation = await reserveCredits(h.db, h.state().user[0], '2026-10-07', 1); assert.ok(reservation);
    assert.equal((await h.call(request)).status, 200); assert.equal(h.state().usageDaily[0].used, 7);
    assert.equal(await reserveCredits(h.db, h.state().user[0], '2026-10-07', 1), null);
    const billing = createBilling({ db: h.db, provider: { enabled: true } });
    assert.match((await billing.checkout('wx', 'plus_monthly', 'retired-request-key')).error, /重新登录/);
    assert.equal(h.state().paymentOrder.length, 0);
    await refundCredits(h.db, reservation); assert.equal(h.state().usageDaily[0].used, 6);
  } finally { await h.close(); }
});
