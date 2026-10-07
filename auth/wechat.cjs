const crypto = require('node:crypto');

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

function registerWechatAuth(app, { db, provider, getUserFromToken, publicUser, hashPassword, sessionTtlMs }) {
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
      const user = await db.user.findUnique({ where: { id: binding.userId } });
      if (!user) throw problem(409, '绑定的账号已不可用，请使用邮箱登录并联系开发者。');
      const token = 'tk_' + crypto.randomBytes(24).toString('hex');
      const expiresAt = Date.now() + sessionTtlMs;
      await db.session.create({ data: { token, userId: user.id, expiresAt: BigInt(expiresAt), createdAt: BigInt(Date.now()) } });
      res.json({ ok: true, token, user: publicUser(user), expiresAt, created });
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
      // This adds credentials in place. It cannot change another account, grant an admin role,
      // overwrite a previously bound email, or silently merge different users' data/plans.
      const updated = await db.$transaction(async tx => {
        const result = await tx.user.updateMany({ where: { id: user.id, email: null }, data: { email, passwordHash: hashPassword(password).hash } });
        if (result.count !== 1) throw problem(409, '账号已绑定邮箱，请刷新账号页面。');
        return tx.user.findUnique({ where: { id: user.id } });
      });
      res.json({ ok: true, user: publicUser(updated) });
    } catch (error) {
      if (error.code === 'P2002') error = problem(409, '这个邮箱已有 Texta 账号。请使用其他邮箱；已有账号可通过邮箱登录入口使用，不会自动覆盖或合并资料。');
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
