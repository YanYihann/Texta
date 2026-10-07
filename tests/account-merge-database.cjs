// Uses a randomly named, empty PostgreSQL schema. Never migrates the public schema.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { transaction } = require('../billing/service.cjs');
const { mergeWechatAccount } = require('../auth/merge.cjs');
const { reserveCredits, refundCredits } = require('../billing/credits.cjs');
const schema = 'texta_merge_test_' + crypto.randomBytes(6).toString('hex');
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('schema', schema);
const db = new PrismaClient({ datasources: { db: { url: url.href } } });
let stage = 'initialize-schema';
(async () => {
  assert.match(schema, /^texta_merge_test_[a-f0-9]{12}$/);
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate'], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url.href }, stdio: 'pipe', timeout: 60000
  });
  stage = 'verify-schema';
  // Confirm raw row-lock queries resolve this dedicated schema as well as Prisma models.
  const namespace = await db.$queryRaw`SELECT current_schema() AS name`;
  assert.equal(namespace[0].name, schema);
  stage = 'fixtures';
  const first = '2026-10-01T00:00:00.000Z', later = '2026-10-07T00:00:00.000Z';
  const base = { role: 'user', name: 'Fixture', createdAt: first };
  const source = await db.user.create({ data: { ...base, id: 'merge-source', email: null, passwordHash: null } });
  const target = await db.user.create({ data: { ...base, id: 'merge-target', email: 'fixture@example.invalid', passwordHash: 'fixture-hash', plan: 'pro' } });
  const appId = 'wxc1af567af0505b1e';
  await db.wechatIdentity.create({ data: { appId, openId: 'fixture-only', userId: source.id } });
  await db.session.create({ data: { token: 'fixture-source-session', userId: source.id, expiresAt: BigInt(Date.now() + 60000), createdAt: BigInt(Date.now()) } });
  const word = { wordKey: 'journey', word: 'journey', pos: 'n.', senses: [], collocations: [], synonyms: [], antonyms: [], wordFormation: '', createdAt: first, updatedAt: later };
  await db.notebookEntry.create({ data: { ...word, userId: source.id, deletedAt: later } });
  await db.notebookEntry.create({ data: { ...word, userId: target.id, createdAt: later, updatedAt: first } });
  await db.favoriteArticle.create({ data: { id: source.id + '__article', userId: source.id, title: 'Fixture', article: 'journey', savedAt: first,
    words: ['journey'], lexicon: [], paragraphsEn: [], paragraphsZh: [], alignment: [], missing: [], createdAt: first, updatedAt: later } });
  for (const [userId, used] of [[source.id, 2], [target.id, 4]]) await db.usageDaily.create({ data: { userId, used, dateKey: '2026-10-07' } });
  const reservation = await reserveCredits(db, source, '2026-10-07', 1); assert.ok(reservation);
  stage = 'rollback';

  const failed = transaction(db, async tx => {
    await mergeWechatAccount(tx, source, target, appId, 60000);
    throw Error('fixture rollback');
  });
  await assert.rejects(failed, /fixture rollback/);
  assert.equal((await db.wechatIdentity.findUnique({ where: { appId_openId: { appId, openId: 'fixture-only' } } })).userId, source.id);
  assert.equal(await db.favoriteArticle.count({ where: { userId: target.id } }), 0);
  assert.ok(await db.session.findUnique({ where: { token: 'fixture-source-session' } }));

  stage = 'concurrent-merge';
  const results = await Promise.allSettled([0, 1].map(() => transaction(db, tx => mergeWechatAccount(tx, source, target, appId, 60000))));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(await db.favoriteArticle.count({ where: { userId: target.id } }), 1);
  assert.equal(await db.notebookEntry.count({ where: { userId: target.id } }), 1);
  const entry = await db.notebookEntry.findUnique({ where: { userId_wordKey: { userId: target.id, wordKey: 'journey' } } });
  assert.equal(entry.createdAt, first); assert.equal(entry.deletedAt, later); assert.equal(entry.sourceArticle, null);
  assert.equal((await db.user.findUnique({ where: { id: target.id } })).plan, 'pro');
  assert.equal(await db.session.count({ where: { userId: source.id } }), 0);
  const balance = () => db.usageDaily.findUnique({ where: { userId_dateKey: { userId: target.id, dateKey: '2026-10-07' } } });
  assert.equal((await balance()).used, 7); assert.equal(await reserveCredits(db, source, '2026-10-07', 1), null);
  await refundCredits(db, reservation); assert.equal((await balance()).used, 6);
  console.log('PASS: isolated PostgreSQL merge, JSON null, concurrent merge, rollback, session revocation and late refund');
})().catch(error => {
  // No connection URL, account identifiers, credential values or Prisma query arguments.
  const prismaCode = String(error.stderr || '').match(/(?:Error code: |Error: )(P\d{4})/);
  const unreachable = /Can't reach database server/.test(String(error.stderr || ''));
  console.error(JSON.stringify({ failed: true, stage, name: error.name, code: error.code || prismaCode?.[1] || (unreachable ? 'DATABASE_UNREACHABLE' : null), exitStatus: error.status || null, assertion: error.code === 'ERR_ASSERTION' ? error.message.slice(0, 180) : null }));
  process.exitCode = 1;
}).finally(async () => {
  try {
    {
      assert.match(schema, /^texta_merge_test_[a-f0-9]{12}$/);
      await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE');
      console.log('Isolated fixture schema removed.');
    }
  } catch (error) {
    console.error(JSON.stringify({ cleanupFailed: true, schema, name: error.name, code: error.code || null }));
    process.exitCode = 1;
  } finally { await db.$disconnect(); }
});
