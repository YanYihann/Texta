const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createWechatProvider, registerWechatAuth } = require('../auth/wechat.cjs');
const env = { WECHAT_APP_ID: 'wxc1af567af0505b1e', WECHAT_APP_SECRET: 'test-secret-not-a-real-credential' };

test('provider exchanges only fresh codes at the fixed WeChat HTTPS endpoint and discards session keys', async () => {
  let captured;
  const provider = createWechatProvider(env, async (url, options) => {
    captured = { url, options };
    return { ok: true, json: async () => ({ openid: 'wx-learner', session_key: 'private-key', unionid: 'unused-unionid' }) };
  });
  const result = await provider.exchange('fresh-code');
  assert.equal(captured.url.origin, 'https://api.weixin.qq.com');
  assert.equal(captured.url.pathname, '/sns/jscode2session');
  assert.equal(captured.url.searchParams.get('appid'), env.WECHAT_APP_ID);
  assert.equal(captured.url.searchParams.get('js_code'), 'fresh-code');
  assert.equal(captured.url.searchParams.get('grant_type'), 'authorization_code');
  assert.equal(captured.options.redirect, 'error');
  assert.ok(captured.options.signal);
  assert.deepEqual(result, { appId: env.WECHAT_APP_ID, openId: 'wx-learner' });
});

test('unconfigured, malformed and expired credentials fail without leaking upstream details', async () => {
  let calls = 0;
  const request = async () => { calls++; throw Error('secret URL and code must not escape'); };
  await assert.rejects(createWechatProvider({}, request).exchange('code'), error => error.status === 503);
  const provider = createWechatProvider(env, request);
  for (const value of ['', null, { openid: 'victim' }, 'https://evil.example', 'x'.repeat(257)])
    await assert.rejects(provider.exchange(value), error => error.status === 400);
  assert.equal(calls, 0);
  await assert.rejects(provider.exchange('code'), error => error.status === 502 && !/secret|URL|code/.test(error.message));
  for (const [errcode, status] of [[40029, 400], [40163, 400], [45011, 429], [40125, 503], [-1, 502]]) {
    const p = createWechatProvider(env, async () => ({ ok: true, json: async () => ({ errcode, errmsg: 'sensitive-provider-detail' }) }));
    await assert.rejects(p.exchange('code'), error => error.status === status && !error.message.includes('sensitive-provider-detail'));
  }
  const missing = createWechatProvider(env, async () => ({ ok: true, json: async () => ({ session_key: 'private-key' }) }));
  await assert.rejects(missing.exchange('code'), error => error.status === 502);
});

async function harness() {
  const app = express(); app.use(express.json());
  const users = new Map([
    ['alice', { id: 'alice', email: 'alice@example.invalid', name: 'Alice', plan: 'pro', passwordHash: 'private-hash' }],
    ['bob', { id: 'bob', email: 'bob@example.invalid', name: 'Bob', plan: 'free', passwordHash: 'private-hash' }]
  ]);
  const bindings = [], sessions = []; let exchanges = 0, writes = 0;
  const db = {
    $queryRaw: async () => [],
    user: {
      findUnique: async ({ where }) => where.id ? users.get(where.id) || null : [...users.values()].find(u => u.email === where.email) || null,
      create: async ({ data }) => { if (users.has(data.id)) throw Object.assign(Error('unique'), { code: 'P2002' }); users.set(data.id, { ...data }); return users.get(data.id); },
      updateMany: async ({ where, data }) => {
        const user = users.get(where.id);
        if (!user || user.email !== where.email) return { count: 0 };
        if ([...users.values()].some(u => u.id !== where.id && u.email === data.email)) throw Object.assign(Error('unique'), { code: 'P2002' });
        Object.assign(user, data); return { count: 1 };
      }
    },
    session: { create: async ({ data }) => { sessions.push(data); return data; } },
    wechatIdentity: {
      findUnique: async ({ where }) => {
        const match = where.appId_openId || where.appId_userId;
        return bindings.find(row => Object.entries(match).every(([key, value]) => row[key] === value)) || null;
      },
      create: async ({ data }) => {
        if (bindings.some(row => row.appId === data.appId && (row.openId === data.openId || row.userId === data.userId)))
          throw Object.assign(Error('unique'), { code: 'P2002' });
        writes++; bindings.push({ ...data }); return data;
      }
    }
  };
  let queue = Promise.resolve();
  db.$transaction = work => {
    const task = queue.then(async () => {
      const oldUsers = [...users].map(([id, user]) => [id, { ...user }]), oldBindings = bindings.map(row => ({ ...row }));
      try { return await work(db); }
      catch (error) { users.clear(); oldUsers.forEach(([id, user]) => users.set(id, user)); bindings.splice(0, bindings.length, ...oldBindings); throw error; }
    });
    queue = task.catch(() => {}); return task;
  };
  const provider = { enabled: true, appId: env.WECHAT_APP_ID, exchange: async code => {
    exchanges++;
    if (!code || code === 'expired') throw Object.assign(Error('登录凭证失效'), { status: 400 });
    return { appId: env.WECHAT_APP_ID, openId: code };
  } };
  registerWechatAuth(app, { db, provider, sessionTtlMs: 60000, hashPassword: raw => ({ hash: 'hashed:' + raw }),
    getUserFromToken: async req => users.get(String(req.headers.authorization || '').replace(/^Bearer /, '')) || null,
    publicUser: user => ({ id: user.id, email: user.email, name: user.name, plan: user.plan }) });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  async function call(path, user, body) {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/auth/wechat/' + path, {
      method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: 'Bearer ' + user } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, data: await response.json(), cache: response.headers.get('cache-control') };
  }
  return { call, db, provider, users, bindings, sessions, counts: () => ({ exchanges, writes }), close: () => new Promise(resolve => server.close(resolve)) };
}

test('account connection requires ownership, preserves saved binding when login is paused and never returns provider identifiers', async () => {
  const h = await harness();
  try {
    assert.equal((await h.call('connection')).status, 401);
    assert.equal((await h.call('connection', 'invalid')).status, 401);
    await h.call('bind', 'alice', { code: 'wx-alice' });
    const linked = await h.call('connection', 'alice');
    assert.deepEqual(linked.data, { ok: true, bound: true, loginAvailable: true }); assert.equal(linked.cache, 'no-store');
    assert.equal(JSON.stringify(linked.data).includes('wx-alice'), false);
    assert.equal((await h.call('connection', 'bob')).data.bound, false);
    h.provider.enabled = false;
    assert.deepEqual((await h.call('connection', 'alice')).data, { ok: true, bound: true, loginAvailable: false });
    h.db.wechatIdentity.findUnique = async () => { throw Error('private DB information'); };
    const failed = await h.call('connection', 'alice'); assert.equal(failed.status, 503); assert.equal(failed.data.bound, undefined);
    assert.equal(failed.data.error.includes('private'), false);
  } finally { await h.close(); }
});

test('first login creates one passwordless free account; repeated login ignores supplied account identifiers', async () => {
  const h = await harness();
  try {
    const result = await h.call('login', null, { code: 'wx-alice', openid: 'wx-victim', userId: 'alice', appId: 'different-app' });
    assert.equal(result.data.ok, true); assert.equal(result.data.created, true);
    const id = result.data.user.id;
    assert.notEqual(id, 'alice'); assert.equal(result.data.user.email, null); assert.equal(result.data.user.plan, 'free');
    assert.equal(h.users.get(id).passwordHash, null); assert.equal(h.users.get(id).role, 'user');
    assert.equal(result.cache, 'no-store'); assert.equal(h.sessions.length, 1); assert.equal(h.bindings.length, 1); assert.equal(h.users.size, 3);
    const logged = await h.call('login', null, { code: 'wx-alice', userId: 'bob' });
    assert.equal(logged.data.user.id, id); assert.equal(logged.data.created, false); assert.equal(h.users.size, 3);
    assert.match(logged.data.token, /^tk_[0-9a-f]{48}$/); assert.ok(logged.data.expiresAt > Date.now());
    assert.equal(h.sessions[0].userId, id); assert.equal(typeof h.sessions[0].expiresAt, 'bigint');
    assert.equal(JSON.stringify(logged.data).includes('openid'), false); assert.equal(JSON.stringify(logged.data).includes('private-hash'), false);
    assert.deepEqual(h.bindings[0], { appId: env.WECHAT_APP_ID, openId: 'wx-alice', userId: id });
  } finally { await h.close(); }
});

test('binding requires authenticated ownership and never moves identities between accounts', async () => {
  const h = await harness();
  try {
    assert.equal((await h.call('bind', null, { code: 'wx-alice', userId: 'alice' })).status, 401);
    assert.equal(h.counts().exchanges, 0);
    assert.equal((await h.call('bind', 'alice', { code: 'wx-alice', userId: 'bob' })).status, 200);
    assert.equal((await h.call('bind', 'alice', { code: 'wx-alice' })).status, 200);
    assert.equal((await h.call('bind', 'bob', { code: 'wx-alice' })).status, 409);
    assert.equal((await h.call('bind', 'alice', { code: 'wx-other' })).status, 409);
    assert.equal(h.counts().writes, 1); assert.equal(h.bindings[0].userId, 'alice');
    assert.deepEqual((await h.call('status', 'alice')).data, { enabled: true, bound: true });
    assert.deepEqual((await h.call('status', 'bob')).data, { enabled: true, bound: false });
    assert.deepEqual((await h.call('status')).data, { enabled: true, bound: false });
  } finally { await h.close(); }
});

test('concurrent claims are idempotent for one account and rejected for the other', async () => {
  const h = await harness();
  try {
    const outcomes = await Promise.all(['alice', 'bob'].map(user => h.call('bind', user, { code: 'same-wechat' })));
    assert.deepEqual(outcomes.map(result => result.status).sort(), [200, 409]);
    assert.equal(h.bindings.length, 1);
    const user = h.bindings[0].userId;
    const duplicates = await Promise.all([h.call('bind', user, { code: 'same-wechat' }), h.call('bind', user, { code: 'same-wechat' })]);
    assert.ok(duplicates.every(result => result.status === 200)); assert.equal(h.bindings.length, 1);
  } finally { await h.close(); }
});

test('deleted accounts, disabled configuration and database failures do not issue sessions or leak identifiers', async () => {
  const h = await harness();
  try {
    await h.call('bind', 'alice', { code: 'wx-alice' }); h.users.delete('alice');
    assert.equal((await h.call('login', null, { code: 'wx-alice' })).status, 409); assert.equal(h.sessions.length, 0);
    h.provider.enabled = false;
    assert.deepEqual((await h.call('status', 'bob')).data, { enabled: false, bound: false });
    h.provider.enabled = true;
    h.db.wechatIdentity.findUnique = async () => { throw Error('private DB connection and openid'); };
    const result = await h.call('login', null, { code: 'wx-bob' });
    assert.equal(result.status, 503); assert.equal(result.data.error.includes('private'), false); assert.equal(h.sessions.length, 0);
  } finally { await h.close(); }
});

test('concurrent first logins create only one account and roll back incomplete creation', async () => {
  const h = await harness();
  try {
    const results = await Promise.all([h.call('login', null, { code: 'wx-new' }), h.call('login', null, { code: 'wx-new' })]);
    assert.ok(results.every(r => r.status === 200)); assert.equal(results[0].data.user.id, results[1].data.user.id);
    assert.equal(h.users.size, 3); assert.equal(h.bindings.length, 1);
    h.db.wechatIdentity.create = async () => { throw Error('private database failure'); };
    assert.equal((await h.call('login', null, { code: 'wx-failed' })).status, 503);
    assert.equal(h.users.size, 3); assert.equal(h.bindings.length, 1);
  } finally { await h.close(); }
});

test('optional email credentials preserve the WeChat user ID, plan, sessions and future login', async () => {
  const h = await harness();
  try {
    const first = await h.call('login', null, { code: 'wx-email' }), id = first.data.user.id;
    h.users.get(id).plan = 'pro';
    const originalSession = h.sessions[0];
    const bound = await h.call('email', id, { email: ' Learner@Example.com ', password: 'secure-password', userId: 'alice', role: 'admin' });
    assert.equal(bound.status, 200); assert.equal(bound.data.user.id, id); assert.equal(bound.data.user.email, 'learner@example.com');
    assert.equal(bound.data.user.plan, 'pro'); assert.equal(h.users.get(id).role, 'user');
    assert.equal(h.users.get(id).passwordHash, 'hashed:secure-password'); assert.equal(h.sessions[0], originalSession);
    assert.equal((await h.call('login', null, { code: 'wx-email' })).data.user.id, id);
    assert.equal((await h.call('email', id, { email: 'other@example.com', password: 'another-password' })).status, 409);
    assert.equal(h.users.get(id).email, 'learner@example.com');
  } finally { await h.close(); }
});

test('email binding rejects unauthenticated, non-WeChat, invalid, taken and concurrent claims', async () => {
  const h = await harness();
  try {
    assert.equal((await h.call('email', null, { email: 'new@example.com', password: 'password' })).status, 401);
    assert.equal((await h.call('email', 'bob', { email: 'new@example.com', password: 'password' })).status, 403);
    const id = (await h.call('login', null, { code: 'wx-one' })).data.user.id;
    for (const body of [{ email: 'invalid', password: 'password' }, { email: 'new@example.com', password: 'short' }])
      assert.equal((await h.call('email', id, body)).status, 400);
    assert.equal((await h.call('email', id, { email: 'alice@example.invalid', password: 'password' })).status, 409);
    assert.equal(h.users.get(id).email, null); assert.equal(h.users.get('alice').plan, 'pro');
    const id2 = (await h.call('login', null, { code: 'wx-two' })).data.user.id;
    const results = await Promise.all([id, id2].map(user => h.call('email', user, { email: 'same@example.com', password: 'password' })));
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    assert.equal([...h.users.values()].filter(u => u.email === 'same@example.com').length, 1);
  } finally { await h.close(); }
});
