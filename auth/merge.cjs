const { effectivePlan } = require('../billing/plans.cjs');
const { Prisma } = require('@prisma/client');

function conflict(message) { return Object.assign(new Error(message), { status: 409 }); }
function rawId(userId, id) { const prefix = userId + '__'; return id.startsWith(prefix) ? id.slice(prefix.length) : id; }
function newer(a, b) { return String(a.updatedAt || a.createdAt || '') > String(b.updatedAt || b.createdAt || ''); }
function jsonData(row, fields) {
  const data = { ...row };
  for (const field of fields) if (data[field] === null) data[field] = Prisma.JsonNull;
  return data;
}

async function mergeWechatAccount(tx, source, target, appId, sessionTtlMs) {
  // Lock both accounts in stable order. A concurrent snapshot write must finish first or
  // observe mergedIntoId and stop; it cannot recreate an orphan source library after merging.
  const ids = [source.id, target.id].sort();
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" IN (${ids[0]}, ${ids[1]}) ORDER BY "id" FOR UPDATE`;
  source = await tx.user.findUnique({ where: { id: source.id } });
  target = await tx.user.findUnique({ where: { id: target.id } });
  if (!source || !target || source.email || source.mergedIntoId || target.mergedIntoId)
    throw conflict('账号状态已改变，请重新登录后关联。');
  if (source.role !== 'user' || effectivePlan(source) !== 'free' || await tx.paymentOrder.count({ where: { userId: source.id } }))
    throw conflict('当前微信账号有套餐或订单，请联系开发者核对后合并，资料和套餐不会被覆盖。');
  const identities = await tx.wechatIdentity.findMany({ where: { userId: source.id } });
  const own = identities.find(row => row.appId === appId);
  if (!own) throw conflict('当前账号的微信身份已改变，请重新登录。');
  for (const row of identities) {
    if (await tx.wechatIdentity.findUnique({ where: { appId_userId: { appId: row.appId, userId: target.id } } }))
      throw conflict('该邮箱账号已关联另一个微信，请联系开发者处理。');
  }

  // IDs in favorites/folders contain the owner prefix. Preserve client IDs and resolve
  // a colliding row by timestamp; do not turn a newer deletion into an active record.
  for (const model of ['libraryFolder', 'favoriteArticle']) {
    const rows = await tx[model].findMany({ where: { userId: source.id } });
    const targets = new Map((await tx[model].findMany({ where: { userId: target.id } })).map(row => [row.id, row]));
    for (const row of rows) {
      const id = target.id + '__' + rawId(source.id, row.id);
      const existing = targets.get(id);
      const copied = model === 'favoriteArticle' ? jsonData(row, ['words', 'lexicon', 'paragraphsEn', 'paragraphsZh', 'alignment', 'missing']) : row;
      if (!existing) await tx[model].create({ data: { ...copied, id, userId: target.id } });
      else if (newer(row, existing)) {
        const { id: ignored, ...data } = copied;
        await tx[model].update({ where: { id }, data: { ...data, userId: target.id } });
      }
    }
    await tx[model].deleteMany({ where: { userId: source.id } });
  }
  for (const model of ['notebookEntry', 'userVocabPref']) {
    const targets = new Map((await tx[model].findMany({ where: { userId: target.id } })).map(row => [row.wordKey, row]));
    for (const row of await tx[model].findMany({ where: { userId: source.id } })) {
      const where = { userId_wordKey: { userId: target.id, wordKey: row.wordKey } };
      const existing = targets.get(row.wordKey);
      if (!existing) await tx[model].update({ where: { id: row.id }, data: { userId: target.id } });
      else {
        const copied = model === 'notebookEntry' ? jsonData(row, ['baseMeanings', 'senses', 'collocations', 'synonyms', 'antonyms', 'sourceArticle']) : row;
        const { id: ignored, userId: ignoredOwner, ...data } = copied;
        // Keep the first introduction date while taking the latest word/deletion/mastery.
        const selected = newer(row, existing) ? data : {};
        selected.createdAt = [row.createdAt, existing.createdAt].filter(Boolean).sort()[0];
        await tx[model].update({ where, data: selected });
      }
    }
    await tx[model].deleteMany({ where: { userId: source.id } });
  }
  for (const [model, limit] of [['favoriteArticle', 200], ['libraryFolder', 200], ['notebookEntry', 2000], ['userVocabPref', 5000]]) {
    if (await tx[model].count({ where: { userId: target.id } }) > limit)
      throw conflict('合并后的资料数量超过同步上限，请联系开发者处理；本次未修改账号或资料。');
  }
  for (const row of await tx.usageDaily.findMany({ where: { userId: source.id } })) {
    await tx.usageDaily.upsert({ where: { userId_dateKey: { userId: target.id, dateKey: row.dateKey } },
      create: { userId: target.id, dateKey: row.dateKey, used: row.used }, update: { used: { increment: row.used } } });
  }
  await tx.usageDaily.deleteMany({ where: { userId: source.id } });
  await tx.usageLog.updateMany({ where: { userId: source.id }, data: { userId: target.id } });
  await tx.vipRequest.updateMany({ where: { userId: source.id }, data: { userId: target.id, userEmail: target.email } });
  await tx.wechatIdentity.updateMany({ where: { userId: source.id }, data: { userId: target.id } });
  await tx.user.update({ where: { id: source.id }, data: { mergedIntoId: target.id } });
  await tx.user.update({ where: { id: target.id }, data: { libraryMergeProtected: true } });
  // Never upgrade every old source bearer to the email account. Revoke them and mint
  // one session only for the request that proved the existing account password.
  await tx.session.deleteMany({ where: { userId: source.id } });
  const token = 'tk_' + require('node:crypto').randomBytes(24).toString('hex');
  const expiresAt = Date.now() + sessionTtlMs;
  await tx.session.create({ data: { token, userId: target.id, expiresAt: BigInt(expiresAt), createdAt: BigInt(Date.now()) } });
  return { user: target, token, expiresAt, mergedFrom: source.id };
}

module.exports = { mergeWechatAccount };
