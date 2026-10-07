const crypto = require('node:crypto');
const { mergeWechatAccount } = require('./merge.cjs');
const { transaction } = require('../billing/service.cjs');

function problem(status, message) { return Object.assign(new Error(message), { status }); }

function createWechatProvider(env = process.env, request = fetch) {
  const appId = String(env.WECHAT_APP_ID || '').trim();
  const secret = String(env.WECHAT_APP_SECRET || '').trim();
  const enabled = /^wx[a-f0-9]{16}$/i.test(appId) && Boolean(secret);
  async function exchange(code) {
    if (!enabled) throw problem(503, '微信登录暂未启用，请使用邮箱登录。');
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(code))
      throw problem(400, '微信登录凭证无效，请重新点击微信登录。');
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    url.search = new URLSearchParams({ appid: appId, secret, js_code: code, grant_type: 'authorization_code' });
    let data;
    try {
      const response = await request(url, { signal: AbortSignal.timeout(10000), redirect: 'error' });
      if (!response.ok) throw new Error('Upstream unavailable');
      data = await response.json();
    } catch (_) { throw problem(502, '暂时无法连接微信登录服务，请稍后重试。'); }
    if (data?.errcode) {
      if ([40029, 40163, 40226].includes(Number(data.errcode)))
        throw problem(400, '微信登录凭证已失效，请重新点击微信登录。');
      if (Number(data.errcode) === 45011) throw problem(429, '微信登录过于频繁，请稍后重试。');
      if ([40013, 40125, 40164].includes(Number(data.errcode)))
        throw problem(503, '微信登录配置暂不可用，请使用邮箱登录并联系开发者。');
      throw problem(502, '微信登录服务暂不可用，请稍后重试。');
    }
    if (typeof data?.openid !== 'string' || !data.openid || data.openid.length > 128)
      throw problem(502, '微信登录结果不完整，请重新点击微信登录。');
    // Only the validated identifier leaves this function; session_key is never stored or returned.
    return { appId, openId: data.openid };
  }
  return { enabled, appId, exchange };
}

function registerWechatAuth(app, { db, provider, getUserFromToken, publicUser, hashPassword, verifyPassword, sessionTtlMs }) {
  const failures = new Map();
  function failure(res, error) {
    // Never expose provider messages, request URLs, codes, openids, or credentials in errors/logs.
    const known = Number.isInteger(error.status) && error.status >= 400 && error.status < 600;
    res.status(known ? error.status : 503).json({ error: known ? error.message : '微信登录暂时不可用，请稍后重试。' });
  }
  app.get('/api/auth/wechat/status', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      if (!provider.enabled) return res.json({ enabled: false, bound: false });
      const user = await getUserFromToken(req);
      const identity = user ? await db.wechatIdentity.findUnique({ where: { appId_userId: { appId: provider.appId, userId: user.id } } }) : null;
      res.json({ enabled: true, bound: Boolean(identity) });
    } catch (_) { res.json({ enabled: false, bound: false }); }
  });
  app.post('/api/auth/wechat/login', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const identity = await provider.exchange(req.body?.code);
      let binding = await db.wechatIdentity.findUnique({ where: { appId_openId: identity } });
      let created = false;
      if (!binding) {
        try {
          binding = await db.$transaction(async tx => {
            const user = await tx.user.create({ data: {
              id: 'u_' + crypto.randomBytes(16).toString('hex'), email: null, passwordHash: null,
              name: '微信用户', role: 'user', plan: 'free', permanentPlan: 'free', createdAt: new Date().toISOString()
            } });
            return tx.wechatIdentity.create({ data: { ...identity, userId: user.id } });
          });
          created = true;
        } catch (error) {
          // Concurrent first logins roll back the losing account, then use the single winner.
          if (error.code !== 'P2002') throw error;
          binding = await db.wechatIdentity.findUnique({ where: { appId_openId: identity } });
          if (!binding) throw error;
        }
      }
      const result = await transaction(db, async tx => {
        const currentBinding = await tx.wechatIdentity.findUnique({ where: { appId_openId: identity } });
        if (!currentBinding) throw problem(409, '微信身份已改变，请重新登录。');
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${currentBinding.userId} FOR UPDATE`;
        const user = await tx.user.findUnique({ where: { id: currentBinding.userId } });
        if (!user || user.mergedIntoId) throw problem(409, '绑定的账号已改变，请重新点击微信登录。');
        const token = 'tk_' + crypto.randomBytes(24).toString('hex');
        const expiresAt = Date.now() + sessionTtlMs;
        await tx.session.create({ data: { token, userId: user.id, expiresAt: BigInt(expiresAt), createdAt: BigInt(Date.now()) } });
        return { token, user: publicUser(user), expiresAt };
      });
      res.json({ ok: true, ...result, created });
    } catch (error) { failure(res, error); }
  });
  app.post('/api/auth/wechat/email', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const user = await getUserFromToken(req);
      if (!user) throw problem(401, 'Unauthorized.');
      const identity = await db.wechatIdentity.findUnique({ where: { appId_userId: { appId: provider.appId, userId: user.id } } });
      if (!identity) throw problem(403, '请先使用微信登录，再绑定邮箱。');
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw problem(400, '请输入有效的邮箱地址。');
      if (password.length < 6 || password.length > 200) throw problem(400, '密码需要 6 至 200 位。');
      // New credentials are added in place. An explicit merge proves the existing password
      // before transferring a passwordless WeChat identity and its learning records.
      const result = await transaction(db, async tx => {
        const source = await tx.user.findUnique({ where: { id: user.id } });
        if (!source || source.email || source.mergedIntoId) throw problem(409, '账号状态已改变，请刷新账号页面。');
        const existing = await tx.user.findUnique({ where: { email } });
        if (existing) {
          if (req.body.mergeExisting !== true) throw problem(409, '这个邮箱已有账号，请选择“关联已有账号”并输入原密码。');
          const recent = failures.get(user.id);
          if (recent && recent.until > Date.now() && recent.count >= 5) throw problem(429, '密码验证过于频繁，请 15 分钟后重试。');
          if (!verifyPassword(password, existing.passwordHash)) {
            if (failures.size > 5000) for (const [id, value] of failures) if (value.until <= Date.now()) failures.delete(id);
            failures.set(user.id, { count: recent && recent.until > Date.now() ? recent.count + 1 : 1, until: recent && recent.until > Date.now() ? recent.until : Date.now() + 900000 });
            throw problem(400, '邮箱或原账号密码不正确，未进行合并。');
          }
          // The locked transaction rereads both accounts and their identities before moving data.
          const merged = await mergeWechatAccount(tx, source, existing, provider.appId, sessionTtlMs);
          failures.delete(user.id); return { ...merged, merged: true };
        }
        if (req.body.mergeExisting === true) throw problem(400, '邮箱或原账号密码不正确，未进行合并。');
        const result = await tx.user.updateMany({ where: { id: user.id, email: null }, data: { email, passwordHash: hashPassword(password).hash } });
        if (result.count !== 1) throw problem(409, '账号已绑定邮箱，请刷新账号页面。');
        return { user: await tx.user.findUnique({ where: { id: user.id } }), merged: false };
      }, { timeout: 60000, maxWait: 10000 });
      res.json({ ok: true, user: publicUser(result.user), merged: result.merged,
        ...(result.merged ? { token: result.token, expiresAt: result.expiresAt, mergedFrom: result.mergedFrom } : {}) });
    } catch (error) {
      if (error.code === 'P2002') error = problem(409, '账号关联状态发生冲突，请刷新后重试。');
      failure(res, error);
    }
  });
  app.post('/api/auth/wechat/bind', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const user = await getUserFromToken(req);
      if (!user) throw problem(401, 'Unauthorized.');
      const identity = await provider.exchange(req.body?.code);
      try {
        // Unique constraints stop two accounts from claiming the same WeChat identity concurrently.
        await db.wechatIdentity.create({ data: { ...identity, userId: user.id } });
      } catch (error) {
        if (error.code !== 'P2002') throw error;
        const bound = await db.wechatIdentity.findUnique({ where: { appId_openId: identity } });
        if (!bound || bound.userId !== user.id)
          throw problem(409, '微信或当前账号已存在其他绑定。为保护账号，不会覆盖已有绑定，请联系开发者。');
      }
      res.json({ ok: true, bound: true });
    } catch (error) { failure(res, error); }
  });
}

module.exports = { createWechatProvider, registerWechatAuth };
