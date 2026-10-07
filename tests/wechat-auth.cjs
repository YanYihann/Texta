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
    user: { findUnique: async ({ where }) => users.get(where.id) || null },
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
  const provider = { enabled: true, appId: env.WECHAT_APP_ID, exchange: async code => {
    exchanges++;
    if (!code || code === 'expired') throw Object.assign(Error('登录凭证失效'), { status: 400 });
    return { appId: env.WECHAT_APP_ID, openId: code };
  } };
  registerWechatAuth(app, { db, provider, sessionTtlMs: 60000,
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

test('unbound login cannot create accounts, sessions or use client-supplied identifiers', async () => {
  const h = await harness();
  try {
    const result = await h.call('login', null, { code: 'wx-alice', openid: 'wx-victim', userId: 'alice', appId: 'different-app' });
    assert.deepEqual(result.data, { ok: true, bindingRequired: true });
    assert.equal(result.cache, 'no-store'); assert.equal(h.sessions.length, 0); assert.equal(h.bindings.length, 0); assert.equal(h.users.size, 2);
    await h.call('bind', 'alice', { code: 'wx-alice' });
    const logged = await h.call('login', null, { code: 'wx-alice', userId: 'bob' });
    assert.equal(logged.data.user.id, 'alice'); assert.equal(logged.data.user.plan, 'pro');
    assert.match(logged.data.token, /^tk_[0-9a-f]{48}$/); assert.ok(logged.data.expiresAt > Date.now());
    assert.equal(h.sessions[0].userId, 'alice'); assert.equal(typeof h.sessions[0].expiresAt, 'bigint');
    assert.equal(JSON.stringify(logged.data).includes('openid'), false); assert.equal(JSON.stringify(logged.data).includes('private-hash'), false);
    assert.deepEqual(h.bindings[0], { appId: env.WECHAT_APP_ID, openId: 'wx-alice', userId: 'alice' });
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
