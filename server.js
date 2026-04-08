const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const crypto = require("crypto");
const { AsyncLocalStorage } = require("async_hooks");
const { PrismaClient } = require("@prisma/client");
dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL_NORMAL = process.env.OPENAI_MODEL_NORMAL || process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_MODEL_ADVANCED = process.env.OPENAI_MODEL_ADVANCED || "gpt-4o";
const ADVANCED_USAGE_COST = Math.max(1, Number(process.env.ADVANCED_USAGE_COST || 5));
const OPENAI_API_MODE = String(process.env.OPENAI_API_MODE || "responses").toLowerCase();

function normalizeBaseUrl(raw) {
  const fallback = "https://api.openai.com/v1";
  if (!raw || typeof raw !== "string") {
    return fallback;
  }

  let value = raw.trim();
  if (value.startsWith("https//")) {
    value = value.replace("https//", "https://");
  }
  if (value.startsWith("http//")) {
    value = value.replace("http//", "http://");
  }

  try {
    const parsed = new URL(value);
    const normalizedPath = parsed.pathname.replace(/\/$/, "") || "/v1";
    return `${parsed.origin}${normalizedPath}`;
  } catch {
    return fallback;
  }
}

const OPENAI_BASE_URL = normalizeBaseUrl(process.env.OPENAI_BASE_URL);
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 30000);
const OPENAI_RETRY_COUNT = Number(process.env.OPENAI_RETRY_COUNT || 2);
const FRONTEND_ORIGIN = String(process.env.FRONTEND_ORIGIN || "*").trim();
const AUTH_TOKEN_TTL_MS = Number(process.env.AUTH_TOKEN_TTL_MS || 1000 * 60 * 60 * 24 * 7);
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_NAME = String(process.env.ADMIN_NAME || "Admin").trim();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "").trim();
const LEXICON_CACHE_TTL_MS = Math.max(60 * 1000, Number(process.env.LEXICON_CACHE_TTL_MS || 30 * 60 * 1000));
const LEXICON_CACHE_MAX = Math.max(50, Number(process.env.LEXICON_CACHE_MAX || 800));
const LEXICON_CHUNK_SIZE = Math.max(8, Number(process.env.LEXICON_CHUNK_SIZE || 12));
const LEXICON_CHUNK_CONCURRENCY = Math.max(1, Math.min(4, Number(process.env.LEXICON_CHUNK_CONCURRENCY || 2)));

const lexiconCache = new Map();
const modelTraceStorage = new AsyncLocalStorage();

function compactWordsKey(words) {
  return (Array.isArray(words) ? words : [])
    .map((w) => String(w || "").trim().toLowerCase())
    .filter(Boolean)
    .join("|");
}

function makeLexiconCacheKey(words, quickMode, model) {
  const raw = `lexicon::${compactWordsKey(words)}::quick=${quickMode ? 1 : 0}::model=${String(model || "").trim().toLowerCase()}`;
  return crypto.createHash("sha1").update(raw).digest("hex");
}

function getFromTimedCache(cache, key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Number(hit.expiresAt || 0) <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function setToTimedCache(cache, key, value, ttlMs, maxSize) {
  if (cache.size >= maxSize) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (Number(v?.expiresAt || 0) <= now) {
        cache.delete(k);
      }
    }
    while (cache.size >= maxSize) {
      const first = cache.keys().next();
      if (first.done) break;
      cache.delete(first.value);
    }
  }
  cache.set(key, {
    value,
    expiresAt: Date.now() + Math.max(1000, Number(ttlMs || 0))
  });
}

function extractUsageFromOpenAIResponse(data) {
  const usage = data?.usage || {};
  const inputTokens = Number(usage.input_tokens ?? usage.prompt_tokens ?? 0);
  const outputTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? 0);
  const totalTokens = Number(usage.total_tokens ?? inputTokens + outputTokens);
  if (!Number.isFinite(inputTokens) && !Number.isFinite(outputTokens) && !Number.isFinite(totalTokens)) {
    return null;
  }
  return {
    inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
    outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0
  };
}

function recordModelTrace(entry) {
  const store = modelTraceStorage.getStore();
  if (!store || !Array.isArray(store.calls)) return;
  store.calls.push(entry);
}

function buildAdminModelDiagnostics(traceStore) {
  const calls = Array.isArray(traceStore?.calls) ? traceStore.calls : [];
  const byStepMap = new Map();
  let totalDurationMs = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTokens = 0;
  let successful = 0;

  for (const call of calls) {
    const step = String(call?.step || "unknown");
    const durationMs = Number(call?.durationMs || 0);
    const usage = call?.usage || null;
    totalDurationMs += durationMs;
    if (call?.status === "ok") {
      successful += 1;
    }
    if (usage) {
      totalInputTokens += Number(usage.inputTokens || 0);
      totalOutputTokens += Number(usage.outputTokens || 0);
      totalTokens += Number(usage.totalTokens || 0);
    }

    if (!byStepMap.has(step)) {
      byStepMap.set(step, {
        step,
        requests: 0,
        successes: 0,
        durationMs: 0
      });
    }
    const row = byStepMap.get(step);
    row.requests += 1;
    row.durationMs += durationMs;
    if (call?.status === "ok") {
      row.successes += 1;
    }
  }

  const byStep = Array.from(byStepMap.values()).sort((a, b) => b.requests - a.requests);
  return {
    totalRequests: calls.length,
    successfulRequests: successful,
    failedRequests: Math.max(0, calls.length - successful),
    totalDurationMs: Math.round(totalDurationMs),
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    byStep,
    calls: calls.slice(0, 120)
  };
}
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use((req, res, next) => {
  const origin = req.headers.origin || "";
  const allowAll = FRONTEND_ORIGIN === "*";
  const allowed =
    allowAll ||
    origin === FRONTEND_ORIGIN ||
    (FRONTEND_ORIGIN.includes(",") &&
      FRONTEND_ORIGIN
        .split(",")
        .map((x) => x.trim())
        .includes(origin));

  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", allowAll ? "*" : origin || FRONTEND_ORIGIN);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

function hashPassword(raw, salt) {
  const safeSalt = salt || crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(raw || ""), safeSalt, 64).toString("hex");
  return { hash: `${safeSalt}:${derived}`, salt: safeSalt };
}

function verifyPassword(raw, passwordHash) {
  const source = String(passwordHash || "");
  const [salt, hashed] = source.split(":");
  if (!salt || !hashed) {
    return false;
  }
  const rehashed = crypto.scryptSync(String(raw || ""), salt, 64).toString("hex");
  const a = Buffer.from(hashed, "hex");
  const b = Buffer.from(rehashed, "hex");
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

async function writeAuthStore(store) {
  const users = Array.isArray(store?.users) ? store.users : [];
  const sessions = Array.isArray(store?.sessions) ? store.sessions : [];
  const usageDailyObj = store?.usageDaily && typeof store.usageDaily === "object" ? store.usageDaily : {};
  const vipRequests = Array.isArray(store?.vipRequests) ? store.vipRequests : [];

  const usageRows = [];
  for (const [userId, dateMap] of Object.entries(usageDailyObj)) {
    if (!dateMap || typeof dateMap !== "object") continue;
    for (const [dateKey, used] of Object.entries(dateMap)) {
      usageRows.push({
        userId,
        dateKey,
        used: Number(used || 0)
      });
    }
  }

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: String(user.id) },
      create: {
        id: String(user.id),
        email: String(user.email || "").toLowerCase(),
        name: String(user.name || ""),
        passwordHash: String(user.passwordHash || ""),
        role: String(user.role || "user"),
        plan: String(user.plan || "free"),
        createdAt: String(user.createdAt || new Date().toISOString())
      },
      update: {
        email: String(user.email || "").toLowerCase(),
        name: String(user.name || ""),
        passwordHash: String(user.passwordHash || ""),
        role: String(user.role || "user"),
        plan: String(user.plan || "free")
      }
    });
  }

  await prisma.session.deleteMany({});
  if (sessions.length > 0) {
    await prisma.session.createMany({
      data: sessions.map((s) => ({
        token: String(s.token),
        userId: String(s.userId),
        expiresAt: BigInt(Number(s.expiresAt || 0)),
        createdAt: BigInt(Number(s.createdAt || Date.now()))
      }))
    });
  }

  await prisma.usageDaily.deleteMany({});
  if (usageRows.length > 0) {
    await prisma.usageDaily.createMany({ data: usageRows });
  }

  await prisma.vipRequest.deleteMany({});
  if (vipRequests.length > 0) {
    await prisma.vipRequest.createMany({
      data: vipRequests.map((x) => ({
        id: String(x.id),
        userId: String(x.userId || ""),
        userEmail: String(x.userEmail || ""),
        payerName: String(x.payerName || ""),
        amount: String(x.amount || ""),
        paidAt: String(x.paidAt || ""),
        proofCode: String(x.proofCode || ""),
        proofImageUrl: String(x.proofImageUrl || ""),
        note: String(x.note || ""),
        status: String(x.status || "pending"),
        createdAt: String(x.createdAt || new Date().toISOString()),
        reviewedAt: String(x.reviewedAt || ""),
        reviewerId: String(x.reviewerId || ""),
        reviewNote: String(x.reviewNote || "")
      }))
    });
  }
}

async function readAuthStore() {
  const now = Date.now();
  const [usersRows, sessionsRows, usageRows, vipRows] = await Promise.all([
    prisma.user.findMany(),
    prisma.session.findMany({ where: { expiresAt: { gt: BigInt(now) } } }),
    prisma.usageDaily.findMany(),
    prisma.vipRequest.findMany({ orderBy: { createdAt: "desc" } })
  ]);

  const users = usersRows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    passwordHash: u.passwordHash,
    role: u.role || "user",
    plan: u.plan || "free",
    createdAt: u.createdAt
  }));

  const sessions = sessionsRows.map((s) => ({
    token: s.token,
    userId: s.userId,
    expiresAt: Number(s.expiresAt),
    createdAt: Number(s.createdAt)
  }));

  const usageDaily = {};
  for (const row of usageRows) {
    if (!usageDaily[row.userId]) {
      usageDaily[row.userId] = {};
    }
    usageDaily[row.userId][row.dateKey] = Number(row.used || 0);
  }

  const vipRequests = vipRows.map((x) => ({
    id: x.id,
    userId: x.userId,
    userEmail: x.userEmail,
    payerName: x.payerName,
    amount: x.amount,
    paidAt: x.paidAt,
    proofCode: x.proofCode,
    proofImageUrl: x.proofImageUrl,
    note: x.note,
    status: x.status,
    createdAt: x.createdAt,
    reviewedAt: x.reviewedAt,
    reviewerId: x.reviewerId,
    reviewNote: x.reviewNote
  }));

  await prisma.session.deleteMany({ where: { expiresAt: { lte: BigInt(now) } } });
  return { users, sessions, usageDaily, vipRequests };
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role || "user",
    plan: user.plan || "free"
  };
}

function getShanghaiTimeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23"
  })
    .formatToParts(date)
    .reduce((acc, item) => {
      if (item.type !== "literal") {
        acc[item.type] = item.value;
      }
      return acc;
    }, {});

  return {
    year: parts.year || "0000",
    month: parts.month || "00",
    day: parts.day || "00",
    hour: parts.hour || "00",
    minute: parts.minute || "00",
    second: parts.second || "00"
  };
}

function getShanghaiDateKey(date = new Date()) {
  const parts = getShanghaiTimeParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getShanghaiHourBucket(date = new Date()) {
  const parts = getShanghaiTimeParts(date);
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    dateKey,
    hourKey: `${dateKey} ${parts.hour}`,
    periodLabel: `${dateKey} ${parts.hour}:00-${parts.hour}:59`
  };
}

function getDailyLimit(user) {
  if (String(user?.role || "").toLowerCase() === "admin") {
    return Number.POSITIVE_INFINITY;
  }
  const plan = String(user?.plan || "free").toLowerCase();
  return plan === "vip" ? 50 : 10;
}

function normalizeGenerationQuality(raw) {
  return String(raw || "").toLowerCase() === "advanced" ? "advanced" : "normal";
}

function normalizeGenerationMode(raw) {
  return String(raw || "").toLowerCase() === "mixed" ? "mixed" : "standard";
}

function getGenerationProfile(rawQuality) {
  const quality = normalizeGenerationQuality(rawQuality);
  if (quality === "advanced") {
    return {
      quality,
      model: OPENAI_MODEL_ADVANCED,
      usageCost: ADVANCED_USAGE_COST
    };
  }
  return {
    quality: "normal",
    model: OPENAI_MODEL_NORMAL,
    usageCost: 1
  };
}

function getUsageSnapshot(store, user, dateKey = getShanghaiDateKey()) {
  const usageDaily = store?.usageDaily && typeof store.usageDaily === "object" ? store.usageDaily : {};
  const userUsage = usageDaily[user.id] && typeof usageDaily[user.id] === "object" ? usageDaily[user.id] : {};
  const used = Number(userUsage[dateKey] || 0);
  const limit = getDailyLimit(user);
  const isUnlimited = !Number.isFinite(limit);
  return {
    date: dateKey,
    used,
    limit: isUnlimited ? null : limit,
    remaining: isUnlimited ? null : Math.max(limit - used, 0),
    isUnlimited
  };
}

function bumpUsage(store, user, dateKey = getShanghaiDateKey(), amount = 1) {
  if (!store.usageDaily || typeof store.usageDaily !== "object") {
    store.usageDaily = {};
  }
  if (!store.usageDaily[user.id] || typeof store.usageDaily[user.id] !== "object") {
    store.usageDaily[user.id] = {};
  }
  const delta = Math.max(1, Math.floor(Number(amount) || 1));
  store.usageDaily[user.id][dateKey] = Number(store.usageDaily[user.id][dateKey] || 0) + delta;
}

async function logUsageEvent(user, usedAt = new Date(), count = 1) {
  if (!user?.id) return;
  const total = Math.max(1, Math.floor(Number(count) || 1));
  if (total === 1) {
    const bucket = getShanghaiHourBucket(usedAt);
    await prisma.usageLog.create({
      data: {
        userId: String(user.id),
        usedAt: usedAt.toISOString(),
        dateKey: bucket.dateKey,
        hourKey: bucket.hourKey,
        periodLabel: bucket.periodLabel
      }
    });
    return;
  }

  const rows = Array.from({ length: total }).map((_, idx) => {
    const ts = new Date(usedAt.getTime() + idx);
    const bucket = getShanghaiHourBucket(ts);
    return {
      userId: String(user.id),
      usedAt: ts.toISOString(),
      dateKey: bucket.dateKey,
      hourKey: bucket.hourKey,
      periodLabel: bucket.periodLabel
    };
  });
  await prisma.usageLog.createMany({ data: rows });
}

function compareUsageUsers(a, b) {
  const aAdmin = String(a.role || "").toLowerCase() === "admin" ? 0 : 1;
  const bAdmin = String(b.role || "").toLowerCase() === "admin" ? 0 : 1;
  if (aAdmin !== bAdmin) {
    return aAdmin - bAdmin;
  }
  if (Number(b.totalUsage || 0) !== Number(a.totalUsage || 0)) {
    return Number(b.totalUsage || 0) - Number(a.totalUsage || 0);
  }
  return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
}

function extractBearerToken(req) {
  const auth = String(req.headers.authorization || "");
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

async function getUserFromToken(req) {
  const token = extractBearerToken(req);
  if (!token) return null;
  const store = await readAuthStore();
  const session = store.sessions.find((x) => x.token === token);
  if (!session) return null;
  const user = store.users.find((x) => x.id === session.userId);
  return user || null;
}

async function ensureAdminSeed() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return;
  const store = await readAuthStore();
  const exists = store.users.some((u) => String(u.email || "").toLowerCase() === ADMIN_EMAIL);
  if (exists) return;

  const pw = hashPassword(ADMIN_PASSWORD);
  store.users.push({
    id: `u_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    email: ADMIN_EMAIL,
    name: ADMIN_NAME,
    passwordHash: pw.hash,
    role: "admin",
    plan: "vip",
    createdAt: new Date().toISOString()
  });
  await writeAuthStore(store);
  console.log(`[auth] Seeded admin user: ${ADMIN_EMAIL}`);
}

async function requireAuth(req, res) {
  const user = await getUserFromToken(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized. Please login first." });
    return null;
  }
  return user;
}

async function requireAdmin(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (String(user.role || "").toLowerCase() !== "admin") {
    res.status(403).json({ error: "Admin only." });
    return null;
  }
  return user;
}

function cloneJsonSafe(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function normalizeText(value, maxLen = 20000) {
  return String(value || "").trim().slice(0, maxLen);
}

function normalizeIso(value, fallback = new Date().toISOString()) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString();
}

function normalizeStringArray(raw, maxItems = 200, itemMaxLen = 500) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeText(item, itemMaxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function parseAlignmentPayload(rawAlignment) {
  if (Array.isArray(rawAlignment)) {
    return {
      items: rawAlignment,
      generationMode: "standard",
      generationQuality: "normal"
    };
  }

  if (rawAlignment && typeof rawAlignment === "object") {
    const items = Array.isArray(rawAlignment.items) ? rawAlignment.items : [];
    const meta = rawAlignment.meta && typeof rawAlignment.meta === "object" ? rawAlignment.meta : {};
    return {
      items,
      generationMode: normalizeGenerationMode(meta.generationMode),
      generationQuality: normalizeGenerationQuality(meta.generationQuality)
    };
  }

  return {
    items: [],
    generationMode: "standard",
    generationQuality: "normal"
  };
}

function buildAlignmentPayload(rawAlignment, rawGenerationMode, rawGenerationQuality) {
  const parsed = parseAlignmentPayload(rawAlignment);
  return {
    items: cloneJsonSafe(Array.isArray(parsed.items) ? parsed.items.slice(0, 300) : [], []),
    meta: {
      generationMode: normalizeGenerationMode(rawGenerationMode || parsed.generationMode),
      generationQuality: normalizeGenerationQuality(rawGenerationQuality || parsed.generationQuality)
    }
  };
}

function sanitizeFavoritesPayload(rawList) {
  if (!Array.isArray(rawList)) return [];
  const now = new Date().toISOString();
  const out = [];
  const seen = new Set();

  for (const raw of rawList.slice(0, 200)) {
    const words = normalizeStringArray(raw?.words, 120, 80);
    const id = normalizeText(raw?.id, 80) || `fav_${crypto.randomBytes(8).toString("hex")}`;
    if (seen.has(id)) continue;
    seen.add(id);

    out.push({
      id,
      userId: "",
      title: normalizeText(raw?.title, 200) || "未命名文章",
      savedAt: normalizeText(raw?.savedAt, 120) || now,
      words,
      article: normalizeText(raw?.article, 120000),
      lexicon: cloneJsonSafe(Array.isArray(raw?.lexicon) ? raw.lexicon.slice(0, 300) : [], []),
      paragraphsEn: cloneJsonSafe(Array.isArray(raw?.paragraphsEn) ? raw.paragraphsEn.slice(0, 120) : [], []),
      paragraphsZh: cloneJsonSafe(Array.isArray(raw?.paragraphsZh) ? raw.paragraphsZh.slice(0, 120) : [], []),
      alignment: buildAlignmentPayload(raw?.alignment, raw?.generationMode, raw?.generationQuality),
      missing: cloneJsonSafe(Array.isArray(raw?.missing) ? raw.missing.slice(0, 120) : [], []),
      createdAt: normalizeIso(raw?.createdAt, now),
      updatedAt: normalizeIso(raw?.updatedAt, now)
    });
  }

  return out;
}

function sanitizeNotebookPayload(rawList) {
  if (!Array.isArray(rawList)) return [];
  const now = new Date().toISOString();
  const out = [];
  const seen = new Set();

  for (const raw of rawList.slice(0, 2000)) {
    const word = normalizeText(raw?.word, 120);
    const key =
      normalizeText(raw?.key, 120) ||
      normalizeText(raw?.wordKey, 120) ||
      word.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!key || seen.has(key)) continue;
    seen.add(key);

    out.push({
      id: normalizeText(raw?.id, 80) || `nb_${crypto.randomBytes(8).toString("hex")}`,
      userId: "",
      wordKey: key,
      word: word || key,
      pos: normalizeText(raw?.pos, 80),
      senses: cloneJsonSafe(Array.isArray(raw?.senses) ? raw.senses.slice(0, 20) : [], []),
      collocations: cloneJsonSafe(Array.isArray(raw?.collocations) ? raw.collocations.slice(0, 20) : [], []),
      synonyms: cloneJsonSafe(Array.isArray(raw?.synonyms) ? raw.synonyms.slice(0, 30) : [], []),
      antonyms: cloneJsonSafe(Array.isArray(raw?.antonyms) ? raw.antonyms.slice(0, 30) : [], []),
      wordFormation: normalizeText(raw?.wordFormation, 2000),
      createdAt: normalizeIso(raw?.createdAt, now),
      updatedAt: normalizeIso(raw?.updatedAt, now)
    });
  }

  return out;
}

function sanitizeVocabPrefsPayload(rawValue) {
  const now = new Date().toISOString();
  const out = [];
  const seen = new Set();
  const sourceEntries =
    rawValue && typeof rawValue === "object" && !Array.isArray(rawValue) ? Object.entries(rawValue) : [];

  for (const [rawKey, rawItem] of sourceEntries.slice(0, 5000)) {
    const wordKey = normalizeText(rawKey, 120);
    if (!wordKey || seen.has(wordKey)) continue;
    seen.add(wordKey);

    const masteryRaw = normalizeText(rawItem?.mastery, 32).toLowerCase();
    const mastery = masteryRaw === "mastered" ? "mastered" : "unknown";
    out.push({
      id: normalizeText(rawItem?.id, 80) || `vp_${crypto.randomBytes(8).toString("hex")}`,
      userId: "",
      wordKey,
      word: normalizeText(rawItem?.word, 120),
      mastery,
      createdAt: normalizeIso(rawItem?.createdAt, now),
      updatedAt: normalizeIso(rawItem?.updatedAt, now)
    });
  }

  return out;
}

function encodeFavoriteId(userId, rawId) {
  const source = normalizeText(rawId, 80) || `fav_${crypto.randomBytes(8).toString("hex")}`;
  const prefix = `${userId}__`;
  if (source.startsWith(prefix)) return source;
  return `${prefix}${source}`;
}

function decodeFavoriteId(userId, storedId) {
  const raw = String(storedId || "");
  const prefix = `${userId}__`;
  return raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
}

function splitWords(rawText) {
  return String(rawText || "")
    .split(/[\n,，]+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .filter((value, index, arr) => arr.findIndex((x) => x.toLowerCase() === value.toLowerCase()) === index);
}

function splitParagraphs(article) {
  return String(article || "")
    .replace(/\r/g, "")
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function runWithConcurrency(items, concurrency, worker) {
  const source = Array.isArray(items) ? items : [];
  if (source.length === 0) return [];
  const out = new Array(source.length);
  const limit = Math.max(1, Math.min(Number(concurrency || 1), source.length));
  let cursor = 0;

  const runners = Array.from({ length: limit }, async () => {
    while (cursor < source.length) {
      const idx = cursor;
      cursor += 1;
      out[idx] = await worker(source[idx], idx);
    }
  });

  await Promise.all(runners);
  return out;
}

function findMissingWords(article, words) {
  const text = String(article || "").toLowerCase();
  return words.filter((w) => !text.includes(w.toLowerCase()));
}

function enforceWordMarkers(article, lexicon) {
  let output = String(article || "");
  const markerSet = "[①②③④⑤⑥⑦⑧⑨⑩]";

  for (const item of lexicon || []) {
    const word = String(item?.word || "");
    const marker = String(item?.senses?.[0]?.marker || "①");
    if (!word) {
      continue;
    }

    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const markedRegex = new RegExp(`\\b${escaped}\\b${markerSet}`, "i");
    if (markedRegex.test(output)) {
      continue;
    }

    const firstMatchRegex = new RegExp(`\\b${escaped}\\b`, "i");
    output = output.replace(firstMatchRegex, (m) => `${m}${marker}`);
  }

  return output;
}

function extractJsonArray(text) {
  const source = String(text || "");
  const start = source.indexOf("[");
  const end = source.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  const possibleJson = source.slice(start, end + 1);
  try {
    return JSON.parse(possibleJson);
  } catch {
    return null;
  }
}

function extractJsonObject(text) {
  const source = String(text || "");
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  const possibleJson = source.slice(start, end + 1);
  try {
    return JSON.parse(possibleJson);
  } catch {
    return null;
  }
}

function decodeJsonEscapedString(value) {
  const raw = String(value || "");
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return raw
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n")
      .replace(/\\\\/g, "\\");
  }
}

function extractTitleArticleLoose(text) {
  const source = String(text || "");
  const titleMatch = source.match(/"title"\s*:\s*"((?:\\.|[^"\\])*)"/i);
  const articleMatch = source.match(/"article"\s*:\s*"((?:\\.|[^"\\])*)"/i);
  if (!titleMatch || !articleMatch) {
    return null;
  }
  return {
    title: decodeJsonEscapedString(titleMatch[1]).trim(),
    article: decodeJsonEscapedString(articleMatch[1]).trim()
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function editDistance(a, b) {
  const s = String(a || "").toLowerCase();
  const t = String(b || "").toLowerCase();
  const dp = Array.from({ length: s.length + 1 }, () => Array(t.length + 1).fill(0));
  for (let i = 0; i <= s.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= t.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= s.length; i += 1) {
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[s.length][t.length];
}

function isRetryableNetworkError(error) {
  const msg = String(error?.message || "").toLowerCase();
  const causeCode = error?.cause?.code;
  return (
    causeCode === "UND_ERR_CONNECT_TIMEOUT" ||
    causeCode === "ETIMEDOUT" ||
    causeCode === "ECONNRESET" ||
    causeCode === "ENOTFOUND" ||
    msg.includes("fetch failed")
  );
}

function extractResponseText(data) {
  if (!data || typeof data !== "object") {
    return "";
  }

  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (Array.isArray(data.output)) {
    const parts = [];
    for (const item of data.output) {
      if (!item || !Array.isArray(item.content)) {
        continue;
      }
      for (const c of item.content) {
        if (typeof c?.text === "string" && c.text.trim()) {
          parts.push(c.text.trim());
        }
      }
    }
    if (parts.length > 0) {
      return parts.join("\n").trim();
    }
  }

  const chatContent = data?.choices?.[0]?.message?.content;
  if (typeof chatContent === "string" && chatContent.trim()) {
    return chatContent.trim();
  }
  if (Array.isArray(chatContent)) {
    const parts = chatContent
      .map((x) => (typeof x?.text === "string" ? x.text.trim() : ""))
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join("\n").trim();
    }
  }

  if (typeof data?.choices?.[0]?.text === "string" && data.choices[0].text.trim()) {
    return data.choices[0].text.trim();
  }

  return "";
}

function toCircledNumber(n) {
  const map = ["", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
  return map[n] || `${n}`;
}

function normalizePosTag(raw) {
  const source = String(raw || "").trim();
  if (!source) return "";
  const lower = source.toLowerCase();

  if (/^(n|noun)\.?$/.test(lower) || /名词/.test(source)) return "n.";
  if (/^(v|verb)\.?$/.test(lower) || /动词/.test(source)) return "v.";
  if (/^(adj|adjective)\.?$/.test(lower) || /形容词/.test(source)) return "adj.";
  if (/^(adv|adverb)\.?$/.test(lower) || /副词/.test(source)) return "adv.";
  if (/^(prep|preposition)\.?$/.test(lower) || /介词/.test(source)) return "prep.";
  if (/^(pron|pronoun)\.?$/.test(lower) || /代词/.test(source)) return "pron.";
  if (/^(conj|conjunction)\.?$/.test(lower) || /连词/.test(source)) return "conj.";
  if (/^(num|number|numeral)\.?$/.test(lower) || /数词/.test(source)) return "num.";
  if (/^(det|determiner|article)\.?$/.test(lower) || /限定词|冠词/.test(source)) return "det.";
  if (/^(int|interjection)\.?$/.test(lower) || /感叹词/.test(source)) return "int.";

  if (/^[a-z]{1,8}\.?$/.test(lower)) {
    return lower.endsWith(".") ? lower : `${lower}.`;
  }
  return source;
}

function normalizeLexicon(words, rawItems) {
  const itemMap = new Map();
  if (Array.isArray(rawItems)) {
    for (const item of rawItems) {
      if (!item || typeof item.word !== "string") {
        continue;
      }
      const key = item.word.toLowerCase();
      if (itemMap.has(key)) {
        continue;
      }

      const pos = normalizePosTag(item?.pos);
      const meaningsRaw = Array.isArray(item.meanings) ? item.meanings : [];
      const meanings = meaningsRaw
        .map((m) => String(m || "").trim())
        .filter(Boolean)
        .slice(0, 5);
      const collocations = Array.isArray(item.collocations)
        ? item.collocations.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 5)
        : [];
      const wordFormation =
        typeof item.word_formation === "string" && item.word_formation.trim()
          ? item.word_formation.trim()
          : "";
      const synonyms = Array.isArray(item.synonyms)
        ? item.synonyms.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 6)
        : [];
      const antonyms = Array.isArray(item.antonyms)
        ? item.antonyms.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 6)
        : [];

      itemMap.set(key, { pos, meanings, collocations, wordFormation, synonyms, antonyms });
    }
  }

  return words.map((word) => {
    const found = itemMap.get(word.toLowerCase());
    const pos = normalizePosTag(found?.pos || "");
    const meanings = found?.meanings?.length ? found.meanings : ["常考义待完善"];
    const senses = meanings.map((meaning, idx) => ({
      marker: toCircledNumber(idx + 1),
      meaning
    }));

    return {
      word,
      pos,
      senses,
      collocations: found?.collocations?.length ? found.collocations : ["(暂无)"],
      wordFormation: found?.wordFormation || "(暂无)",
      synonyms: found?.synonyms?.length ? found.synonyms : ["(暂无)"],
      antonyms: found?.antonyms?.length ? found.antonyms : ["(暂无)"]
    };
  });
}

async function callOpenAIText(prompt, options = {}) {
  const base = OPENAI_BASE_URL.replace(/\/$/, "");
  const useChat = OPENAI_API_MODE === "chat";
  const endpoint = useChat ? `${base}/chat/completions` : `${base}/responses`;
  const maxTokens = Number.isFinite(options.maxTokens) ? options.maxTokens : undefined;
  const model = String(options.model || OPENAI_MODEL_NORMAL).trim() || OPENAI_MODEL_NORMAL;
  const step = String(options.step || "unknown");

  for (let attempt = 1; attempt <= OPENAI_RETRY_COUNT + 1; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify(
          useChat
            ? {
                model,
                messages: [{ role: "user", content: prompt }],
                ...(maxTokens ? { max_tokens: maxTokens } : {})
              }
            : {
                model,
                input: prompt,
                ...(maxTokens ? { max_output_tokens: maxTokens } : {})
              }
        ),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${text}`);
      }

      const data = await response.json();
      const text = extractResponseText(data);
      if (!text) {
        throw new Error("Empty text returned by provider. Try switching OPENAI_API_MODE=chat or change model.");
      }
      recordModelTrace({
        step,
        model,
        mode: useChat ? "chat" : "responses",
        maxTokens: maxTokens || 0,
        attempt,
        status: "ok",
        durationMs: Date.now() - startedAt,
        usage: extractUsageFromOpenAIResponse(data)
      });
      return text;
    } catch (error) {
      const isTimeout = error?.name === "AbortError";
      const retryable = isTimeout || isRetryableNetworkError(error);
      const hasNext = attempt <= OPENAI_RETRY_COUNT;
      recordModelTrace({
        step,
        model,
        mode: useChat ? "chat" : "responses",
        maxTokens: maxTokens || 0,
        attempt,
        status: retryable && hasNext ? "retry" : "error",
        durationMs: Date.now() - startedAt,
        error: String(error?.message || "unknown error")
      });

      if (retryable && hasNext) {
        await sleep(600 * attempt);
        continue;
      }

      if (isTimeout) {
        throw new Error(
          `OpenAI request timeout after ${OPENAI_TIMEOUT_MS}ms. Check network/proxy or increase OPENAI_TIMEOUT_MS in .env.`
        );
      }

      if (retryable) {
        throw new Error(
          `Network connection to OpenAI failed after ${attempt} attempts. Check network/proxy, or set OPENAI_BASE_URL in .env.`
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Unexpected request state.");
}

async function generateLexicon(words, quickMode, model) {
  const cacheKey = makeLexiconCacheKey(words, quickMode, model);
  const cached = getFromTimedCache(lexiconCache, cacheKey);
  if (cached) {
    return cloneJsonSafe(cached, []);
  }

  const generateLexiconChunk = async (chunkWords) => {
    const prompt = [
      "You are an IELTS vocabulary assistant.",
      "Return ONLY JSON array.",
      "Each item format:",
      "{\"word\": string, \"pos\": string, \"meanings\": string[], \"collocations\": string[], \"word_formation\": string, \"synonyms\": string[], \"antonyms\": string[]}",
      "Rules:",
      "1) Keep same order as input words.",
      "2) pos should be concise (e.g. n., v., adj., adv.).",
      "3) meanings should be concise Chinese meanings, 1-3 items, ordered by IELTS frequency.",
      "4) meanings[0] MUST be the single most common IELTS exam sense.",
      "5) Avoid rare/archaic niche senses unless absolutely necessary.",
      "6) Prioritize meanings useful for reading/listening/writing tasks.",
      "7) collocations should be common IELTS-friendly phrase combinations (English phrase + concise Chinese).",
      "8) word_formation should include root/prefix/suffix notes when useful.",
      "9) synonyms/antonyms should be common high-frequency exam words.",
      "10) Keep definitions practical and exam-usable; avoid overly technical senses.",
      `Words: ${chunkWords.join(", ")}`
    ].join("\n");

    const text = await callOpenAIText(prompt, { maxTokens: quickMode ? 650 : 1300, model, step: "lexicon" });
    let parsed = extractJsonArray(text);

    if (!Array.isArray(parsed)) {
      const retryPrompt = [
        "Return ONLY JSON array, no markdown, no explanation.",
        "Each item keys must be exactly: word,pos,meanings,collocations,word_formation,synonyms,antonyms.",
        "Keep same order as input words.",
        `Words: ${chunkWords.join(", ")}`
      ].join("\n");
      const retryText = await callOpenAIText(retryPrompt, { maxTokens: quickMode ? 650 : 1300, model, step: "lexicon_retry" });
      parsed = extractJsonArray(retryText);
    }

    return normalizeLexicon(chunkWords, parsed);
  };

  const chunkSize = words.length > LEXICON_CHUNK_SIZE ? LEXICON_CHUNK_SIZE : words.length;
  const chunks = chunkArray(words, chunkSize);
  const chunkResults = await runWithConcurrency(chunks, LEXICON_CHUNK_CONCURRENCY, (chunk) => generateLexiconChunk(chunk));
  let lexicon = chunkResults.flat();

  const failedWords = lexicon
    .filter((x) => (x?.senses || []).some((s) => String(s?.meaning || "").includes("待完善")))
    .map((x) => x.word);

  if (failedWords.length > 0) {
    const retryChunks = chunkArray(failedWords, 4);
    let recoveredAll = [];
    for (const c of retryChunks) {
      const fallbackPrompt = [
        "You are an IELTS vocabulary assistant.",
        "Return ONLY JSON array.",
        "For each word provide practical IELTS meanings and basic word data.",
        "Output format: {\"word\": string, \"pos\": string, \"meanings\": string[], \"collocations\": string[], \"word_formation\": string, \"synonyms\": string[], \"antonyms\": string[]}",
        "meanings[0] MUST be the most common IELTS sense.",
        "Order meanings by IELTS frequency descending.",
        "If a word is misspelled, infer the most likely intended word and still provide useful meanings for the given spelling.",
        `Words: ${c.join(", ")}`
      ].join("\n");
      const fallbackText = await callOpenAIText(fallbackPrompt, { maxTokens: quickMode ? 700 : 1400, model, step: "lexicon_fallback" });
      const fallbackParsed = extractJsonArray(fallbackText);
      recoveredAll = recoveredAll.concat(normalizeLexicon(c, fallbackParsed));
    }
    const recoveredMap = new Map(recoveredAll.map((x) => [x.word.toLowerCase(), x]));
    lexicon = lexicon.map((item) => recoveredMap.get(item.word.toLowerCase()) || item);
  }

  const finalLexicon = cloneJsonSafe(lexicon, []);
  setToTimedCache(lexiconCache, cacheKey, finalLexicon, LEXICON_CACHE_TTL_MS, LEXICON_CACHE_MAX);
  return cloneJsonSafe(finalLexicon, []);
}

async function generateArticlePackage(
  words,
  level,
  quickMode,
  lexicon,
  generationMode = "standard",
  extraConstraint = "",
  model
) {
  const promptLevel = levelToPromptText(level);
  const isMixedMode = String(generationMode || "").toLowerCase() === "mixed";
  const lengthRule = isMixedMode
    ? `Use compact output with ${words.length}-${Math.max(words.length + 2, Math.ceil(words.length * 1.15))} short sentences.`
    : quickMode
      ? "Length: 120-180 words."
      : words.length > 16
        ? "Length: 320-450 words."
        : "Length: 220-320 words.";
  const paragraphRule = isMixedMode
    ? "Break into short blocks (about 3-5 sentences per paragraph) with blank lines."
    : quickMode
      ? "Use 2-3 short paragraphs separated by blank lines."
      : words.length > 16
        ? "Use 4-5 paragraphs separated by blank lines."
        : "Use 3-4 paragraphs separated by blank lines.";

  const vocabGuide = (lexicon || [])
    .map((item) => {
      const senses = Array.isArray(item?.senses) ? item.senses : [];
      const primary = senses[0];
      const primaryText = primary ? `PRIMARY ${primary.marker} ${primary.meaning}` : "PRIMARY ① 常考义待完善";
      const alternates = senses
        .slice(1, 3)
        .map((s) => `${s.marker} ${s.meaning}`)
        .join("; ");
      return alternates
        ? `${item.word} (${item.pos || "-"}): ${primaryText}; secondary: ${alternates}`
        : `${item.word} (${item.pos || "-"}): ${primaryText}`;
    })
    .join("\n");

  const modeRules = isMixedMode
    ? [
        "Write a Chinese-first mixed-language article.",
        "The main body must be short and natural Chinese sentences.",
        "Insert target words in English only, do not translate target words into Chinese.",
        "Never place Chinese gloss directly adjacent to target words (avoid patterns like 水water / 排水drain / water水).",
        "For each target word, use exactly the original input form (no plural/past/ing).",
        "Each target word should appear once if possible, and never more than twice.",
        "Most sentences should contain exactly one target word.",
        "Keep Chinese background concise; avoid long explanatory paragraphs.",
        "Do NOT use glossary parentheses style such as 中文（word） or 中文（word + meaning）.",
        "Do NOT output Chinese gloss + English word pairs such as 板球 cricket / 无菌 sterility.",
        "When Chinese characters directly connect with a target word, keep compact form like 打cricket / 的sterility (no extra spaces).",
        "Avoid duplicate Chinese+English semantics around the same blank: use 非常cruel, not 非常残忍cruel.",
        "Do NOT output keyword list sections such as '片段1：补充关键词 ...'.",
        "Do NOT output standalone dictionary lines such as 'n. xxx' in the body.",
        "If it is hard to connect all words in one coherent story, split into several short fragments/sections, but all target words must be covered."
      ]
    : ["Write an English IELTS-style article."];

  const prompt = [
    ...modeRules,
    "Return ONLY JSON object:",
    '{"title":"...", "article":"..."}',
    `Level: ${promptLevel}.`,
    lengthRule,
    paragraphRule,
    "Article must be plain text paragraphs separated by blank lines.",
    "Every target word must appear at least once.",
    "Use the most common IELTS meaning by default for each word (PRIMARY marker ①).",
    "Only use secondary meanings (②+) when absolutely necessary for coherence.",
    "Whenever a target word appears, append one marker immediately after it, like drain①.",
    "Marker should match the chosen meaning, and prioritize ① whenever possible.",
    "Make title concise and natural.",
    "Vocabulary guide:",
    vocabGuide,
    extraConstraint
  ]
    .filter(Boolean)
    .join("\n");

  const maxTokens = quickMode ? 420 : words.length > 16 ? 1200 : 820;
  const text = await callOpenAIText(prompt, { maxTokens, model, step: "article" });
  const parsed = extractJsonObject(text);

  if (parsed && typeof parsed.title === "string" && typeof parsed.article === "string") {
    return {
      title: parsed.title.trim() || defaultTitleByDate(words.length),
      article: parsed.article.trim()
    };
  }

  const looseParsed = extractTitleArticleLoose(text);
  if (looseParsed && looseParsed.article) {
    return {
      title: looseParsed.title || defaultTitleByDate(words.length),
      article: looseParsed.article
    };
  }

  const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const guessedTitle = lines[0] || defaultTitleByDate(words.length);
  const guessedArticle = lines.slice(1).join("\n\n") || text;

  return {
    title: guessedTitle.replace(/^title\s*:\s*/i, "").trim() || defaultTitleByDate(words.length),
    article: guessedArticle.trim()
  };
}

function appendMissingWordsSentence(article, missingWords, lexicon) {
  if (!missingWords.length) return article;
  const markerMap = new Map(
    (lexicon || []).map((x) => [String(x.word || "").toLowerCase(), String(x?.senses?.[0]?.marker || "①")])
  );
  const phrase = missingWords
    .map((w) => `${w}${markerMap.get(String(w).toLowerCase()) || "①"}`)
    .join(", ");
  return `${article}\n\nVocabulary focus: ${phrase}.`;
}
function defaultTitleByDate(wordCount) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `Vocabulary ${y}-${m}-${d} (${wordCount} words)`;
}

function levelToPromptText(level) {
  if (level === "初级") {
    return "beginner";
  }
  if (level === "高级") {
    return "advanced";
  }
  return "intermediate";
}

function countWordOccurrences(text, word) {
  const source = String(text || "");
  const escaped = String(word || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return 0;
  const regex = new RegExp(`\\b${escaped}\\b`, "gi");
  const matches = source.match(regex);
  return matches ? matches.length : 0;
}

function findOverusedWords(article, words, maxAllowed = 2) {
  const overused = [];
  for (const word of words || []) {
    const count = countWordOccurrences(article, word);
    if (count > maxAllowed) {
      overused.push(word);
    }
  }
  return overused;
}

function cleanMixedArtifactText(article) {
  let text = String(article || "").replace(/\r/g, "");
  text = text.replace(/片段\s*\d+\s*[:：]\s*补充关键词[^\n]*(?:\n|$)/gi, "");
  text = text.replace(/(^|\n)\s*补充关键词[^\n]*(?:\n|$)/gi, "\n");
  text = text.replace(/^\s*\{\s*"title"\s*:\s*"[\s\S]*?"article"\s*:\s*"/i, "");
  text = text.replace(/"\s*\}\s*$/i, "");
  text = text.replace(/\\n/g, "\n").replace(/\\"/g, '"');
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

function normalizeMixedParenthesisGloss(article, words) {
  const source = String(article || "");
  const wordSet = new Set((words || []).map((w) => String(w || "").toLowerCase()));
  if (wordSet.size === 0) {
    return source;
  }

  // Convert patterns like: 中文（drip / drip v. 滴下） -> 中文 drip
  return source.replace(/[（(]\s*([A-Za-z][A-Za-z-]{1,40})([\s\S]{0,80}?)[）)]/g, (full, word) => {
    const token = String(word || "").trim();
    if (!token) return full;
    if (!wordSet.has(token.toLowerCase())) return full;
    return ` ${token}`;
  });
}

function stripStandaloneGlossLines(article, words) {
  const wordSet = new Set((words || []).map((w) => String(w || "").toLowerCase()));
  const lines = String(article || "")
    .split(/\n+/)
    .map((line) => String(line || "").trim());

  const kept = lines.filter((line) => {
    if (!line) return false;
    if (/^(?:n|v|adj|adv)\.\s*[\u4e00-\u9fff]/i.test(line)) {
      return false;
    }
    const lower = line.toLowerCase();
    if (wordSet.has(lower)) {
      return false;
    }
    return true;
  });

  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function buildGlossTokenVariants(rawToken) {
  const token = String(rawToken || "").trim();
  const variants = new Set();
  if (!token) return variants;
  variants.add(token);

  // Common Chinese adjective/adverb particles; helps remove forms like 残忍的 + cruel.
  if (token.length > 1 && /[的地得]$/.test(token)) {
    variants.add(token.slice(0, -1));
  }
  if (token.length > 2 && /[性化]$/.test(token)) {
    variants.add(token.slice(0, -1));
  }
  return variants;
}

function buildMixedInlineGlossMap(lexicon) {
  const map = new Map();
  for (const item of Array.isArray(lexicon) ? lexicon : []) {
    const word = String(item?.word || "").trim().toLowerCase();
    if (!word) continue;
    const senses = Array.isArray(item?.senses) ? item.senses : [];
    const terms = new Set();
    for (const sense of senses) {
      const meaning = String(sense?.meaning || "")
        .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, " ")
        .trim();
      const found = meaning.match(/[\u4e00-\u9fff]{1,8}/g) || [];
      for (const token of found) {
        const variants = buildGlossTokenVariants(token);
        for (const variant of variants) {
          if (variant) terms.add(variant);
        }
      }
    }
    if (terms.size > 0) {
      map.set(word, Array.from(terms).sort((a, b) => b.length - a.length));
    }
  }
  return map;
}

function stripInlineChineseGlossAroundWords(article, lexicon) {
  let text = String(article || "");
  const glossMap = buildMixedInlineGlossMap(lexicon);
  for (const [word, zhTerms] of glossMap.entries()) {
    if (!zhTerms.length) continue;
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const term of zhTerms) {
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const zhBeforeEn = new RegExp(`${escapedTerm}\\s*(${escapedWord})([①②③④⑤⑥⑦⑧⑨⑩]?)`, "gi");
      const enBeforeZh = new RegExp(`(${escapedWord})([①②③④⑤⑥⑦⑧⑨⑩]?)\\s*${escapedTerm}`, "gi");
      text = text.replace(zhBeforeEn, (_m, enWord, marker) => `${enWord}${marker}`);
      text = text.replace(enBeforeZh, (_m, enWord, marker) => `${enWord}${marker}`);
    }
  }
  return text;
}

function normalizeMixedCnEnCompact(article) {
  let text = String(article || "");
  // Keep Chinese-English boundaries compact: 打cricket / 的sterility
  text = text.replace(/([\u4e00-\u9fff])\s+([A-Za-z][A-Za-z-]{0,63}(?:[①②③④⑤⑥⑦⑧⑨⑩])?)/g, "$1$2");
  text = text.replace(/([A-Za-z][A-Za-z-]{0,63}(?:[①②③④⑤⑥⑦⑧⑨⑩])?)\s+([\u4e00-\u9fff])/g, "$1$2");
  return text;
}

function stripModifierParticleAfterWords(article, lexicon) {
  let text = String(article || "");
  const entries = (Array.isArray(lexicon) ? lexicon : [])
    .map((item) => ({
      word: String(item?.word || "").trim(),
      pos: String(item?.pos || "").trim().toLowerCase()
    }))
    .filter((item) => item.word);

  for (const item of entries) {
    let particle = "";
    if (/^(adj|adjective)\.?$/.test(item.pos)) {
      particle = "的";
    } else if (/^(adv|adverb)\.?$/.test(item.pos)) {
      particle = "地";
    }
    if (!particle) continue;
    const escapedWord = escapeRegex(item.word);
    // Mixed mode style target: fundamental的概念 -> fundamental概念 / quickly地处理 -> quickly处理
    const pattern = new RegExp(`\\b(${escapedWord})\\b([①②③④⑤⑥⑦⑧⑨⑩]?)\\s*${particle}`, "gi");
    text = text.replace(pattern, "$1$2");
  }
  return text;
}

function normalizeMixedArticleStyle(article, words, lexicon = []) {
  let text = String(article || "");
  text = cleanMixedArtifactText(text);
  text = normalizeMixedParenthesisGloss(text, words);
  text = stripInlineChineseGlossAroundWords(text, lexicon);
  text = normalizeMixedCnEnCompact(text);
  text = stripModifierParticleAfterWords(text, lexicon);
  text = stripStandaloneGlossLines(text, words);
  text = text.replace(/[ ]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildWordContextSnippetMap(article, words) {
  const source = String(article || "").replace(/\r/g, "\n");
  const segments = source
    .split(/(?<=[。！？!?；;\n])/)
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  const map = new Map();

  for (const rawWord of Array.isArray(words) ? words : []) {
    const word = String(rawWord || "").trim();
    if (!word) continue;
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, "i");
    const hit = segments.find((seg) => regex.test(seg)) || "";
    if (hit) {
      map.set(word.toLowerCase(), hit.replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, "").trim().slice(0, 180));
    }
  }
  return map;
}

function mergeLexiconWithContextMeanings(lexicon, contextRows) {
  const contextMap = new Map();
  for (const row of Array.isArray(contextRows) ? contextRows : []) {
    const word = String(row?.word || "").trim().toLowerCase();
    if (!word || contextMap.has(word)) continue;
    const meaning = String(row?.meaning || "").trim();
    const pos = normalizePosTag(row?.pos);
    contextMap.set(word, { meaning, pos });
  }

  return (Array.isArray(lexicon) ? lexicon : []).map((item) => {
    const word = String(item?.word || "").trim();
    const key = word.toLowerCase();
    const ctx = contextMap.get(key);
    if (!ctx) return item;

    const oldSenses = Array.isArray(item?.senses) ? item.senses : [];
    const fallbackMeaning =
      oldSenses.map((s) => String(s?.meaning || "").trim()).find((x) => /[\u4e00-\u9fff]/.test(x)) || "词义待补充";
    const primaryMeaning = /[\u4e00-\u9fff]/.test(ctx.meaning) ? ctx.meaning : fallbackMeaning;
    const primaryPos = normalizePosTag(ctx.pos || item?.pos || "");

    const senseMeanings = [primaryMeaning];
    for (const sense of oldSenses) {
      const m = String(sense?.meaning || "").trim();
      if (!m || senseMeanings.includes(m)) continue;
      senseMeanings.push(m);
      if (senseMeanings.length >= 5) break;
    }

    const senses = senseMeanings.map((meaning, idx) => ({
      marker: toCircledNumber(idx + 1),
      meaning
    }));

    return {
      ...item,
      pos: primaryPos || normalizePosTag(item?.pos || ""),
      senses
    };
  });
}

function shouldRunContextRefine(words, lexicon) {
  const sourceWords = Array.isArray(words) ? words : [];
  const sourceLexicon = Array.isArray(lexicon) ? lexicon : [];
  if (sourceWords.length === 0 || sourceLexicon.length === 0) return false;

  const sensitiveWords = new Set([
    "sterility",
    "bristle",
    "derive",
    "cricket",
    "plume",
    "cruel",
    "drain",
    "collapse",
    "standard",
    "process",
    "attitude"
  ]);

  let ambiguousCount = 0;
  let hasSensitive = false;
  for (const item of sourceLexicon) {
    const word = String(item?.word || "").trim().toLowerCase();
    if (sensitiveWords.has(word)) {
      hasSensitive = true;
    }
    const sensesCount = Array.isArray(item?.senses) ? item.senses.filter((s) => String(s?.meaning || "").trim()).length : 0;
    if (sensesCount > 1) {
      ambiguousCount += 1;
    }
  }

  if (hasSensitive) return true;
  if (ambiguousCount === 0) return false;
  if (sourceWords.length <= 8) return ambiguousCount >= 4;
  return ambiguousCount >= Math.max(7, Math.ceil(sourceWords.length * 0.6));
}

async function refineMixedLexiconByContext(words, lexicon, article, quickMode, model) {
  const vocab = Array.isArray(lexicon) ? lexicon : [];
  if (!Array.isArray(words) || words.length === 0 || vocab.length === 0) {
    return vocab;
  }

  const contextMap = buildWordContextSnippetMap(article, words);
  const guide = words
    .map((word) => {
      const item = vocab.find((x) => String(x?.word || "").toLowerCase() === String(word || "").toLowerCase());
      const senses = Array.isArray(item?.senses) ? item.senses : [];
      const sensesText = senses.map((s) => `${s.marker} ${String(s?.meaning || "").trim()}`).join("; ");
      const ctx = contextMap.get(String(word || "").toLowerCase()) || "";
      return `${word} | context: ${ctx || "(no context found)"} | candidates: ${sensesText || "(none)"}`;
    })
    .join("\n");

  const prompt = [
    "You are refining Chinese glosses for an IELTS mixed Chinese-English cloze article.",
    "Return ONLY JSON array in same order as input words.",
    "Each item format: {\"word\": string, \"pos\": string, \"meaning\": string}.",
    "pos must be an English POS tag like n., v., adj., adv., prep., pron., conj., num., det., int.",
    "meaning must match the article context exactly and be concise Chinese (2-8 chars).",
    "Prioritize the most common IELTS exam sense in this context.",
    "Avoid rare/archaic senses and avoid literal dictionary noise.",
    "When context is lab cleanliness, sterility should be 无菌 (not 不育).",
    "When context is emotional anger, bristle should be 发怒/恼火 (not 竖起).",
    "Do not include English in meaning.",
    `Words: ${words.join(", ")}`,
    "Word context + candidate senses:",
    guide
  ].join("\n");

  try {
    const text = await callOpenAIText(prompt, { maxTokens: quickMode ? 420 : 820, model, step: "refine_context" });
    const parsed = extractJsonArray(text);
    if (!Array.isArray(parsed)) {
      return vocab;
    }
    return mergeLexiconWithContextMeanings(vocab, parsed);
  } catch (error) {
    console.error("Failed to refine context meanings:", error.message);
    return vocab;
  }
}

function buildMissingRewriteFallback(missingWords, lexicon, generationMode = "mixed") {
  const markerMap = new Map(
    (lexicon || []).map((x) => [String(x.word || "").toLowerCase(), String(x?.senses?.[0]?.marker || "①")])
  );
  const isMixedMode = String(generationMode || "").toLowerCase() === "mixed";
  const lines = (missingWords || []).map((word, index) => {
    const marker = markerMap.get(String(word).toLowerCase()) || "①";
    const token = `${word}${marker}`;
    if (isMixedMode) {
      return `补写句${index + 1}：这个场景里我重新记住了 ${token}。`;
    }
    return `Supplement ${index + 1}: The key point in this line is ${token}.`;
  });
  return lines.join("\n");
}

async function generateMissingWordsRewrite(missingWords, lexicon, generationMode, quickMode, model) {
  const words = Array.isArray(missingWords) ? missingWords.map((x) => String(x || "").trim()).filter(Boolean) : [];
  if (words.length === 0) {
    return "";
  }

  const guideMap = new Map((lexicon || []).map((item) => [String(item?.word || "").toLowerCase(), item]));
  const vocabGuide = words
    .map((word) => {
      const item = guideMap.get(word.toLowerCase());
      const pos = String(item?.pos || "").trim();
      const senses = Array.isArray(item?.senses) ? item.senses : [];
      const meaning = senses.map((s) => String(s?.meaning || "").trim()).find(Boolean) || "词义待补充";
      return `${word} (${pos || "-"}): ${meaning}`;
    })
    .join("\n");

  const isMixedMode = String(generationMode || "").toLowerCase() === "mixed";
  const prompt = isMixedMode
    ? [
        "You are rewriting missing vocabulary content for a mixed Chinese-English learning passage.",
        "Return plain text only. No JSON, no markdown, no list bullets.",
        "Write concise Chinese sentences.",
        "Each sentence must include exactly one target English word in original form.",
        "Each target word must appear exactly once across the whole output.",
        "Do NOT output Chinese gloss + English word pairs such as 板球 cricket / 无菌 sterility.",
        "When Chinese characters directly connect with a target word, keep compact form like 打cricket / 的sterility (no extra spaces).",
        "Do NOT use parentheses style like 中文（word）.",
        "Do NOT output standalone dictionary lines such as 'n. xxx'.",
        "Words:",
        words.join(", "),
        "Vocabulary guide:",
        vocabGuide
      ].join("\n")
    : [
        "You are rewriting missing vocabulary content for an English passage.",
        "Return plain text only.",
        "Write concise natural English sentences.",
        "Each sentence must include exactly one target word.",
        "Each target word must appear exactly once.",
        "Words:",
        words.join(", "),
        "Vocabulary guide:",
        vocabGuide
      ].join("\n");

  try {
    const rewritten = await callOpenAIText(prompt, { maxTokens: quickMode ? 220 : 420, model, step: "rewrite_missing" });
    const cleaned = isMixedMode ? cleanMixedArtifactText(rewritten) : String(rewritten || "").trim();
    if (cleaned) {
      return cleaned;
    }
  } catch (error) {
    console.error("Failed to rewrite missing words:", error.message);
  }

  return buildMissingRewriteFallback(words, lexicon, generationMode);
}

async function generateParagraphTranslations(paragraphs, lexicon, quickMode, model) {
  if (!paragraphs.length) {
    return [];
  }

  const vocabHints = lexicon
    .map((item) => {
      const sensesText = item.senses.map((s) => `${s.marker} ${s.meaning}`).join("; ");
      return `${item.word}: ${sensesText}`;
    })
    .join("\n");

  const prompt = [
    "Translate each English paragraph into Chinese.",
    "Return ONLY JSON array of strings, same order and same length.",
    "Keep markers like ①② in translation when they appear.",
    "Use concise natural Chinese.",
    "Vocabulary guide:",
    vocabHints,
    "Paragraphs JSON:",
    JSON.stringify(paragraphs)
  ].join("\n");

  const text = await callOpenAIText(prompt, { maxTokens: quickMode ? 520 : 980, model, step: "translate_paragraphs" });
  const parsed = extractJsonArray(text);

  if (!Array.isArray(parsed)) {
    return paragraphs.map(() => "(该段翻译生成失败，请重试)");
  }

  return paragraphs.map((_, i) => {
    const value = parsed[i];
    return typeof value === "string" && value.trim() ? value.trim() : "(该段翻译生成失败，请重试)";
  });
}

function buildWordFormRegex(word) {
  const base = String(word || "").toLowerCase();
  if (!base) return /\b\B/gi;

  const forms = new Set([base]);
  const add = (x) => {
    const v = String(x || "").trim().toLowerCase();
    if (v) forms.add(v);
  };

  add(`${base}s`);
  add(`${base}es`);
  add(`${base}ed`);
  add(`${base}ing`);
  add(`${base}age`);
  add(`${base}ages`);
  add(`${base}al`);
  add(`${base}ally`);
  add(`${base}ment`);
  add(`${base}ments`);
  add(`${base}tion`);
  add(`${base}tions`);
  add(`${base}er`);
  add(`${base}ers`);
  add(`${base}ly`);
  add(`${base}ness`);
  add(`${base}y`);
  add(`${base}ies`);

  if (base.endsWith("ate") && base.length > 4) {
    const stem = base.slice(0, -3);
    add(`${stem}acy`);
    add(`${stem}acies`);
    add(`${stem}ation`);
    add(`${stem}ations`);
  }

  if (base.endsWith("e") && base.length > 3) {
    const stem = base.slice(0, -1);
    add(`${stem}ion`);
    add(`${stem}ions`);
    add(`${stem}ive`);
    add(`${stem}ivity`);
  }

  const escaped = Array.from(forms)
    .sort((a, b) => b.length - a.length)
    .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
}

function inferFormsFromArticle(word, paragraphsEn) {
  const text = String((paragraphsEn || []).join("\n") || "");
  const regex = buildWordFormRegex(word);
  const found = new Set();
  let m;
  while ((m = regex.exec(text)) !== null) {
    const v = String(m[1] || "").trim();
    if (v) found.add(v);
  }
  return Array.from(found);
}

function normalizeAlignment(words, lexicon, raw, paragraphsEn, paragraphsZh) {
  const allowed = new Set((words || []).map((w) => String(w || "").toLowerCase()));
  const lexMap = new Map((lexicon || []).map((x) => [String(x.word || "").toLowerCase(), x]));
  const items = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
  const enTextRaw = (paragraphsEn || []).join("\n");
  const enText = (paragraphsEn || []).join("\n").toLowerCase();
  const zhText = (paragraphsZh || []).join("\n");
  const output = [];
  const seen = new Set();
  const stripMarkers = (x) => String(x || "").replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, "").trim();

  const appearsInEn = (x) => {
    const v = String(x || "").trim().toLowerCase();
    return v ? enText.includes(v) : false;
  };
  const appearsInZh = (x) => {
    const v = String(x || "").trim();
    return v ? zhText.includes(v) : false;
  };
  const detectMarkerFromForms = (forms) => {
    const list = Array.from(
      new Set((Array.isArray(forms) ? forms : []).map((x) => String(x || "").trim()).filter(Boolean))
    ).sort((a, b) => b.length - a.length);
    for (const form of list) {
      const regex = new RegExp(`\\b${escapeRegex(form)}\\b\\s*([①②③④⑤⑥⑦⑧⑨⑩])`, "i");
      const matched = enTextRaw.match(regex);
      if (matched && matched[1]) {
        return matched[1];
      }
    }
    return "";
  };

  for (const item of items) {
    const word = String(item?.word || "").trim();
    if (!word) continue;
    const lw = word.toLowerCase();
    if (!allowed.has(lw) || seen.has(lw)) continue;
    const lex = lexMap.get(lw);
    let zhTerms = (Array.isArray(item?.zh_terms) ? item.zh_terms : [])
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .filter(appearsInZh)
      .slice(0, 10);
    let englishForms = (Array.isArray(item?.english_forms) ? item.english_forms : [])
      .map((x) => stripMarkers(x))
      .filter(Boolean)
      .filter(appearsInEn)
      .slice(0, 10);
    const inferredForms = inferFormsFromArticle(word, paragraphsEn).map(stripMarkers).filter(appearsInEn);
    englishForms = Array.from(new Set([...englishForms, ...inferredForms]));
    if (englishForms.length === 0 && appearsInEn(word)) englishForms = [word];
    const markerFromArticle = detectMarkerFromForms([word, ...englishForms, ...inferredForms]);
    output.push({
      word: lex?.word || word,
      marker: String(markerFromArticle || item?.marker || lex?.senses?.[0]?.marker || "①"),
      zh_terms: zhTerms,
      english_forms: englishForms
    });
    seen.add(lw);
  }

  for (const w of words || []) {
    const lw = String(w || "").toLowerCase();
    if (seen.has(lw)) continue;
    const lex = lexMap.get(lw);
    const fallbackZh = Array.isArray(lex?.senses)
      ? lex.senses
          .map((s) => String(s?.meaning || "").trim())
          .filter(Boolean)
          .filter(appearsInZh)
      : [];
    const inferredForms = inferFormsFromArticle(w, paragraphsEn).map(stripMarkers).filter(appearsInEn);
    const finalForms = inferredForms.length > 0 ? inferredForms : appearsInEn(String(w || "")) ? [String(w || "")] : [];
    const markerFromArticle = detectMarkerFromForms([String(w || ""), ...finalForms]);
    output.push({
      word: String(w || ""),
      marker: String(markerFromArticle || lex?.senses?.[0]?.marker || "①"),
      zh_terms: fallbackZh.slice(0, 10),
      english_forms: finalForms
    });
  }

  return output;
}

async function generateAlignment(words, lexicon, paragraphsEn, paragraphsZh, quickMode, model, generationMode = "standard") {
  if (!Array.isArray(words) || words.length === 0) {
    return [];
  }

  const localAlignment = normalizeAlignment(words, lexicon, [], paragraphsEn, paragraphsZh);
  const localCovered = localAlignment.filter((row) => Array.isArray(row?.english_forms) && row.english_forms.length > 0).length;
  const localCoverage = words.length > 0 ? localCovered / words.length : 1;

  // Mixed mode only needs accurate English-form mapping for click/jump; local rules are usually enough.
  if (String(generationMode || "").toLowerCase() === "mixed" && localCoverage >= 0.9) {
    return localAlignment;
  }

  const vocabHints = lexicon
    .map((item) => {
      const sensesText = item.senses.map((s) => `${s.marker} ${s.meaning}`).join("; ");
      return `${item.word}: ${sensesText}`;
    })
    .join("\n");

  const prompt = [
    "You align IELTS target words to bilingual article terms.",
    "Return ONLY JSON object with key \"items\".",
    "items[] format:",
    "{\"word\": string, \"marker\": \"①-⑩\", \"english_forms\": string[], \"zh_terms\": string[]}",
    "Rules:",
    "1) word must be one of target words.",
    "2) english_forms: forms actually appearing in English article, include variants like literacy, drainage, mishaps when aligned.",
    "3) zh_terms: Chinese terms that MUST appear literally in Chinese translation.",
    "4) marker should match the closest sense marker in vocabulary guide.",
    "5) No explanation text.",
    `Target words: ${words.join(", ")}`,
    "Vocabulary guide:",
    vocabHints,
    "English paragraphs JSON:",
    JSON.stringify(paragraphsEn || []),
    "Chinese paragraphs JSON:",
    JSON.stringify(paragraphsZh || [])
  ].join("\n");

  try {
    const text = await callOpenAIText(prompt, { maxTokens: quickMode ? 680 : 1200, model, step: "alignment" });
    const parsedObj = extractJsonObject(text);
    if (parsedObj) {
      return normalizeAlignment(words, lexicon, parsedObj, paragraphsEn, paragraphsZh);
    }
    const parsedArr = extractJsonArray(text);
    return normalizeAlignment(words, lexicon, parsedArr, paragraphsEn, paragraphsZh);
  } catch {
    return localAlignment;
  }
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim() || "Texta User";
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: "Please provide a valid email." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const store = await readAuthStore();
    const exists = store.users.some((u) => String(u.email || "").toLowerCase() === email);
    if (exists) {
      return res.status(409).json({ error: "Email already registered." });
    }

    const pw = hashPassword(password);
    const role = ADMIN_EMAIL && email === ADMIN_EMAIL ? "admin" : "user";
    const user = {
      id: `u_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      email,
      name,
      passwordHash: pw.hash,
      role,
      plan: role === "admin" ? "vip" : "free",
      createdAt: new Date().toISOString()
    };
    store.users.push(user);
    await writeAuthStore(store);

    res.status(201).json({ ok: true, user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to register.", detail: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const store = await readAuthStore();
    const user = store.users.find((u) => String(u.email || "").toLowerCase() === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = `tk_${crypto.randomBytes(24).toString("hex")}`;
    const expiresAt = Date.now() + AUTH_TOKEN_TTL_MS;
    store.sessions = (store.sessions || []).filter((s) => Number(s?.expiresAt || 0) > Date.now());
    store.sessions.push({ token, userId: user.id, expiresAt, createdAt: Date.now() });
    await writeAuthStore(store);

    res.json({ ok: true, token, user: publicUser(user), expiresAt });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to login.", detail: error.message });
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized." });
    }
    res.json({ ok: true, user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get profile.", detail: error.message });
  }
});

app.get("/api/usage", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const store = await readAuthStore();
    const usage = getUsageSnapshot(store, user);
    res.json({ ok: true, usage, role: user.role || "user", plan: user.plan || "free" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get usage.", detail: error.message });
  }
});

app.get("/api/library", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const [favoriteRows, notebookRows, vocabRows] = await Promise.all([
      prisma.favoriteArticle.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" }
      }),
      prisma.notebookEntry.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" }
      }),
      prisma.userVocabPref.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" }
      })
    ]);

    const favorites = favoriteRows.map((row) => {
      const alignmentParsed = parseAlignmentPayload(row.alignment);
      return {
        id: decodeFavoriteId(user.id, row.id),
        title: row.title,
        savedAt: row.savedAt,
        words: Array.isArray(row.words) ? row.words : [],
        article: row.article,
        lexicon: Array.isArray(row.lexicon) ? row.lexicon : [],
        paragraphsEn: Array.isArray(row.paragraphsEn) ? row.paragraphsEn : [],
        paragraphsZh: Array.isArray(row.paragraphsZh) ? row.paragraphsZh : [],
        alignment: alignmentParsed.items,
        generationMode: alignmentParsed.generationMode,
        generationQuality: alignmentParsed.generationQuality,
        missing: Array.isArray(row.missing) ? row.missing : [],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    });

    const notebookEntries = notebookRows.map((row) => ({
      id: row.id,
      key: row.wordKey,
      word: row.word,
      pos: row.pos,
      senses: Array.isArray(row.senses) ? row.senses : [],
      collocations: Array.isArray(row.collocations) ? row.collocations : [],
      synonyms: Array.isArray(row.synonyms) ? row.synonyms : [],
      antonyms: Array.isArray(row.antonyms) ? row.antonyms : [],
      wordFormation: row.wordFormation,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));

    const vocabPrefs = {};
    for (const row of vocabRows) {
      vocabPrefs[row.wordKey] = {
        word: row.word,
        mastery: row.mastery,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }

    res.json({ ok: true, favorites, notebookEntries, vocabPrefs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load library.", detail: error.message });
  }
});

app.post("/api/library/sync", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const favoriteRows = sanitizeFavoritesPayload(req.body?.favorites).map((row) => ({
      ...row,
      id: encodeFavoriteId(user.id, row.id),
      userId: user.id
    }));
    const notebookRows = sanitizeNotebookPayload(req.body?.notebookEntries).map((row) => ({
      ...row,
      userId: user.id
    }));
    const vocabRows = sanitizeVocabPrefsPayload(req.body?.vocabPrefs).map((row) => ({
      ...row,
      userId: user.id
    }));

    await prisma.favoriteArticle.deleteMany({ where: { userId: user.id } });
    await prisma.notebookEntry.deleteMany({ where: { userId: user.id } });
    await prisma.userVocabPref.deleteMany({ where: { userId: user.id } });

    if (favoriteRows.length > 0) {
      await prisma.favoriteArticle.createMany({ data: favoriteRows });
    }
    if (notebookRows.length > 0) {
      await prisma.notebookEntry.createMany({ data: notebookRows });
    }
    if (vocabRows.length > 0) {
      await prisma.userVocabPref.createMany({ data: vocabRows });
    }

    res.json({
      ok: true,
      counts: {
        favorites: favoriteRows.length,
        notebookEntries: notebookRows.length,
        vocabPrefs: vocabRows.length
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to sync library.", detail: error.message });
  }
});

app.post("/api/upgrade/request", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const role = String(user.role || "").toLowerCase();
    const plan = String(user.plan || "free").toLowerCase();
    if (role === "admin" || plan === "vip") {
      return res.json({ ok: true, submitted: false, message: "Already VIP/admin." });
    }

    const store = await readAuthStore();
    if (!Array.isArray(store.vipRequests)) {
      store.vipRequests = [];
    }

    const hasPending = store.vipRequests.some((x) => x.userId === user.id && x.status === "pending");
    if (hasPending) {
      return res.status(409).json({ error: "You already have a pending VIP request." });
    }

    const payerName = String(req.body.payerName || "").trim();
    const amount = String(req.body.amount || "10").trim();
    const paidAt = String(req.body.paidAt || "").trim();
    const proofCode = String(req.body.proofCode || "").trim();
    const proofImageUrl = String(req.body.proofImageUrl || "").trim();
    const note = String(req.body.note || "").trim();

    const requestItem = {
      id: `vipreq_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      userId: user.id,
      userEmail: user.email,
      payerName: payerName || user.name || user.email,
      amount: amount || "10",
      paidAt: paidAt || new Date().toISOString(),
      proofCode,
      proofImageUrl,
      note,
      status: "pending",
      createdAt: new Date().toISOString(),
      reviewedAt: "",
      reviewerId: "",
      reviewNote: ""
    };
    store.vipRequests.unshift(requestItem);
    await writeAuthStore(store);
    res.json({ ok: true, submitted: true, request: requestItem });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to submit VIP request.", detail: error.message });
  }
});

app.get("/api/upgrade/request/me", async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const store = await readAuthStore();
    const items = (store.vipRequests || []).filter((x) => x.userId === user.id).slice(0, 20);
    res.json({ ok: true, items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get VIP requests.", detail: error.message });
  }
});

app.get("/api/admin/vip-requests", async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const store = await readAuthStore();
    const status = String(req.query.status || "pending").trim().toLowerCase();
    const items = (store.vipRequests || []).filter((x) => (status ? String(x.status || "").toLowerCase() === status : true));
    res.json({ ok: true, items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get VIP requests.", detail: error.message });
  }
});

app.get("/api/admin/usage-overview", async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const [users, usageDailyRows, usageLogRows] = await Promise.all([
      prisma.user.findMany(),
      prisma.usageDaily.findMany(),
      prisma.usageLog.findMany({ orderBy: { usedAt: "desc" } })
    ]);

    const totalUsageMap = new Map();
    for (const row of usageDailyRows) {
      totalUsageMap.set(row.userId, Number(totalUsageMap.get(row.userId) || 0) + Number(row.used || 0));
    }

    const detailedUsageMap = new Map();
    for (const row of usageLogRows) {
      if (!detailedUsageMap.has(row.userId)) {
        detailedUsageMap.set(row.userId, {
          totalDetailed: 0,
          latestUsedAt: "",
          periods: new Map()
        });
      }

      const userUsage = detailedUsageMap.get(row.userId);
      userUsage.totalDetailed += 1;
      if (!userUsage.latestUsedAt || String(row.usedAt || "") > userUsage.latestUsedAt) {
        userUsage.latestUsedAt = String(row.usedAt || "");
      }

      const periodKey = String(row.hourKey || "");
      if (!userUsage.periods.has(periodKey)) {
        userUsage.periods.set(periodKey, {
          hourKey: periodKey,
          periodLabel: String(row.periodLabel || periodKey || "未知时段"),
          count: 0,
          latestUsedAt: String(row.usedAt || "")
        });
      }

      const period = userUsage.periods.get(periodKey);
      period.count += 1;
      if (!period.latestUsedAt || String(row.usedAt || "") > period.latestUsedAt) {
        period.latestUsedAt = String(row.usedAt || "");
      }
    }

    const items = users
      .map((user) => {
        const detail = detailedUsageMap.get(user.id);
        const totalUsage = Number(totalUsageMap.get(user.id) || 0);
        const detailedUsageCount = Number(detail?.totalDetailed || 0);
        const legacyUsageCount = Math.max(totalUsage - detailedUsageCount, 0);

        return {
          ...publicUser(user),
          createdAt: user.createdAt,
          totalUsage,
          detailedUsageCount,
          legacyUsageCount,
          latestUsedAt: detail?.latestUsedAt || ""
        };
      })
      .sort(compareUsageUsers);

    res.json({ ok: true, items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get usage overview.", detail: error.message });
  }
});

app.get("/api/admin/usage-users/:id/detail", async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const userId = String(req.params.id || "").trim();
    if (!userId) {
      return res.status(400).json({ error: "Missing user id." });
    }

    const [user, usageDailyRows, usageLogRows] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.usageDaily.findMany({
        where: { userId },
        orderBy: { dateKey: "asc" }
      }),
      prisma.usageLog.findMany({
        where: { userId },
        orderBy: { usedAt: "desc" }
      })
    ]);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const totalUsage = usageDailyRows.reduce((sum, row) => sum + Number(row.used || 0), 0);
    const detailedUsageCount = usageLogRows.length;
    const legacyUsageCount = Math.max(totalUsage - detailedUsageCount, 0);
    const latestUsedAt = usageLogRows[0]?.usedAt || "";

    const dailyUsage = usageDailyRows.map((row) => ({
      dateKey: String(row.dateKey || ""),
      count: Number(row.used || 0)
    }));

    const hourlyMap = new Map();
    for (let hour = 0; hour < 24; hour += 1) {
      const hourLabel = `${String(hour).padStart(2, "0")}:00`;
      hourlyMap.set(hourLabel, { hourLabel, count: 0 });
    }

    const periodMap = new Map();
    for (const row of usageLogRows) {
      const periodLabel = String(row.periodLabel || "未知时段");
      if (!periodMap.has(periodLabel)) {
        periodMap.set(periodLabel, {
          periodLabel,
          count: 0,
          latestUsedAt: String(row.usedAt || "")
        });
      }
      const period = periodMap.get(periodLabel);
      period.count += 1;
      if (!period.latestUsedAt || String(row.usedAt || "") > period.latestUsedAt) {
        period.latestUsedAt = String(row.usedAt || "");
      }

      const hourKey = String(row.hourKey || "");
      const hourOnly = hourKey.slice(-2);
      const hourLabel = `${hourOnly}:00`;
      if (hourlyMap.has(hourLabel)) {
        hourlyMap.get(hourLabel).count += 1;
      }
    }

    const hourlyUsage = Array.from(hourlyMap.values());
    const recentPeriods = Array.from(periodMap.values())
      .sort((a, b) => String(b.periodLabel || "").localeCompare(String(a.periodLabel || "")))
      .slice(0, 30);

    res.json({
      ok: true,
      item: {
        ...publicUser(user),
        createdAt: user.createdAt,
        totalUsage,
        detailedUsageCount,
        legacyUsageCount,
        latestUsedAt,
        dailyUsage,
        hourlyUsage,
        recentPeriods
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get usage detail.", detail: error.message });
  }
});

app.post("/api/admin/vip-requests/:id/approve", async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const id = String(req.params.id || "").trim();
    const store = await readAuthStore();
    const reqIdx = (store.vipRequests || []).findIndex((x) => x.id === id);
    if (reqIdx === -1) {
      return res.status(404).json({ error: "Request not found." });
    }
    const reqItem = store.vipRequests[reqIdx];
    if (reqItem.status !== "pending") {
      return res.status(409).json({ error: "Request already reviewed." });
    }
    reqItem.status = "approved";
    reqItem.reviewedAt = new Date().toISOString();
    reqItem.reviewerId = admin.id;
    reqItem.reviewNote = String(req.body.note || "").trim();

    const userIdx = store.users.findIndex((x) => x.id === reqItem.userId);
    if (userIdx !== -1) {
      store.users[userIdx].plan = "vip";
    }
    await writeAuthStore(store);
    res.json({ ok: true, request: reqItem });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to approve request.", detail: error.message });
  }
});

app.post("/api/admin/vip-requests/:id/reject", async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const id = String(req.params.id || "").trim();
    const store = await readAuthStore();
    const reqIdx = (store.vipRequests || []).findIndex((x) => x.id === id);
    if (reqIdx === -1) {
      return res.status(404).json({ error: "Request not found." });
    }
    const reqItem = store.vipRequests[reqIdx];
    if (reqItem.status !== "pending") {
      return res.status(409).json({ error: "Request already reviewed." });
    }
    reqItem.status = "rejected";
    reqItem.reviewedAt = new Date().toISOString();
    reqItem.reviewerId = admin.id;
    reqItem.reviewNote = String(req.body.note || "").trim();
    await writeAuthStore(store);
    res.json({ ok: true, request: reqItem });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to reject request.", detail: error.message });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.json({ ok: true });
    }
    const store = await readAuthStore();
    store.sessions = (store.sessions || []).filter((s) => s.token !== token);
    await writeAuthStore(store);
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to logout.", detail: error.message });
  }
});
app.post("/api/spellcheck", async (req, res) => {
  try {
    const authedUser = await requireAuth(req, res);
    if (!authedUser) return;
    const words = splitWords(String(req.body.words || ""));
    const targets = words.filter((w) => /^[A-Za-z-]{3,}$/.test(w));

    const checks = await Promise.all(
      targets.map(async (word) => {
        const url = `https://api.datamuse.com/sug?s=${encodeURIComponent(word)}&max=5`;
        const response = await fetch(url);
        if (!response.ok) {
          return { word, ok: true, suggestion: "" };
        }
        const data = await response.json();
        const suggestions = Array.isArray(data) ? data.map((x) => String(x.word || "").trim()).filter(Boolean) : [];
        if (suggestions.some((s) => s.toLowerCase() === word.toLowerCase())) {
          return { word, ok: true, suggestion: "" };
        }
        const top = suggestions[0] || "";
        if (!top) {
          return { word, ok: true, suggestion: "" };
        }
        const distance = editDistance(word, top);
        const maybeMisspelled = distance <= 2 || (word.length >= 8 && distance <= 3);
        return { word, ok: !maybeMisspelled, suggestion: maybeMisspelled ? top : "" };
      })
    );

    const resultMap = new Map(checks.map((x) => [x.word.toLowerCase(), x]));
    const items = words.map((word) => {
      const found = resultMap.get(word.toLowerCase());
      return found || { word, ok: true, suggestion: "" };
    });

    res.json({ items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to spellcheck.", detail: error.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "texta-api" });
});

app.post("/api/generate", async (req, res) => {
  try {
    const authedUser = await requireAuth(req, res);
    if (!authedUser) return;
    const storeBefore = await readAuthStore();
    const usageBefore = getUsageSnapshot(storeBefore, authedUser);
    const generationQuality = normalizeGenerationQuality(req.body?.generationQuality || "normal");
    const generationProfile = getGenerationProfile(generationQuality);

    if (!usageBefore.isUnlimited && Number(usageBefore.remaining || 0) < generationProfile.usageCost) {
      return res.status(429).json({
        error: `Insufficient quota. ${generationQuality === "advanced" ? "Advanced generation" : "Normal generation"} requires ${generationProfile.usageCost} use(s).`,
        usage: usageBefore,
        needed: generationProfile.usageCost,
        generationQuality
      });
    }
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY in .env" });
    }

    const rawWords = String(req.body.words || "");
    const level = String(req.body.level || "中级");
    const quickMode = Boolean(req.body.quickMode);
    const generationMode = String(req.body.generationMode || "standard").toLowerCase() === "mixed" ? "mixed" : "standard";
    const words = splitWords(rawWords);

    if (words.length === 0) {
      return res.status(400).json({ error: "Please provide at least one word." });
    }

    if (words.length > 120) {
      return res.status(400).json({ error: "Too many words. Please keep it under 120 words." });
    }

    const selectedModel = generationProfile.model;
    const isAdmin = String(authedUser?.role || "").toLowerCase() === "admin";
    const traceStore = { calls: [] };

    const generateContent = async () => {
      let lexicon = await generateLexicon(words, quickMode, selectedModel);
      let articlePack = await generateArticlePackage(words, level, quickMode, lexicon, generationMode, "", selectedModel);
      if (generationMode === "mixed") {
        articlePack.article = normalizeMixedArticleStyle(articlePack.article, words, lexicon);
      }
      articlePack.article = enforceWordMarkers(articlePack.article, lexicon);
      let missing = findMissingWords(articlePack.article, words);
      let overused = generationMode === "mixed" ? findOverusedWords(articlePack.article, words, 2) : [];

      const retryCount = generationMode === "mixed" ? (quickMode ? 2 : 4) : quickMode ? 1 : 2;
      for (let i = 0; i < retryCount && (missing.length > 0 || overused.length > 0); i += 1) {
        articlePack = await generateArticlePackage(
          words,
          level,
          quickMode,
          lexicon,
          generationMode,
          [
            `Important fix (round ${i + 1}): ALL target words must be included.`,
            `Missing words: ${missing.join(", ")}.`,
            overused.length > 0
              ? `Overused words (too many repeats): ${overused.join(", ")}. Reduce each to 1 occurrence, max 2.`
              : "",
            "If needed, split into short fragments, but keep natural Chinese body and include every target word.",
            "Mixed mode must look compact: most sentences include one target word and avoid long Chinese-only lines."
          ].join(" "),
          selectedModel
        );
        if (generationMode === "mixed") {
          articlePack.article = normalizeMixedArticleStyle(articlePack.article, words, lexicon);
        }
        articlePack.article = enforceWordMarkers(articlePack.article, lexicon);
        missing = findMissingWords(articlePack.article, words);
        overused = generationMode === "mixed" ? findOverusedWords(articlePack.article, words, 2) : [];
      }

      if (generationMode === "mixed") {
        articlePack.article = normalizeMixedArticleStyle(articlePack.article, words, lexicon);
        articlePack.article = enforceWordMarkers(articlePack.article, lexicon);
        missing = findMissingWords(articlePack.article, words);
      }

      if (missing.length > 0) {
        if (generationMode !== "mixed") {
          articlePack.article = appendMissingWordsSentence(articlePack.article, missing, lexicon);
          articlePack.article = enforceWordMarkers(articlePack.article, lexicon);
          missing = findMissingWords(articlePack.article, words);
        } else {
          const missingBeforeRewrite = missing.slice();
          const rewriteNotice = `提示：主文章仍有 ${missingBeforeRewrite.length} 个词未命中：${missingBeforeRewrite.join(", ")}。以下为补充重写短句：`;
          const rewritten = await generateMissingWordsRewrite(
            missingBeforeRewrite,
            lexicon,
            generationMode,
            quickMode,
            selectedModel
          );
          articlePack.article = `${String(articlePack.article || "").trim()}\n\n${rewriteNotice}\n${rewritten}`.trim();
          articlePack.article = normalizeMixedArticleStyle(articlePack.article, words, lexicon);
          articlePack.article = enforceWordMarkers(articlePack.article, lexicon);
          missing = findMissingWords(articlePack.article, words);

          if (missing.length > 0) {
            const fallbackRewrite = buildMissingRewriteFallback(missing, lexicon, generationMode);
            articlePack.article = `${String(articlePack.article || "").trim()}\n${fallbackRewrite}`.trim();
            articlePack.article = normalizeMixedArticleStyle(articlePack.article, words, lexicon);
            articlePack.article = enforceWordMarkers(articlePack.article, lexicon);
            missing = findMissingWords(articlePack.article, words);
          }
        }
      }

      if (generationMode === "mixed" && shouldRunContextRefine(words, lexicon)) {
        lexicon = await refineMixedLexiconByContext(words, lexicon, articlePack.article, quickMode, selectedModel);
        articlePack.article = String(articlePack.article || "").replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, "");
        articlePack.article = normalizeMixedArticleStyle(articlePack.article, words, lexicon);
        articlePack.article = enforceWordMarkers(articlePack.article, lexicon);
        missing = findMissingWords(articlePack.article, words);
      }

      const paragraphsEn = splitParagraphs(articlePack.article);
      const paragraphsZh = generationMode === "mixed" ? [] : await generateParagraphTranslations(paragraphsEn, lexicon, quickMode, selectedModel);
      const alignment = await generateAlignment(words, lexicon, paragraphsEn, paragraphsZh, quickMode, selectedModel, generationMode);
      const defaultTitle = defaultTitleByDate(words.length);

      return { lexicon, articlePack, missing, paragraphsEn, paragraphsZh, alignment, defaultTitle };
    };

    const generated = isAdmin
      ? await modelTraceStorage.run(traceStore, generateContent)
      : await generateContent();

    const { lexicon, articlePack, missing, paragraphsEn, paragraphsZh, alignment, defaultTitle } = generated;

    const storeAfter = await readAuthStore();
    bumpUsage(storeAfter, authedUser, getShanghaiDateKey(), generationProfile.usageCost);
    await writeAuthStore(storeAfter);
    try {
      await logUsageEvent(authedUser, new Date(), generationProfile.usageCost);
    } catch (usageLogError) {
      console.error("Failed to write usage log:", usageLogError);
    }
    const usage = getUsageSnapshot(storeAfter, authedUser);

    const adminDiagnostics = isAdmin ? buildAdminModelDiagnostics(traceStore) : null;

    res.json({
      title: articlePack.title || defaultTitle,
      defaultTitle,
      article: articlePack.article,
      generationMode,
      generationQuality,
      usageCost: generationProfile.usageCost,
      model: selectedModel,
      missing,
      lexicon,
      paragraphsEn,
      paragraphsZh,
      alignment,
      usage,
      ...(isAdmin ? { adminDiagnostics } : {})
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate article.", detail: error.message });
  }
});

async function bootstrap() {
  await ensureAdminSeed();
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to bootstrap server:", error);
  process.exit(1);
});



