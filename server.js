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
const MIXED_HARD_WORDS = new Set(["derive", "sterility", "collapse", "process", "standard"]);
const MIXED_FORCE_ENGLISH_WORDS = new Set([
  "budget",
  "relax",
  "process",
  "standard",
  "attitude",
  "motivation",
  "cover",
  "reject",
  "derive",
  "contribute",
  "expenses",
  "vacation"
]);
const MIXED_FORCE_ENGLISH_TEMPLATES = {
  budget: {
    preferredPattern: "用好budget",
    forbiddenChineseOnly: ["用好预算", "控制预算", "预算"],
    allowedTemplates: ["用好budget", "budget要控制好", "别超出budget"]
  },
  relax: {
    preferredPattern: "需要relax一下",
    forbiddenChineseOnly: ["放松一下", "需要放松", "放松"],
    allowedTemplates: ["需要relax一下", "先relax一下", "周末可以relax"]
  },
  process: {
    preferredPattern: "按照process做",
    forbiddenChineseOnly: ["按照流程做", "流程", "过程"],
    allowedTemplates: ["按照process做", "process要走完", "先看清process"]
  },
  standard: {
    preferredPattern: "达到standard",
    forbiddenChineseOnly: ["达到标准", "标准"],
    allowedTemplates: ["达到standard", "standard不能降", "按standard执行"]
  },
  attitude: {
    preferredPattern: "保持积极的attitude",
    forbiddenChineseOnly: ["保持积极的态度", "态度"],
    allowedTemplates: ["保持积极的attitude", "attitude要稳住", "调整attitude"]
  },
  motivation: {
    preferredPattern: "找到motivation",
    forbiddenChineseOnly: ["找到动力", "动力"],
    allowedTemplates: ["找到motivation", "motivation又回来了", "保持motivation"]
  },
  cover: {
    preferredPattern: "先cover重点",
    forbiddenChineseOnly: ["覆盖重点", "涵盖重点", "覆盖"],
    allowedTemplates: ["先cover重点", "这部分先cover掉", "尽量全面cover"]
  },
  reject: {
    preferredPattern: "直接reject这个方案",
    forbiddenChineseOnly: ["拒绝这个方案", "拒绝", "驳回"],
    allowedTemplates: ["直接reject这个方案", "可以reject它", "别急着reject"]
  },
  derive: {
    preferredPattern: "从数据里derive结论",
    forbiddenChineseOnly: ["推导结论", "推导", "得出结论"],
    allowedTemplates: ["从数据里derive结论", "先derive核心点", "可以derive出趋势"]
  },
  contribute: {
    preferredPattern: "这会contribute到结果里",
    forbiddenChineseOnly: ["有助于结果", "贡献", "促成"],
    allowedTemplates: ["这会contribute到结果里", "持续contribute", "每个人都在contribute"]
  },
  expenses: {
    preferredPattern: "控制expenses",
    forbiddenChineseOnly: ["控制开销", "开销", "支出"],
    allowedTemplates: ["控制expenses", "expenses别超线", "先记下expenses"]
  },
  vacation: {
    preferredPattern: "准备vacation",
    forbiddenChineseOnly: ["准备假期", "假期"],
    allowedTemplates: ["准备vacation", "vacation快到了", "给vacation留预算"]
  }
};

const lexiconCache = new Map();
const modelTraceStorage = new AsyncLocalStorage();

function compactWordsKey(words) {
  return (Array.isArray(words) ? words : [])
    .map((w) => String(w || "").trim().toLowerCase())
    .filter(Boolean)
    .join("|");
}

function makeLexiconCacheKey(words, quickMode, model, detailLevel = "full") {
  const level = String(detailLevel || "").toLowerCase() === "core" ? "core" : "full";
  const raw = `lexicon::${compactWordsKey(words)}::quick=${quickMode ? 1 : 0}::model=${String(model || "")
    .trim()
    .toLowerCase()}::detail=${level}`;
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

function isMixedGenerationMode(raw) {
  const mode = String(raw || "").toLowerCase();
  return mode === "mixed" || mode === "mixed_dense";
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
      generationQuality: "normal",
      baseLexicon: [],
      contextGlosses: [],
      runs: []
    };
  }

  if (rawAlignment && typeof rawAlignment === "object") {
    const items = Array.isArray(rawAlignment.items) ? rawAlignment.items : [];
    const meta = rawAlignment.meta && typeof rawAlignment.meta === "object" ? rawAlignment.meta : {};
    return {
      items,
      generationMode: normalizeGenerationMode(meta.generationMode),
      generationQuality: normalizeGenerationQuality(meta.generationQuality),
      baseLexicon: Array.isArray(meta.baseLexicon) ? meta.baseLexicon : [],
      contextGlosses: Array.isArray(meta.contextGlosses) ? meta.contextGlosses : [],
      runs: Array.isArray(meta.runs) ? meta.runs : []
    };
  }

  return {
    items: [],
    generationMode: "standard",
    generationQuality: "normal",
    baseLexicon: [],
    contextGlosses: [],
    runs: []
  };
}

function buildAlignmentPayload(
  rawAlignment,
  rawGenerationMode,
  rawGenerationQuality,
  rawBaseLexicon = [],
  rawContextGlosses = [],
  rawRuns = []
) {
  const parsed = parseAlignmentPayload(rawAlignment);
  const baseLexicon = Array.isArray(rawBaseLexicon) && rawBaseLexicon.length > 0 ? rawBaseLexicon : parsed.baseLexicon;
  const contextGlosses =
    Array.isArray(rawContextGlosses) && rawContextGlosses.length > 0 ? rawContextGlosses : parsed.contextGlosses;
  const runs = Array.isArray(rawRuns) && rawRuns.length > 0 ? rawRuns : parsed.runs;
  return {
    items: cloneJsonSafe(Array.isArray(parsed.items) ? parsed.items.slice(0, 300) : [], []),
    meta: {
      generationMode: normalizeGenerationMode(rawGenerationMode || parsed.generationMode),
      generationQuality: normalizeGenerationQuality(rawGenerationQuality || parsed.generationQuality),
      baseLexicon: cloneJsonSafe(Array.isArray(baseLexicon) ? baseLexicon.slice(0, 300) : [], []),
      contextGlosses: cloneJsonSafe(Array.isArray(contextGlosses) ? contextGlosses.slice(0, 300) : [], []),
      runs: cloneJsonSafe(Array.isArray(runs) ? runs.slice(0, 3000) : [], [])
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
      alignment: buildAlignmentPayload(
        raw?.alignment,
        raw?.generationMode,
        raw?.generationQuality,
        raw?.baseLexicon,
        raw?.contextGlosses,
        raw?.runs
      ),
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
  const seenIds = new Set();

  for (const raw of rawList.slice(0, 2000)) {
    const word = normalizeText(raw?.word, 120);
    const key =
      normalizeText(raw?.key, 120) ||
      normalizeText(raw?.wordKey, 120) ||
      word.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const rawId = normalizeText(raw?.id, 80) || `nb_${crypto.randomBytes(8).toString("hex")}`;
    const uniqueId = seenIds.has(rawId) ? `nb_${crypto.randomBytes(8).toString("hex")}` : rawId;
    seenIds.add(uniqueId);

    out.push({
      id: uniqueId,
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
  const seenIds = new Set();
  const sourceEntries =
    rawValue && typeof rawValue === "object" && !Array.isArray(rawValue) ? Object.entries(rawValue) : [];

  for (const [rawKey, rawItem] of sourceEntries.slice(0, 5000)) {
    const wordKey = normalizeText(rawKey, 120);
    if (!wordKey || seen.has(wordKey)) continue;
    seen.add(wordKey);

    const masteryRaw = normalizeText(rawItem?.mastery, 32).toLowerCase();
    const mastery = masteryRaw === "mastered" ? "mastered" : "unknown";
    const rawId = normalizeText(rawItem?.id, 80) || `vp_${crypto.randomBytes(8).toString("hex")}`;
    const uniqueId = seenIds.has(rawId) ? `vp_${crypto.randomBytes(8).toString("hex")}` : rawId;
    seenIds.add(uniqueId);

    out.push({
      id: uniqueId,
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

function normalizeInputWordToken(rawToken) {
  let token = String(rawToken || "")
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, " ")
    .replace(/^[\s\-*•·\d.)]+/, "")
    .trim();
  if (!token) return "";

  // Inline dictionary style: "drip v. 滴落" => "drip", "water n." => "water"
  const inlinePos = token.match(/^(.+?)\s+(?:n|v|adj|adv|prep|pron|conj|num|det|int)\.?(?:\s+.*)?$/i);
  if (inlinePos && /[A-Za-z]/.test(String(inlinePos[1] || ""))) {
    token = String(inlinePos[1] || "").trim();
  }
  token = token.replace(/\s+(?:n|v|adj|adv|prep|pron|conj|num|det|int)\.?\s*$/i, "").trim();
  // Chinese gloss in parentheses: "drip（滴落）" => "drip"
  token = token.replace(/[（(][^）)]*[\u4e00-\u9fff][^）)]*[）)]\s*$/g, "").trim();

  // Standalone glossary tags: "adj.", "adj. 基础的", "noun", etc.
  if (/^(?:n|v|adj|adv|prep|pron|conj|num|det|int)\.?$/i.test(token)) {
    return "";
  }
  if (/^(?:noun|verb|adjective|adverb|preposition|pronoun|conjunction|numeral|determiner|interjection)\.?$/i.test(token)) {
    return "";
  }
  if (/^(?:n|v|adj|adv|prep|pron|conj|num|det|int)\.?\s*[\u4e00-\u9fff].*$/i.test(token)) {
    return "";
  }

  if (/[\u4e00-\u9fff]/.test(token)) {
    const englishChunk = token.match(/[A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*)*/);
    token = englishChunk ? englishChunk[0] : "";
  }

  token = token
    .replace(/[^A-Za-z'\-\s]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return /[A-Za-z]/.test(token) ? token : "";
}

function splitWords(rawText) {
  const rawItems = String(rawText || "")
    .split(/[\n,，]+/)
    .map((w) => normalizeInputWordToken(w))
    .filter(Boolean);
  return rawItems.filter((value, index, arr) => arr.findIndex((x) => x.toLowerCase() === value.toLowerCase()) === index);
}

function looksLikeWordListOnlyInput(rawText) {
  const source = String(rawText || "").trim();
  if (!source) return true;

  const chineseCount = (source.match(/[\u4e00-\u9fff]/g) || []).length;
  const sentencePunctuationCount = (source.match(/[。！？!?]/g) || []).length;
  const semicolonCount = (source.match(/[；;]/g) || []).length;
  const lines = source
    .split(/\r?\n/)
    .map((line) => String(line || "").trim())
    .filter(Boolean);
  const longLines = lines.filter((line) => line.length >= 80).length;
  const sentenceLikeLines = lines.filter((line) => /[。！？!?]/.test(line)).length;
  const tokens = source
    .split(/[\n,，]+/)
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  const englishWordLikeCount = tokens.filter((token) => /^[A-Za-z][A-Za-z'\-\s]{0,40}$/.test(token)).length;

  if (sentencePunctuationCount >= 3) return false;
  if (chineseCount > 40 && sentencePunctuationCount >= 1) return false;
  if (lines.length >= 5 && sentenceLikeLines >= Math.ceil(lines.length * 0.5)) return false;
  if (longLines >= 2) return false;
  if (tokens.length >= 8 && englishWordLikeCount / tokens.length < 0.6) return false;
  if (tokens.length >= 6 && semicolonCount >= 4) return false;
  return true;
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

function buildWordPresenceRegex(word) {
  const normalized = String(word || "").trim();
  if (!normalized) return null;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^A-Za-z])${escaped}(?:[①②③④⑤⑥⑦⑧⑨⑩])?(?=$|[^A-Za-z])`, "i");
}

function findMissingWords(article, words) {
  const text = String(article || "");
  return (Array.isArray(words) ? words : []).filter((w) => {
    const regex = buildWordPresenceRegex(w);
    return regex ? !regex.test(text) : true;
  });
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

function normalizeIpaText(raw) {
  const source = String(raw || "").trim();
  if (!source) return "";
  const core = source.replace(/^[/[\]()\s]+|[/[\]()\s]+$/g, "").trim();
  if (!core) return "";
  return `/${core}/`;
}

function sanitizeGlossText(raw, maxLen = 240) {
  let text = String(raw || "");
  if (!text) return "";
  const entityMap = {
    "&nbsp;": " ",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'"
  };
  text = text.replace(/&nbsp;|&lt;|&gt;|&quot;|&#39;/gi, (m) => entityMap[m.toLowerCase()] || m);
  text = text
    .replace(/<\/?(?:mark|span|sup)\b[^>]*>/gi, " ")
    .replace(/ass\s*=\s*["']vocab-zh(?:-inline)?["']>/gi, " ")
    .replace(/\bclass\s*=\s*["'][^"']*["']/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, maxLen);
}

function pickLexiconIpa(item, accent) {
  const source = item && typeof item === "object" ? item : {};
  const candidates =
    accent === "uk"
      ? [
          source.uk_ipa,
          source.ukIpa,
          source.ipa_uk,
          source.ipaUk,
          source.ipaUK,
          source.ukIPA,
          source.pronunciation?.uk,
          source.pronunciation?.ukIpa,
          source.phonetic_uk,
          source.phoneticUk,
          source.phoneticUK
        ]
      : [
          source.us_ipa,
          source.usIpa,
          source.ipa_us,
          source.ipaUs,
          source.ipaUS,
          source.usIPA,
          source.pronunciation?.us,
          source.pronunciation?.usIpa,
          source.phonetic_us,
          source.phoneticUs,
          source.phoneticUS
        ];

  for (const raw of candidates) {
    const ipa = normalizeIpaText(raw);
    if (ipa) return ipa;
  }

  return "";
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

function normalizeLexicon(words, rawItems, detailLevel = "full") {
  const isCore = String(detailLevel || "").toLowerCase() === "core";
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
        .map((m) => sanitizeGlossText(m, 200))
        .filter(Boolean)
        .slice(0, 5);
      const collocations = !isCore && Array.isArray(item.collocations)
        ? item.collocations.map((x) => sanitizeGlossText(x, 220)).filter(Boolean).slice(0, 5)
        : [];
      const wordFormation =
        !isCore && typeof item.word_formation === "string" && sanitizeGlossText(item.word_formation, 500)
          ? sanitizeGlossText(item.word_formation, 500)
          : "";
      const synonyms = !isCore && Array.isArray(item.synonyms)
        ? item.synonyms.map((x) => sanitizeGlossText(x, 120)).filter(Boolean).slice(0, 6)
        : [];
      const antonyms = !isCore && Array.isArray(item.antonyms)
        ? item.antonyms.map((x) => sanitizeGlossText(x, 120)).filter(Boolean).slice(0, 6)
        : [];

      const usIpa = pickLexiconIpa(item, "us");
      const ukIpa = pickLexiconIpa(item, "uk");
      itemMap.set(key, { pos, meanings, collocations, wordFormation, synonyms, antonyms, usIpa, ukIpa });
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
      usIpa: found?.usIpa || "",
      ukIpa: found?.ukIpa || "",
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

async function generateLexicon(words, quickMode, model, detailLevel = "full") {
  const normalizedDetailLevel = String(detailLevel || "").toLowerCase() === "core" ? "core" : "full";
  const isCore = normalizedDetailLevel === "core";
  const cacheKey = makeLexiconCacheKey(words, quickMode, model, normalizedDetailLevel);
  const cached = getFromTimedCache(lexiconCache, cacheKey);
  if (cached) {
    return cloneJsonSafe(cached, []);
  }

  const generateLexiconChunk = async (chunkWords) => {
    const prompt = isCore
      ? [
          "You are an IELTS vocabulary assistant.",
          "Return ONLY JSON array.",
          "Each item format:",
          "{\"word\": string, \"pos\": string, \"us_ipa\": string, \"uk_ipa\": string, \"meanings\": string[]}",
          "Rules:",
          "1) Keep same order as input words.",
          "2) pos should be concise (e.g. n., v., adj., adv.).",
          "3) meanings should be concise Chinese meanings, 1-3 items, ordered by IELTS frequency.",
          "4) meanings[0] MUST be the single most common IELTS exam sense.",
          "5) Avoid rare/archaic niche senses unless absolutely necessary.",
          "6) Prioritize meanings useful for reading/listening/writing tasks.",
          `Words: ${chunkWords.join(", ")}`
        ].join("\n")
      : [
          "You are an IELTS vocabulary assistant.",
          "Return ONLY JSON array.",
          "Each item format:",
          "{\"word\": string, \"pos\": string, \"us_ipa\": string, \"uk_ipa\": string, \"meanings\": string[], \"collocations\": string[], \"word_formation\": string, \"synonyms\": string[], \"antonyms\": string[]}",
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

    const text = await callOpenAIText(prompt, {
      maxTokens: isCore ? (quickMode ? 360 : 760) : quickMode ? 650 : 1300,
      model,
      step: isCore ? "lexicon_core" : "lexicon"
    });
    let parsed = extractJsonArray(text);

    if (!Array.isArray(parsed) && !isCore) {
      const retryPrompt = [
        "Return ONLY JSON array, no markdown, no explanation.",
        "Each item keys must be exactly: word,pos,us_ipa,uk_ipa,meanings,collocations,word_formation,synonyms,antonyms.",
        "Keep same order as input words.",
        `Words: ${chunkWords.join(", ")}`
      ].join("\n");
      const retryText = await callOpenAIText(retryPrompt, { maxTokens: quickMode ? 650 : 1300, model, step: "lexicon_retry" });
      parsed = extractJsonArray(retryText);
    }

    return normalizeLexicon(chunkWords, parsed, normalizedDetailLevel);
  };

  const preferredChunkSize = isCore ? Math.max(16, LEXICON_CHUNK_SIZE) : LEXICON_CHUNK_SIZE;
  const chunkSize = words.length > preferredChunkSize ? preferredChunkSize : words.length;
  const chunks = chunkArray(words, chunkSize);
  const chunkResults = await runWithConcurrency(chunks, LEXICON_CHUNK_CONCURRENCY, (chunk) => generateLexiconChunk(chunk));
  let lexicon = chunkResults.flat();

  const failedWords = lexicon
    .filter((x) => (x?.senses || []).some((s) => String(s?.meaning || "").includes("待完善")))
    .map((x) => x.word);

  if (failedWords.length > 0 && !isCore) {
    const retryChunks = chunkArray(failedWords, 4);
    let recoveredAll = [];
    for (const c of retryChunks) {
      const fallbackPrompt = [
        "You are an IELTS vocabulary assistant.",
        "Return ONLY JSON array.",
        "For each word provide practical IELTS meanings and basic word data.",
        "Output format: {\"word\": string, \"pos\": string, \"us_ipa\": string, \"uk_ipa\": string, \"meanings\": string[], \"collocations\": string[], \"word_formation\": string, \"synonyms\": string[], \"antonyms\": string[]}",
        "meanings[0] MUST be the most common IELTS sense.",
        "Order meanings by IELTS frequency descending.",
        "If a word is misspelled, infer the most likely intended word and still provide useful meanings for the given spelling.",
        `Words: ${c.join(", ")}`
      ].join("\n");
      const fallbackText = await callOpenAIText(fallbackPrompt, { maxTokens: quickMode ? 700 : 1400, model, step: "lexicon_fallback" });
      const fallbackParsed = extractJsonArray(fallbackText);
      recoveredAll = recoveredAll.concat(normalizeLexicon(c, fallbackParsed, normalizedDetailLevel));
    }
    const recoveredMap = new Map(recoveredAll.map((x) => [x.word.toLowerCase(), x]));
    lexicon = lexicon.map((item) => recoveredMap.get(item.word.toLowerCase()) || item);
  }

  const finalLexicon = cloneJsonSafe(lexicon, []);
  setToTimedCache(lexiconCache, cacheKey, finalLexicon, LEXICON_CACHE_TTL_MS, LEXICON_CACHE_MAX);
  return cloneJsonSafe(finalLexicon, []);
}

async function planMixedUsage(words, lexicon, quickMode, model) {
  const sourceWords = Array.isArray(words) ? words.map((w) => String(w || "").trim()).filter(Boolean) : [];
  if (sourceWords.length === 0) return [];

  const lexGuide = (Array.isArray(lexicon) ? lexicon : [])
    .map((item) => {
      const word = String(item?.word || "").trim();
      if (!word) return "";
      const senses = Array.isArray(item?.senses) ? item.senses : [];
      const primary = senses[0];
      const primaryText = primary ? `${primary.meaning}` : "词义待补充";
      const alt = senses
        .slice(1, 3)
        .map((s) => s.meaning)
        .join("; ");
      const tail = alt ? ` | secondary: ${alt}` : "";
      return `${word} (${item?.pos || "-"}) => ${primaryText}${tail}`;
    })
    .filter(Boolean)
    .join("\n");

  const prompt = [
    "You are planning natural usage for a Chinese-first mixed-language passage.",
    "Return ONLY JSON array in the same order as input words.",
    "Each item format:",
    '{"word": string, "pos": string, "meaning": string, "scene": string, "allowed_pattern": string, "avoid": string, "must_keep_english": boolean, "preferred_pattern": string, "forbidden_chinese_only": string[], "allowed_templates": string[]}',
    "Rules:",
    "1) meaning should be the most natural context-appropriate Chinese meaning for daily-life usage, not just dictionary default.",
    "2) scene should be a short label like park, coffee-chat, home, reflection.",
    "3) allowed_pattern should be concise and practical.",
    "4) avoid should mention awkward/collocation mistakes to prevent forced usage.",
    "5) For hard words (e.g. derive/sterility/process/standard/collapse), prefer separate micro-scene or reflective short clause.",
    "6) For must-keep words (budget/relax/process/standard/attitude/motivation/cover/reject/derive/contribute/expenses/vacation), set must_keep_english=true and provide preferred_pattern / forbidden_chinese_only / allowed_templates.",
    `Words: ${sourceWords.join(", ")}`,
    "Lexicon candidates:",
    lexGuide
  ].join("\n");

  try {
    const text = await callOpenAIText(prompt, { maxTokens: quickMode ? 420 : 900, model, step: "mixed_plan" });
    const parsed = extractJsonArray(text);
    return normalizeMixedUsagePlan(parsed, sourceWords, lexicon);
  } catch (error) {
    console.error("Failed to plan mixed usage:", error.message);
    return buildFallbackMixedUsagePlan(sourceWords, lexicon);
  }
}

function splitWordsForDenseChunks(words, minSize = 4, maxSize = 6) {
  const sourceWords = Array.isArray(words) ? words.map((w) => String(w || "").trim()).filter(Boolean) : [];
  if (sourceWords.length <= 12) return [sourceWords];
  if (sourceWords.length <= maxSize) return [sourceWords];

  const targetSize = Math.min(maxSize, Math.max(minSize, 5));
  const groups = chunkArray(sourceWords, targetSize).filter((group) => group.length > 0);
  if (groups.length <= 1) return groups;

  const lastIndex = groups.length - 1;
  while (groups[lastIndex].length > 0 && groups[lastIndex].length < minSize) {
    let donorIndex = -1;
    for (let i = groups.length - 2; i >= 0; i -= 1) {
      if (groups[i].length > minSize) {
        donorIndex = i;
        break;
      }
    }
    if (donorIndex < 0) break;
    const moved = groups[donorIndex].pop();
    if (!moved) break;
    groups[lastIndex].unshift(moved);
  }
  return groups;
}

function buildDeterministicMixedOpeningChunk(words) {
  const sourceWords = Array.isArray(words) ? words.map((w) => String(w || "").trim()).filter(Boolean) : [];
  const first = sourceWords[0] || "";
  const second = sourceWords[1] || "";
  if (!first) return "";
  if (second) {
    return `${first}先上，${second}紧跟，后面直接进入内容。`;
  }
  return `${first}先上，后面直接进入内容。`;
}

async function generateMixedDenseArticleByChunks(words, level, quickMode, lexicon, extraConstraint, model, usagePlan) {
  const sourceWords = Array.isArray(words) ? words.map((w) => String(w || "").trim()).filter(Boolean) : [];
  if (sourceWords.length === 0) {
    return { title: defaultTitleByDate(0), article: "", chunks: [] };
  }

  const groups = splitWordsForDenseChunks(sourceWords, 4, 6);
  const lexMap = new Map((Array.isArray(lexicon) ? lexicon : []).map((item) => [String(item?.word || "").toLowerCase(), item]));
  const usageRows = Array.isArray(usagePlan) ? usagePlan : [];
  let hasDeterministicChunkAppend = false;
  const buildDenseChunkWithCoverage = async (groupWords, groupLexicon, groupPlan, constraintText) => {
    const planMap = new Map((Array.isArray(groupPlan) ? groupPlan : []).map((item) => [String(item?.word || "").toLowerCase(), item]));
    const lexMapLocal = new Map((Array.isArray(groupLexicon) ? groupLexicon : []).map((item) => [String(item?.word || "").toLowerCase(), item]));
    const localContextRows = groupWords.map((word) => {
      const key = String(word || "").toLowerCase();
      const plan = planMap.get(key);
      const lexItem = lexMapLocal.get(key);
      const contextMeaning = String(plan?.meaning || lexItem?.senses?.[0]?.meaning || "").trim();
      const hints = buildMustKeepEnglishHints(word, contextMeaning);
      return {
        word,
        contextMeaning,
        mustKeepEnglish: Boolean(plan?.mustKeepEnglish ?? hints.mustKeepEnglish),
        preferredPattern: String(plan?.preferredPattern || hints.preferredPattern || "").trim(),
        forbiddenChineseOnly: normalizeChinesePhraseList(plan?.forbiddenChineseOnly || hints.forbiddenChineseOnly || [], 10),
        allowedTemplates: Array.isArray(plan?.allowedTemplates) ? plan.allowedTemplates : hints.allowedTemplates
      };
    });

    let pack = await generateArticlePackage(
      groupWords,
      level,
      quickMode,
      groupLexicon,
      "mixed_dense",
      constraintText,
      model,
      groupPlan
    );
    let article = String(pack?.article || "").trim();
    let localMissing = findMissingWords(article, groupWords);
    let localSoftIssues = findSoftMissingByChineseSubstitution(article, localContextRows);

    if (localMissing.length > 0) {
      const localRetryConstraint = [
        constraintText,
        "Important local fix: every target word in this chunk must appear as the exact English token.",
        "Coverage is validated by exact literal English surface forms.",
        "Chinese translation does NOT count as usage.",
        "Never replace a target word with Chinese-only wording.",
        `Missing local words: ${localMissing.join(", ")}.`
      ]
        .filter(Boolean)
        .join(" ");
      pack = await generateArticlePackage(
        groupWords,
        level,
        quickMode,
        groupLexicon,
        "mixed_dense",
        localRetryConstraint,
        model,
        groupPlan
      );
      article = String(pack?.article || "").trim();
      localMissing = findMissingWords(article, groupWords);
      localSoftIssues = findSoftMissingByChineseSubstitution(article, localContextRows);
    }

    if (localSoftIssues.length > 0) {
      article = restoreEnglishIntoChinesePhrase(article, localSoftIssues);
      localMissing = findMissingWords(article, groupWords);
      localSoftIssues = findSoftMissingByChineseSubstitution(article, localContextRows);
    }

    if (localMissing.length > 0) {
      article = appendGuaranteedMissingWordsMixed(article, localMissing);
      hasDeterministicChunkAppend = true;
      localMissing = findMissingWords(article, groupWords);
    }

    return {
      pack,
      article,
      localMissing
    };
  };

  if (groups.length <= 1) {
    const singleConstraint = [
      extraConstraint,
      "Dense chunk 1/1.",
      `Use ALL these target words in this chunk: ${sourceWords.join(", ")}.`,
      "The first sentence must contain at least one target word.",
      "Do not write a long Chinese-only introduction before the first target word.",
      "Before the first target word, allow at most 12 Chinese characters.",
      "Start directly with the mixed content, not with background setup."
    ]
      .filter(Boolean)
      .join(" ");
    const single = await buildDenseChunkWithCoverage(sourceWords, lexicon, usageRows, singleConstraint);
    return {
      ...single.pack,
      article: single.article,
      chunks: [
        {
          index: 0,
          words: sourceWords.slice(),
          article: single.article
        }
      ],
      hasDeterministicChunkAppend
    };
  }

  const parts = [];
  const chunks = [];
  let title = "";

  for (let i = 0; i < groups.length; i += 1) {
    const groupWords = groups[i];
    const groupSet = new Set(groupWords.map((w) => String(w || "").toLowerCase()));
    const groupLexicon = groupWords.map((w) => lexMap.get(String(w || "").toLowerCase())).filter(Boolean);
    const groupPlan = usageRows.filter((item) => groupSet.has(String(item?.word || "").toLowerCase()));
    const denseConstraint = [
      `Dense chunk ${i + 1}/${groups.length}.`,
      `Use ALL these target words in this chunk: ${groupWords.join(", ")}.`,
      "The first sentence must contain at least one target word.",
      "Do not write a long Chinese-only introduction before the first target word.",
      "Before the first target word, allow at most 12 Chinese characters.",
      "Start directly with the mixed content, not with background setup."
    ].join(" ");
    const finalConstraint = [extraConstraint, denseConstraint].filter(Boolean).join(" ");
    const localPack = await buildDenseChunkWithCoverage(groupWords, groupLexicon, groupPlan, finalConstraint);
    const pack = localPack.pack;
    if (!title) {
      title = String(pack?.title || "").trim();
    }
    const article = String(localPack?.article || "").trim();
    parts.push(article);
    chunks.push({
      index: i,
      words: groupWords.slice(),
      article
    });
  }

  return {
    title: title || defaultTitleByDate(sourceWords.length),
    article: parts.filter(Boolean).join("\n\n"),
    chunks,
    hasDeterministicChunkAppend
  };
}

async function generateMixedArticleByScenes(words, level, quickMode, lexicon, extraConstraint, model, usagePlan) {
  const groups = splitWordsForMixedScenes(words, usagePlan);
  const lexMap = new Map((Array.isArray(lexicon) ? lexicon : []).map((item) => [String(item?.word || "").toLowerCase(), item]));
  if (groups.length <= 1) {
    return generateArticlePackage(words, level, quickMode, lexicon, "mixed", extraConstraint, model, usagePlan);
  }

  const parts = [];
  let title = "";
  for (let i = 0; i < groups.length; i += 1) {
    const groupWords = groups[i];
    const groupSet = new Set(groupWords.map((w) => String(w || "").toLowerCase()));
    const groupLexicon = groupWords.map((w) => lexMap.get(String(w || "").toLowerCase())).filter(Boolean);
    const groupPlan = (Array.isArray(usagePlan) ? usagePlan : []).filter((item) => groupSet.has(String(item?.word || "").toLowerCase()));
    const sceneConstraint = [
      `Micro-scene ${i + 1}/${groups.length}.`,
      `Only focus on these target words in this part: ${groupWords.join(", ")}.`,
      "Do not intentionally use target words that are assigned to other micro-scenes."
    ].join(" ");
    const finalConstraint = [extraConstraint, sceneConstraint].filter(Boolean).join(" ");
    const pack = await generateArticlePackage(groupWords, level, quickMode, groupLexicon, "mixed", finalConstraint, model, groupPlan);
    if (!title) {
      title = String(pack?.title || "").trim();
    }
    parts.push(String(pack?.article || "").trim());
  }

  return {
    title: title || defaultTitleByDate(words.length),
    article: parts.filter(Boolean).join("\n\n")
  };
}

async function generateArticlePackage(
  words,
  level,
  quickMode,
  lexicon,
  generationMode = "standard",
  extraConstraint = "",
  model,
  usagePlan = []
) {
  const promptLevel = levelToPromptText(level);
  const modeKey = String(generationMode || "").toLowerCase();
  const isMixedMode = isMixedGenerationMode(modeKey);
  const isDenseMixedMode = modeKey === "mixed_dense";
  const lengthRule = isMixedMode
    ? isDenseMixedMode
      ? "Use high-density mixed flow: prefer 4-8 short sentences, not a long narrative paragraph."
      : "Keep it compact and easy to read, with short natural sentences."
    : quickMode
      ? "Length: 120-180 words."
      : words.length > 16
        ? "Length: 320-450 words."
        : "Length: 220-320 words.";
  const paragraphRule = isMixedMode
    ? isDenseMixedMode
      ? "Use 4-8 short lines or short paragraphs, separated by blank lines when needed."
      : "Use 2-4 short paragraphs separated by blank lines."
    : quickMode
      ? "Use 2-3 short paragraphs separated by blank lines."
      : words.length > 16
        ? "Use 4-5 paragraphs separated by blank lines."
        : "Use 3-4 paragraphs separated by blank lines.";

  const vocabGuide = (lexicon || [])
    .map((item) => {
      const senses = Array.isArray(item?.senses) ? item.senses : [];
      const primary = senses[0];
      const primaryText = primary ? `preferred: ${primary.meaning}` : "preferred: 常考义待完善";
      const alternates = senses
        .slice(1, 3)
        .map((s) => s.meaning)
        .join("; ");
      return alternates
        ? `${item.word} (${item.pos || "-"}): ${primaryText}; alternatives: ${alternates}`
        : `${item.word} (${item.pos || "-"}): ${primaryText}`;
    })
    .join("\n");
  const usagePlanGuide = isMixedMode ? buildMixedUsagePlanGuide(usagePlan, words) : "";

  const modeRules = isMixedMode
    ? [
        isDenseMixedMode
          ? "Write high-density Chinese-English mixed word flow, not a complete long-form article."
          : "Write a Chinese-first mixed-language passage, not a formal article.",
        "The tone must be natural, conversational, and everyday-life based.",
        "It should feel like a real person talking, sharing, complaining, reflecting, or reacting in daily life.",
        "The main body should be fluent natural Chinese, with target words inserted in English only.",
        "Insert target words as part of sentence rhythm, not as explanations or glossary items.",
        "Prefer 1-2 target words per sentence, and keep sentence units short.",
        "Keep Chinese bridge text between adjacent target words very short: ideal <=10 Chinese characters, hard limit <=18.",
        "Avoid long Chinese-only paragraphs that push target words far apart.",
        "Prefer 4-8 short sentences instead of long paragraphs.",
        isDenseMixedMode ? "The first sentence must contain at least one target word." : "",
        isDenseMixedMode ? "Do not begin with a standalone Chinese background paragraph." : "",
        isDenseMixedMode ? "Prefer the first target word to appear within the first 12 Chinese characters." : "",
        isDenseMixedMode ? "Every sentence should be short and dense." : "",
        isDenseMixedMode ? "Do not write scene setup before using target words." : "",
        "For each target word, use exactly the original input form (no plural/past/ing).",
        "Coverage is validated by exact literal English surface forms.",
        "Chinese translation does NOT count as usage.",
        "Never replace a target word with Chinese-only wording.",
        "Every target word must appear in the final passage as the exact English token from input.",
        'If the target word is "Derive", "Sterility", "Plume", "Bristle", "Cricket", etc., do not translate it away.',
        "Each target word should appear once if possible, and never more than twice.",
        "Prefer one target word per short clause, but allow multiple target words in one sentence when natural.",
        "Do not break sentences awkwardly just to isolate target words.",
        "Keep Chinese background concise, but do not make it sound like a drill or exercise.",
        "Do NOT use glossary parentheses style such as 中文（word） or 中文（word + meaning）.",
        "Do NOT output Chinese gloss + English word pairs such as 板球 cricket / 无菌 sterility.",
        "When Chinese characters directly connect with a target word, keep compact form like 打cricket / 的sterility (no extra spaces).",
        "Avoid duplicate Chinese+English semantics around the same blank: use 非常cruel, not 非常残忍cruel.",
        "Do NOT output keyword list sections such as '片段1：补充关键词 ...'.",
        "Do NOT output standalone dictionary lines such as 'n. xxx' in the body.",
        "If one single story feels forced, you may write a sequence of small daily-life moments, but the voice must stay natural and consistent.",
        "Naturalness and spoken flow are more important than showing off difficult writing."
      ]
    : ["Write an English IELTS-style article."];
  const bodyLabel = isMixedMode ? "Passage" : "Article";

  const prompt = [
    ...modeRules,
    "Return ONLY JSON object:",
    '{"title":"...", "article":"..."}',
    `Level: ${promptLevel}.`,
    lengthRule,
    paragraphRule,
    `${bodyLabel} must be plain text paragraphs separated by blank lines.`,
    "Every target word must appear at least once.",
    "Use the most natural context-appropriate meaning for each word in the exact scene.",
    "Naturalness is more important than using default dictionary sense.",
    "Do not force a target word into an unnatural sentence just for coverage.",
    "If a word is difficult to place naturally, put it in a separate short micro-scene.",
    "Do not include sense markers in the article body.",
    "The output should read smoothly even for someone who ignores the vocabulary-learning purpose.",
    "Make title concise and natural.",
    "Vocabulary guide:",
    vocabGuide,
    isMixedMode ? "Usage planning hints:" : "",
    isMixedMode ? usagePlanGuide : "",
    extraConstraint
  ]
    .filter(Boolean)
    .join("\n");

  const maxTokens = isDenseMixedMode ? (quickMode ? 300 : 580) : quickMode ? 420 : words.length > 16 ? 1200 : 820;
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

function appendGuaranteedMissingWordsMixed(article, missingWords) {
  const source = String(article || "").trim();
  const words = Array.from(
    new Set(
      (Array.isArray(missingWords) ? missingWords : [])
        .map((w) => String(w || "").trim())
        .filter(Boolean)
    )
  );
  if (words.length === 0) return source;

  const lines = words.map((word) => `${word}这个词我今天也特别记住了。`);
  return `${source}\n\n${lines.join("\n")}`.trim();
}

function extractChineseCandidatesFromContextRow(row) {
  const meaningRaw = String(row?.contextMeaning || row?.meaning || "").trim();
  const fromMeaning = meaningRaw
    .split(/[、,，/;；]/)
    .map((x) => String(x || "").trim())
    .filter((x) => x.length >= 1 && /[\u4e00-\u9fff]/.test(x));
  const fromForbidden = normalizeChinesePhraseList(row?.forbiddenChineseOnly || row?.forbidden_chinese_only || [], 10);
  return Array.from(new Set([...fromForbidden, ...fromMeaning]))
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function findSoftMissingByChineseSubstitution(article, contextGlosses) {
  const source = String(article || "");
  const rows = Array.isArray(contextGlosses) ? contextGlosses : [];
  const issues = [];
  for (const row of rows) {
    const word = String(row?.word || "").trim();
    if (!word) continue;
    const regex = buildWordPresenceRegex(word);
    if (regex && regex.test(source)) continue;
    const candidates = extractChineseCandidatesFromContextRow(row);
    if (candidates.length === 0) continue;
    const matchedChinese = candidates.find((phrase) => source.includes(phrase));
    if (!matchedChinese) continue;

    issues.push({
      word,
      contextMeaning: String(row?.contextMeaning || row?.meaning || "").trim(),
      matchedChinese,
      mustKeepEnglish: Boolean(row?.mustKeepEnglish),
      preferredPattern: String(row?.preferredPattern || "").trim(),
      forbiddenChineseOnly: normalizeChinesePhraseList(row?.forbiddenChineseOnly || [], 10),
      allowedTemplates: Array.isArray(row?.allowedTemplates) ? row.allowedTemplates.map((x) => String(x || "").trim()).filter(Boolean) : []
    });
  }
  return issues;
}

function restoreEnglishIntoChinesePhrase(article, issues) {
  let source = String(article || "");
  const rows = Array.isArray(issues) ? issues : [];
  for (const issue of rows) {
    const word = String(issue?.word || "").trim();
    if (!word) continue;
    const regex = buildWordPresenceRegex(word);
    if (regex && regex.test(source)) continue;
    const phrases = Array.from(
      new Set([
        String(issue?.matchedChinese || "").trim(),
        ...normalizeChinesePhraseList(issue?.forbiddenChineseOnly || [], 10),
        ...extractChineseCandidatesFromContextRow(issue)
      ])
    )
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    let replaced = false;
    for (const phrase of phrases) {
      if (!phrase) continue;
      const phraseRegex = new RegExp(escapeRegex(phrase));
      if (!phraseRegex.test(source)) continue;
      source = source.replace(phraseRegex, word);
      replaced = true;
      const afterReplace = buildWordPresenceRegex(word);
      if (afterReplace && afterReplace.test(source)) break;
    }

    if (!replaced) continue;
  }
  return source;
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

function normalizeChinesePhraseList(values, maxItems = 8) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((item) => String(item || "").trim())
        .filter((item) => item.length > 0 && /[\u4e00-\u9fff]/.test(item))
    )
  ).slice(0, maxItems);
}

function buildMustKeepEnglishHints(word, meaning) {
  const normalizedWord = String(word || "").trim();
  const key = normalizedWord.toLowerCase();
  const normalizedMeaning = String(meaning || "").trim();
  const mustKeepEnglish = MIXED_FORCE_ENGLISH_WORDS.has(key);
  const preset = MIXED_FORCE_ENGLISH_TEMPLATES[key] || null;
  const preferredPattern = String(preset?.preferredPattern || (mustKeepEnglish ? `${normalizedWord}要自然嵌入句子` : ""))
    .trim()
    .slice(0, 80);
  const forbiddenChineseOnly = normalizeChinesePhraseList(
    preset?.forbiddenChineseOnly || (mustKeepEnglish && normalizedMeaning ? [normalizedMeaning] : []),
    8
  );
  const allowedTemplates = Array.from(
    new Set(
      (Array.isArray(preset?.allowedTemplates) ? preset.allowedTemplates : [])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
    )
  ).slice(0, 8);
  return {
    mustKeepEnglish,
    preferredPattern,
    forbiddenChineseOnly,
    allowedTemplates
  };
}

function buildFallbackMixedUsagePlan(words, lexicon) {
  const lexMap = new Map((Array.isArray(lexicon) ? lexicon : []).map((item) => [String(item?.word || "").toLowerCase(), item]));
  return (Array.isArray(words) ? words : []).map((word) => {
    const key = String(word || "").toLowerCase();
    const item = lexMap.get(key);
    const primaryMeaning =
      Array.isArray(item?.senses) && item.senses.length > 0 ? String(item.senses[0]?.meaning || "").trim() : "词义待补充";
    return {
      word: String(word || "").trim(),
      pos: normalizePosTag(item?.pos || ""),
      meaning: primaryMeaning || "词义待补充",
      scene: MIXED_HARD_WORDS.has(key) ? "brief-reflection" : "daily-life",
      allowedPattern: MIXED_HARD_WORDS.has(key) ? "keep this word in a short reflective clause" : "everyday-life natural clause",
      avoid: MIXED_HARD_WORDS.has(key) ? "forcing this word into casual small talk" : "",
      ...buildMustKeepEnglishHints(word, primaryMeaning || "词义待补充")
    };
  });
}

function normalizeMixedUsagePlan(rows, words, lexicon) {
  const fallback = buildFallbackMixedUsagePlan(words, lexicon);
  if (!Array.isArray(rows)) return fallback;
  const byWord = new Map();
  const toBool = (value, defaultValue = false) => {
    if (typeof value === "boolean") return value;
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return defaultValue;
    if (["true", "1", "yes", "y", "是"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "否"].includes(normalized)) return false;
    return defaultValue;
  };
  for (const row of rows) {
    const word = String(row?.word || "").trim().toLowerCase();
    if (!word || byWord.has(word)) continue;
    byWord.set(word, row);
  }

  return fallback.map((base) => {
    const hit = byWord.get(String(base.word || "").toLowerCase()) || {};
    const meaning = String(hit?.meaning || "").trim() || base.meaning;
    const fallbackHints = buildMustKeepEnglishHints(base.word, meaning);
    const mustKeepEnglish = toBool(hit?.must_keep_english ?? hit?.mustKeepEnglish, fallbackHints.mustKeepEnglish);
    const preferredPattern = String(hit?.preferred_pattern || hit?.preferredPattern || fallbackHints.preferredPattern)
      .trim()
      .slice(0, 80);
    const forbiddenChineseOnly = normalizeChinesePhraseList(
      hit?.forbidden_chinese_only || hit?.forbiddenChineseOnly || fallbackHints.forbiddenChineseOnly,
      8
    );
    const allowedTemplates = Array.from(
      new Set(
        (Array.isArray(hit?.allowed_templates) ? hit.allowed_templates : Array.isArray(hit?.allowedTemplates) ? hit.allowedTemplates : [])
          .map((x) => String(x || "").trim())
          .filter(Boolean)
      )
    ).slice(0, 8);
    return {
      word: base.word,
      pos: normalizePosTag(hit?.pos || base.pos || ""),
      meaning: meaning.slice(0, 48),
      scene: String(hit?.scene || base.scene || "daily-life").trim().slice(0, 40),
      allowedPattern: String(hit?.allowed_pattern || hit?.allowedPattern || base.allowedPattern || "")
        .trim()
        .slice(0, 120),
      avoid: String(hit?.avoid || "").trim().slice(0, 120),
      mustKeepEnglish,
      preferredPattern,
      forbiddenChineseOnly,
      allowedTemplates: allowedTemplates.length > 0 ? allowedTemplates : fallbackHints.allowedTemplates
    };
  });
}

function buildMixedUsagePlanGuide(usagePlan, wordsFilter) {
  const plan = Array.isArray(usagePlan) ? usagePlan : [];
  const filterSet =
    Array.isArray(wordsFilter) && wordsFilter.length > 0
      ? new Set(wordsFilter.map((w) => String(w || "").toLowerCase()))
      : null;

  const lines = plan
    .filter((item) => {
      if (!filterSet) return true;
      return filterSet.has(String(item?.word || "").toLowerCase());
    })
    .map((item) => {
      const word = String(item?.word || "").trim();
      const pos = String(item?.pos || "").trim() || "-";
      const meaning = String(item?.meaning || "").trim() || "词义待补充";
      const scene = String(item?.scene || "").trim() || "daily-life";
      const allowedPattern = String(item?.allowedPattern || "").trim();
      const avoid = String(item?.avoid || "").trim();
      const mustKeepEnglish = Boolean(item?.mustKeepEnglish);
      const preferredPattern = String(item?.preferredPattern || "").trim();
      const forbiddenChineseOnly = normalizeChinesePhraseList(item?.forbiddenChineseOnly || [], 6);
      const tail = [
        allowedPattern ? `allowed: ${allowedPattern}` : "",
        avoid ? `avoid: ${avoid}` : "",
        mustKeepEnglish ? "mustKeepEnglish: true" : "",
        preferredPattern ? `preferred: ${preferredPattern}` : "",
        forbiddenChineseOnly.length > 0 ? `forbidCN: ${forbiddenChineseOnly.join("/")}` : ""
      ]
        .filter(Boolean)
        .join(" | ");
      return `${word} (${pos}) => ${meaning}; scene: ${scene}${tail ? `; ${tail}` : ""}`;
    });

  return lines.join("\n");
}

function splitWordsForMixedScenes(words, usagePlan) {
  const sourceWords = Array.isArray(words) ? words.map((w) => String(w || "").trim()).filter(Boolean) : [];
  if (sourceWords.length <= 3) return [sourceWords];

  const hardGroup = [];
  const easyGroup = [];
  for (const word of sourceWords) {
    if (MIXED_HARD_WORDS.has(word.toLowerCase())) {
      hardGroup.push(word);
    } else {
      easyGroup.push(word);
    }
  }
  if (hardGroup.length > 0 && easyGroup.length > 0 && sourceWords.length >= 4) {
    return [easyGroup, hardGroup];
  }
  if (sourceWords.length <= 6) return [sourceWords];

  const plan = Array.isArray(usagePlan) ? usagePlan : [];
  const sceneMap = new Map();
  const wordScene = new Map(plan.map((item) => [String(item?.word || "").toLowerCase(), String(item?.scene || "").trim()]));
  for (const word of sourceWords) {
    const scene = wordScene.get(word.toLowerCase()) || "daily-life";
    const bucket = sceneMap.get(scene) || [];
    bucket.push(word);
    sceneMap.set(scene, bucket);
  }
  const groups = Array.from(sceneMap.values()).filter((arr) => arr.length > 0);
  if (groups.length >= 2) {
    return groups.slice(0, 3);
  }
  return [sourceWords];
}

function countWordOccurrences(text, word) {
  const source = String(text || "");
  const escaped = String(word || "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  if (!escaped) return 0;
  const regex = new RegExp(`(^|[^A-Za-z])${escaped}(?:[①②③④⑤⑥⑦⑧⑨⑩])?(?=$|[^A-Za-z])`, "gi");
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

function countChineseChars(text) {
  const matches = String(text || "").match(/[\u4e00-\u9fff]/g);
  return matches ? matches.length : 0;
}

function findLargeWordGapsFromRuns(runs, maxGap = 18) {
  const sourceRuns = Array.isArray(runs) ? runs : [];
  const issues = [];
  let prevWordRun = null;
  let betweenText = "";

  for (const run of sourceRuns) {
    if (String(run?.type || "") === "word") {
      if (prevWordRun) {
        const chineseChars = countChineseChars(betweenText);
        if (chineseChars > maxGap) {
          issues.push({
            from: String(prevWordRun?.word || prevWordRun?.text || "").trim(),
            to: String(run?.word || run?.text || "").trim(),
            chineseChars,
            gapPreview: String(betweenText || "")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 80)
          });
        }
      }
      prevWordRun = run;
      betweenText = "";
      continue;
    }

    if (prevWordRun) {
      betweenText += String(run?.text || "");
    }
  }

  return issues;
}

function findLeadWordGapFromRuns(runs, maxLeadChineseChars = 12) {
  const sourceRuns = Array.isArray(runs) ? runs : [];
  let leadText = "";

  for (const run of sourceRuns) {
    if (String(run?.type || "") === "word") {
      break;
    }
    leadText += String(run?.text || "");
  }

  const chineseChars = countChineseChars(leadText);
  if (chineseChars > maxLeadChineseChars) {
    return {
      chineseChars,
      preview: String(leadText || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80)
    };
  }
  return null;
}

function findTailWordGapFromRuns(runs, maxTailChineseChars = 20) {
  const sourceRuns = Array.isArray(runs) ? runs : [];
  let tailText = "";
  let metWord = false;

  for (let i = sourceRuns.length - 1; i >= 0; i -= 1) {
    const run = sourceRuns[i];
    if (String(run?.type || "") === "word") {
      metWord = true;
      break;
    }
    tailText = `${String(run?.text || "")}${tailText}`;
  }

  if (!metWord) return null;

  const chineseChars = countChineseChars(tailText);
  if (chineseChars > maxTailChineseChars) {
    return {
      chineseChars,
      preview: String(tailText || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80)
    };
  }
  return null;
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

function hasChineseChars(value) {
  return /[\u4e00-\u9fff]/.test(String(value || ""));
}

function buildBaseLexiconForResponse(lexicon) {
  return (Array.isArray(lexicon) ? lexicon : []).map((item) => {
    const senses = Array.isArray(item?.senses) ? item.senses : [];
    const baseMeanings = senses.map((s) => String(s?.meaning || "").trim()).filter(Boolean).slice(0, 5);
    return {
      ...item,
      baseMeanings
    };
  });
}

function isPlaceholderDetailList(values) {
  const rows = (Array.isArray(values) ? values : []).map((x) => String(x || "").trim()).filter(Boolean);
  if (rows.length === 0) return true;
  return rows.every((x) => x === "(暂无)");
}

function isPlaceholderDetailText(value) {
  const text = String(value || "").trim();
  return !text || text === "(暂无)";
}

function hasSparseDetailEntry(entry) {
  const source = entry && typeof entry === "object" ? entry : {};
  return (
    isPlaceholderDetailList(source.collocations) ||
    isPlaceholderDetailText(source.wordFormation) ||
    isPlaceholderDetailList(source.synonyms) ||
    isPlaceholderDetailList(source.antonyms)
  );
}

function detailEntryScore(entry) {
  const source = entry && typeof entry === "object" ? entry : {};
  const collocationsCount = isPlaceholderDetailList(source.collocations) ? 0 : (Array.isArray(source.collocations) ? source.collocations.length : 0);
  const synonymsCount = isPlaceholderDetailList(source.synonyms) ? 0 : (Array.isArray(source.synonyms) ? source.synonyms.length : 0);
  const antonymsCount = isPlaceholderDetailList(source.antonyms) ? 0 : (Array.isArray(source.antonyms) ? source.antonyms.length : 0);
  const formationScore = isPlaceholderDetailText(source.wordFormation) ? 0 : 1;
  return collocationsCount * 2 + synonymsCount + antonymsCount + formationScore;
}

function mergeDetailEntry(baseEntry, detailPatch) {
  const base = baseEntry && typeof baseEntry === "object" ? baseEntry : {};
  const patch = detailPatch && typeof detailPatch === "object" ? detailPatch : {};
  const merged = { ...base };
  if (!isPlaceholderDetailList(patch.collocations)) {
    merged.collocations = patch.collocations;
  }
  if (!isPlaceholderDetailText(patch.wordFormation)) {
    merged.wordFormation = patch.wordFormation;
  }
  if (!isPlaceholderDetailList(patch.synonyms)) {
    merged.synonyms = patch.synonyms;
  }
  if (!isPlaceholderDetailList(patch.antonyms)) {
    merged.antonyms = patch.antonyms;
  }
  return merged;
}

async function enrichSingleWordDetailEntry(word, entry, model) {
  if (!hasSparseDetailEntry(entry)) return entry;
  const normalizedWord = String(word || "").trim();
  if (!normalizedWord) return entry;
  const prompt = [
    "You are filling detailed IELTS vocabulary card fields for one word.",
    "Return ONLY JSON object.",
    '{"word":"...", "collocations": string[], "word_formation": string, "synonyms": string[], "antonyms": string[]}',
    "Rules:",
    "1) Keep collocations practical and high-frequency, format like: phrase (中文).",
    "2) word_formation should be concise Chinese root/prefix/suffix explanation when useful.",
    "3) synonyms/antonyms should be common exam-friendly words.",
    "4) Do not return empty placeholders like (暂无) unless truly impossible.",
    `Word: ${normalizedWord}`,
    "Current card snapshot:",
    JSON.stringify(
      {
        pos: String(entry?.pos || ""),
        senses: Array.isArray(entry?.senses) ? entry.senses : [],
        collocations: Array.isArray(entry?.collocations) ? entry.collocations : [],
        wordFormation: String(entry?.wordFormation || ""),
        synonyms: Array.isArray(entry?.synonyms) ? entry.synonyms : [],
        antonyms: Array.isArray(entry?.antonyms) ? entry.antonyms : []
      },
      null,
      2
    )
  ].join("\n");

  try {
    const text = await callOpenAIText(prompt, { maxTokens: 520, model, step: "vocab_detail_enrich" });
    const parsed = extractJsonObject(text);
    if (!parsed || typeof parsed !== "object") return entry;
    const patch = {
      collocations: Array.isArray(parsed?.collocations)
        ? parsed.collocations.map((x) => sanitizeGlossText(x, 220)).filter(Boolean).slice(0, 8)
        : [],
      wordFormation: typeof parsed?.word_formation === "string"
        ? sanitizeGlossText(parsed.word_formation, 500)
        : typeof parsed?.wordFormation === "string"
          ? sanitizeGlossText(parsed.wordFormation, 500)
          : "",
      synonyms: Array.isArray(parsed?.synonyms)
        ? parsed.synonyms.map((x) => sanitizeGlossText(x, 120)).filter(Boolean).slice(0, 10)
        : [],
      antonyms: Array.isArray(parsed?.antonyms)
        ? parsed.antonyms.map((x) => sanitizeGlossText(x, 120)).filter(Boolean).slice(0, 10)
        : []
    };
    return mergeDetailEntry(entry, patch);
  } catch {
    return entry;
  }
}

function buildContextGlosses(words, baseLexicon, contextLexicon, usagePlan, alignment) {
  const sourceWords = Array.isArray(words) ? words.map((w) => String(w || "").trim()).filter(Boolean) : [];
  const baseMap = new Map((Array.isArray(baseLexicon) ? baseLexicon : []).map((x) => [String(x?.word || "").toLowerCase(), x]));
  const contextMap = new Map((Array.isArray(contextLexicon) ? contextLexicon : []).map((x) => [String(x?.word || "").toLowerCase(), x]));
  const planMap = new Map((Array.isArray(usagePlan) ? usagePlan : []).map((x) => [String(x?.word || "").toLowerCase(), x]));
  const alignMap = new Map((Array.isArray(alignment) ? alignment : []).map((x) => [String(x?.word || "").toLowerCase(), x]));

  return sourceWords.map((word) => {
    const key = word.toLowerCase();
    const base = baseMap.get(key);
    const context = contextMap.get(key) || base;
    const plan = planMap.get(key);
    const align = alignMap.get(key);

    const baseMeanings = (Array.isArray(base?.senses) ? base.senses : [])
      .map((s) => String(s?.meaning || "").trim())
      .filter(Boolean)
      .slice(0, 5);
    const contextMeaningFromPlan = String(plan?.meaning || "").trim();
    const contextMeaningFromLexicon = (Array.isArray(context?.senses) ? context.senses : [])
      .map((s) => String(s?.meaning || "").trim())
      .find((m) => hasChineseChars(m)) || "";
    const contextMeaning = hasChineseChars(contextMeaningFromPlan)
      ? contextMeaningFromPlan
      : contextMeaningFromLexicon || baseMeanings[0] || "";
    const fallbackHints = buildMustKeepEnglishHints(word, contextMeaning);

    return {
      word: context?.word || base?.word || word,
      pos: normalizePosTag(context?.pos || base?.pos || plan?.pos || ""),
      marker: String(align?.marker || context?.senses?.[0]?.marker || base?.senses?.[0]?.marker || "①"),
      contextMeaning,
      scene: String(plan?.scene || "").trim(),
      naturalPattern: String(plan?.allowedPattern || "").trim(),
      avoid: String(plan?.avoid || "").trim(),
      mustKeepEnglish: Boolean(plan?.mustKeepEnglish ?? fallbackHints.mustKeepEnglish),
      preferredPattern: String(plan?.preferredPattern || fallbackHints.preferredPattern || "").trim(),
      forbiddenChineseOnly: normalizeChinesePhraseList(plan?.forbiddenChineseOnly || fallbackHints.forbiddenChineseOnly || [], 8),
      allowedTemplates: Array.from(
        new Set(
          (Array.isArray(plan?.allowedTemplates) ? plan.allowedTemplates : Array.isArray(fallbackHints.allowedTemplates) ? fallbackHints.allowedTemplates : [])
            .map((x) => String(x || "").trim())
            .filter(Boolean)
        )
      ).slice(0, 8)
    };
  });
}

function buildArticleRuns(article, words, contextGlosses) {
  const source = String(article || "");
  const sourceWords = Array.isArray(words) ? words.map((w) => String(w || "").trim()).filter(Boolean) : [];
  if (sourceWords.length === 0 || !source) {
    return source ? [{ type: "text", text: source }] : [];
  }

  const glossMap = new Map((Array.isArray(contextGlosses) ? contextGlosses : []).map((x) => [String(x?.word || "").toLowerCase(), x]));
  const escaped = sourceWords
    .map((w) => escapeRegex(w).replace(/\s+/g, "\\s+"))
    .sort((a, b) => b.length - a.length);
  if (escaped.length === 0) {
    return [{ type: "text", text: source }];
  }

  const markerSet = "①②③④⑤⑥⑦⑧⑨⑩";
  const pattern = new RegExp(`(^|[^A-Za-z])(${escaped.join("|")})([${markerSet}]?)(?=$|[^A-Za-z])`, "gi");
  const runs = [];
  const countParagraphBreaks = (text) => (String(text || "").match(/\n\s*\n+/g) || []).length;
  let paragraphIndex = 0;
  let cursor = 0;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    const prefix = String(match[1] || "");
    const matchedWord = String(match[2] || "");
    const marker = String(match[3] || "");
    const start = match.index + prefix.length;
    const end = start + matchedWord.length + marker.length;
    if (start < cursor) continue;

    if (start > cursor) {
      const gapText = source.slice(cursor, start);
      runs.push({
        type: "text",
        text: gapText,
        paragraphIndex,
        charStart: cursor,
        charEnd: start
      });
      paragraphIndex += countParagraphBreaks(gapText);
    }

    const key = matchedWord.toLowerCase();
    const gloss = glossMap.get(key) || {};
    runs.push({
      type: "word",
      word: gloss?.word || matchedWord,
      text: matchedWord,
      marker: marker || String(gloss?.marker || "①"),
      pos: String(gloss?.pos || ""),
      displayMeaning: String(gloss?.contextMeaning || ""),
      paragraphIndex,
      charStart: start,
      charEnd: end
    });
    cursor = end;
  }

  if (cursor < source.length) {
    runs.push({
      type: "text",
      text: source.slice(cursor),
      paragraphIndex,
      charStart: cursor,
      charEnd: source.length
    });
  }

  return runs.filter((run) => String(run?.text || run?.word || "").length > 0);
}

function shouldRunContextRefine(words, lexicon, generationMode, generationQuality, contextGlosses) {
  const mode = String(generationMode || "").toLowerCase();
  if (mode !== "mixed") return false;
  if (normalizeGenerationQuality(generationQuality) !== "advanced") return false;
  const sourceWords = Array.isArray(words) ? words : [];
  const sourceLexicon = Array.isArray(lexicon) ? lexicon : [];
  if (sourceWords.length === 0 || sourceWords.length > 8 || sourceLexicon.length === 0) return false;
  const rows = Array.isArray(contextGlosses) ? contextGlosses : [];
  const missingContextCount = rows.filter((row) => !hasChineseChars(row?.contextMeaning)).length;
  return missingContextCount > 0;
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
    "meaning should be suitable for direct visual display under the word.",
    "Keep meaning short, natural, and learner-friendly.",
    "Avoid dictionary-style wording, abstract phrasing, or overly literal glosses.",
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

function normalizeMixedSemanticReview(rows, words) {
  const sourceWords = Array.isArray(words) ? words.map((w) => String(w || "").trim()).filter(Boolean) : [];
  const fallback = sourceWords.map((word) => ({
    word,
    natural: true,
    meaningOk: true,
    reason: "",
    suggestion: ""
  }));
  if (!Array.isArray(rows) || sourceWords.length === 0) return fallback;

  const byWord = new Map();
  for (const row of rows) {
    const key = String(row?.word || "").trim().toLowerCase();
    if (!key || byWord.has(key)) continue;
    byWord.set(key, row);
  }

  const toBool = (value, defaultValue) => {
    if (typeof value === "boolean") return value;
    const s = String(value || "").trim().toLowerCase();
    if (!s) return defaultValue;
    if (["true", "1", "yes", "y", "是"].includes(s)) return true;
    if (["false", "0", "no", "n", "否"].includes(s)) return false;
    return defaultValue;
  };

  return fallback.map((base) => {
    const hit = byWord.get(String(base.word || "").toLowerCase()) || {};
    return {
      word: base.word,
      natural: toBool(hit?.natural, true),
      meaningOk: toBool(hit?.meaning_ok ?? hit?.meaningOk, true),
      reason: String(hit?.reason || "").trim().slice(0, 160),
      suggestion: String(hit?.suggestion || "").trim().slice(0, 160)
    };
  });
}

async function reviewMixedSemantics(words, lexicon, article, quickMode, model) {
  const sourceWords = Array.isArray(words) ? words.map((w) => String(w || "").trim()).filter(Boolean) : [];
  if (sourceWords.length === 0) return [];

  const contextMap = buildWordContextSnippetMap(article, sourceWords);
  const lexMap = new Map((Array.isArray(lexicon) ? lexicon : []).map((item) => [String(item?.word || "").toLowerCase(), item]));
  const reviewGuide = sourceWords
    .map((word) => {
      const item = lexMap.get(String(word || "").toLowerCase());
      const pos = normalizePosTag(item?.pos || "");
      const primaryMeaning =
        Array.isArray(item?.senses) && item.senses.length > 0 ? String(item.senses[0]?.meaning || "").trim() : "词义待补充";
      const ctx = contextMap.get(String(word || "").toLowerCase()) || "(no hit)";
      return `${word} (${pos || "-"}) => ${primaryMeaning}; context: ${ctx}`;
    })
    .join("\n");

  const prompt = [
    "You are reviewing semantic naturalness for a Chinese-first mixed-language passage.",
    "Return ONLY JSON array in the same order as input words.",
    "Each item format:",
    '{"word": string, "natural": boolean, "meaning_ok": boolean, "reason": string, "suggestion": string}',
    "Rules:",
    "1) natural=false when the sentence sounds forced, collocation is odd, or native-like Chinese mixed speech would not say it this way.",
    "2) meaning_ok=false when the displayed Chinese meaning does not match the sentence context.",
    "3) reason/suggestion should be concise Chinese, no markdown.",
    "4) Be strict and practical; do not mark everything true.",
    "5) Coverage is validated by exact literal English surface forms.",
    "6) Chinese translation does NOT count as usage.",
    "7) Do not suggest replacing the target word with a Chinese-only paraphrase.",
    "8) The target word must remain visible in English.",
    '9) If the target word is "Derive", "Sterility", "Plume", "Bristle", "Cricket", etc., do not suggest translating it away.',
    `Words: ${sourceWords.join(", ")}`,
    "Word guide:",
    reviewGuide,
    "Passage:",
    String(article || "")
  ].join("\n");

  try {
    const text = await callOpenAIText(prompt, { maxTokens: quickMode ? 420 : 900, model, step: "review_semantics" });
    const parsed = extractJsonArray(text);
    return normalizeMixedSemanticReview(parsed, sourceWords);
  } catch (error) {
    console.error("Failed to review mixed semantics:", error.message);
    return normalizeMixedSemanticReview([], sourceWords);
  }
}

async function rewriteAwkwardMixedClauses(article, reviewRows, lexicon, quickMode, model) {
  const source = String(article || "").trim();
  if (!source) return source;
  const issues = (Array.isArray(reviewRows) ? reviewRows : [])
    .filter((row) => !row?.natural || !row?.meaningOk)
    .map((row) => ({
      word: String(row?.word || "").trim(),
      reason: String(row?.reason || "").trim(),
      suggestion: String(row?.suggestion || "").trim()
    }))
    .filter((row) => row.word);
  if (issues.length === 0) return source;

  const lexMap = new Map((Array.isArray(lexicon) ? lexicon : []).map((item) => [String(item?.word || "").toLowerCase(), item]));
  const issueGuide = issues
    .map((issue) => {
      const item = lexMap.get(String(issue.word || "").toLowerCase());
      const pos = normalizePosTag(item?.pos || "");
      const primaryMeaning =
        Array.isArray(item?.senses) && item.senses.length > 0 ? String(item.senses[0]?.meaning || "").trim() : "词义待补充";
      return `${issue.word} (${pos || "-"}) => ${primaryMeaning}`;
    })
    .join("\n");

  const prompt = [
    "You are revising awkward lines in a Chinese-first mixed-language passage.",
    "Return ONLY the fully revised passage text, no JSON, no markdown.",
    "Keep the same overall voice and paragraph rhythm.",
    "Only rewrite clauses/sentences that are semantically awkward or collocation-wrong.",
    "Do not add glossary sections, keyword lists, or dictionary-style lines.",
    "Do not output Chinese gloss + English word duplicates (e.g., 残忍cruel / 无菌sterility with direct duplicate meaning).",
    "Keep target words in their original form.",
    "Coverage is validated by exact literal English surface forms.",
    "Chinese translation does NOT count as usage.",
    "Do not remove, translate away, or paraphrase away any target English word.",
    "Keep every target word visible in exact English form.",
    'If the target word is "Derive", "Sterility", "Plume", "Bristle", "Cricket", etc., do not translate it away.',
    "If one word is hard to place naturally, move it to a short separate micro-scene.",
    "Problem words and notes JSON:",
    JSON.stringify(issues, null, 2),
    "Vocabulary guide:",
    issueGuide,
    "Original passage:",
    source
  ].join("\n");

  try {
    const revised = await callOpenAIText(prompt, { maxTokens: quickMode ? 520 : 980, model, step: "rewrite_awkward" });
    const cleaned = cleanMixedArtifactText(revised);
    return cleaned || source;
  } catch (error) {
    console.error("Failed to rewrite awkward mixed clauses:", error.message);
    return source;
  }
}

function buildMissingRewriteFallback(missingWords, lexicon, generationMode = "mixed") {
  const markerMap = new Map(
    (lexicon || []).map((x) => [String(x.word || "").toLowerCase(), String(x?.senses?.[0]?.marker || "①")])
  );
  const isMixedMode = isMixedGenerationMode(generationMode);
  const lines = (missingWords || []).map((word, index) => {
    const marker = markerMap.get(String(word).toLowerCase()) || "①";
    const token = isMixedMode ? String(word) : `${word}${marker}`;
    if (isMixedMode) {
      return `后来想想，这个细节让我记住了 ${token}。`;
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

  const isMixedMode = isMixedGenerationMode(generationMode);
  const prompt = isMixedMode
    ? [
        "You are rewriting missing vocabulary content for a mixed Chinese-English learning passage.",
        "Return plain text only. No JSON, no markdown, no list bullets.",
        "Write concise Chinese sentences.",
        "Each sentence should include one target English word in original form.",
        "Each target word must appear exactly once across the whole output.",
        "Coverage is validated by exact literal English surface forms.",
        "Chinese translation does NOT count as usage.",
        "Never replace a target word with Chinese-only wording.",
        "Every target word must appear in the final passage as the exact English token from input.",
        'If the target word is "Derive", "Sterility", "Plume", "Bristle", "Cricket", etc., do not translate it away.',
        "Do NOT output Chinese gloss + English word pairs such as 板球 cricket / 无菌 sterility.",
        "When Chinese characters directly connect with a target word, keep compact form like 打cricket / 的sterility (no extra spaces).",
        "Do NOT use parentheses style like 中文（word）.",
        "Do NOT output standalone dictionary lines such as 'n. xxx'.",
        "Make each added sentence sound like a natural continuation of the same voice.",
        "Do not sound like a repair patch or vocabulary exercise.",
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

  if (String(generationMode || "").toLowerCase() === "mixed") {
    return [];
  }

  const localAlignment = normalizeAlignment(words, lexicon, [], paragraphsEn, paragraphsZh);

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
        baseLexicon: Array.isArray(alignmentParsed.baseLexicon) ? alignmentParsed.baseLexicon : [],
        contextGlosses: Array.isArray(alignmentParsed.contextGlosses) ? alignmentParsed.contextGlosses : [],
        runs: Array.isArray(alignmentParsed.runs) ? alignmentParsed.runs : [],
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

app.post("/api/vocab/detail", async (req, res) => {
  try {
    const authedUser = await requireAuth(req, res);
    if (!authedUser) return;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY in .env" });
    }

    const rawWord = String(req.body?.word || "");
    const word = normalizeInputWordToken(rawWord);
    if (!word) {
      return res.status(400).json({ error: "Please provide one valid word." });
    }

    const generationQuality = normalizeGenerationQuality(req.body?.generationQuality || "normal");
    const generationProfile = getGenerationProfile(generationQuality);
    const selectedModel = generationProfile.model;
    const quickMode = false;
    console.log("[api/vocab/detail] word =", word);
    const fullLexicon = await generateLexicon([word], quickMode, selectedModel, "full");
    console.log("[api/vocab/detail] full lexicon =", fullLexicon);
    const baseLexicon = buildBaseLexiconForResponse(fullLexicon);
    let entry = Array.isArray(baseLexicon) && baseLexicon.length > 0 ? baseLexicon[0] : null;
    if (entry && hasSparseDetailEntry(entry) && selectedModel !== OPENAI_MODEL_ADVANCED) {
      const richerLexicon = await generateLexicon([word], false, OPENAI_MODEL_ADVANCED, "full");
      const richerBaseLexicon = buildBaseLexiconForResponse(richerLexicon);
      const richerEntry = Array.isArray(richerBaseLexicon) && richerBaseLexicon.length > 0 ? richerBaseLexicon[0] : null;
      if (detailEntryScore(richerEntry) > detailEntryScore(entry)) {
        entry = richerEntry;
      }
    }
    if (entry && hasSparseDetailEntry(entry)) {
      const enriched = await enrichSingleWordDetailEntry(word, entry, OPENAI_MODEL_ADVANCED || selectedModel);
      if (detailEntryScore(enriched) >= detailEntryScore(entry)) {
        entry = enriched;
      }
    }
    console.log("[api/vocab/detail] entry =", entry);
    if (!entry) {
      return res.status(404).json({ error: "Word detail not found." });
    }

    res.json({
      ok: true,
      entry: {
        word: String(entry?.word || word),
        pos: String(entry?.pos || ""),
        usIpa: String(entry?.usIpa || ""),
        ukIpa: String(entry?.ukIpa || ""),
        senses: Array.isArray(entry?.senses) ? entry.senses : [],
        baseMeanings: Array.isArray(entry?.baseMeanings) ? entry.baseMeanings : [],
        collocations: Array.isArray(entry?.collocations) ? entry.collocations : [],
        wordFormation: String(entry?.wordFormation || ""),
        synonyms: Array.isArray(entry?.synonyms) ? entry.synonyms : [],
        antonyms: Array.isArray(entry?.antonyms) ? entry.antonyms : []
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get vocabulary detail.", detail: error.message });
  }
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
    if (!looksLikeWordListOnlyInput(rawWords)) {
      return res.status(400).json({ error: "Please provide a word list only, not a full article or paragraph." });
    }
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
      let lexicon = await generateLexicon(words, quickMode, selectedModel, generationMode === "mixed" ? "core" : "full");
      const baseLexiconRaw = cloneJsonSafe(lexicon, []);
      let mixedUsagePlan =
        generationMode === "mixed" ? await planMixedUsage(words, lexicon, quickMode, selectedModel) : [];
      const mixedLexiconMap = new Map((Array.isArray(lexicon) ? lexicon : []).map((item) => [String(item?.word || "").toLowerCase(), item]));
      const mixedUsageRows = Array.isArray(mixedUsagePlan) ? mixedUsagePlan : [];
      const rebuildMixedArticleFromChunks = (pack) => {
        const chunks = Array.isArray(pack?.chunks) ? pack.chunks : [];
        return chunks
          .map((chunk) => String(chunk?.article || "").trim())
          .filter(Boolean)
          .join("\n\n");
      };
      const summarizeBetweenWordIssues = (issues) =>
        (Array.isArray(issues) ? issues : [])
          .slice(0, 4)
          .map((row) => `${row.from}->${row.to}:${row.chineseChars}字`)
          .join("; ");
      const computeSparseIssues = (articleText) => {
        if (generationMode !== "mixed") {
          return { betweenWordIssues: [], leadIssue: null, tailIssue: null };
        }
        const runsForGapCheck = buildArticleRuns(articleText, words, []);
        return {
          betweenWordIssues: findLargeWordGapsFromRuns(runsForGapCheck, 18),
          leadIssue: findLeadWordGapFromRuns(runsForGapCheck, 12),
          tailIssue: findTailWordGapFromRuns(runsForGapCheck, 20)
        };
      };
      const getChunkIndexByWord = (pack) => {
        const map = new Map();
        const chunks = Array.isArray(pack?.chunks) ? pack.chunks : [];
        chunks.forEach((chunk, idx) => {
          (Array.isArray(chunk?.words) ? chunk.words : []).forEach((word) => {
            const key = String(word || "").trim().toLowerCase();
            if (key && !map.has(key)) {
              map.set(key, idx);
            }
          });
        });
        return map;
      };
      const pickRetryChunkIndexes = (pack, missingWords, overusedWords, betweenWordIssues, leadIssue, tailIssue) => {
        const chunks = Array.isArray(pack?.chunks) ? pack.chunks : [];
        if (chunks.length === 0) return [];
        const wordChunkMap = getChunkIndexByWord(pack);
        const set = new Set();

        if (leadIssue) {
          set.add(0);
        }
        if (tailIssue) {
          set.add(chunks.length - 1);
        }
        for (const word of Array.isArray(missingWords) ? missingWords : []) {
          const idx = wordChunkMap.get(String(word || "").trim().toLowerCase());
          if (Number.isInteger(idx)) set.add(idx);
        }
        for (const word of Array.isArray(overusedWords) ? overusedWords : []) {
          const idx = wordChunkMap.get(String(word || "").trim().toLowerCase());
          if (Number.isInteger(idx)) set.add(idx);
        }
        for (const issue of Array.isArray(betweenWordIssues) ? betweenWordIssues : []) {
          const fromIdx = wordChunkMap.get(String(issue?.from || "").trim().toLowerCase());
          const toIdx = wordChunkMap.get(String(issue?.to || "").trim().toLowerCase());
          if (Number.isInteger(fromIdx)) set.add(fromIdx);
          if (Number.isInteger(toIdx)) set.add(toIdx);
        }
        if (set.size === 0) {
          set.add(0);
        }
        return Array.from(set).sort((a, b) => a - b);
      };
      const regenerateMixedChunks = async (pack, chunkIndexes, extraConstraint = "", strictLead = false) => {
        const chunks = Array.isArray(pack?.chunks) ? pack.chunks : [];
        if (chunks.length === 0) return pack;
        const indexes = Array.from(new Set(Array.isArray(chunkIndexes) ? chunkIndexes : [])).filter(
          (idx) => Number.isInteger(idx) && idx >= 0 && idx < chunks.length
        );
        if (indexes.length === 0) return pack;
        let deterministicChunkAppendUsed = Boolean(pack?.hasDeterministicChunkAppend);

        for (const idx of indexes) {
          const chunk = chunks[idx];
          const chunkWords = Array.isArray(chunk?.words) ? chunk.words : [];
          if (chunkWords.length === 0) continue;
          const chunkSet = new Set(chunkWords.map((w) => String(w || "").toLowerCase()));
          const chunkLexicon = chunkWords.map((w) => mixedLexiconMap.get(String(w || "").toLowerCase())).filter(Boolean);
          const chunkPlan = mixedUsageRows.filter((item) => chunkSet.has(String(item?.word || "").toLowerCase()));
          const chunkPlanMap = new Map((Array.isArray(chunkPlan) ? chunkPlan : []).map((item) => [String(item?.word || "").toLowerCase(), item]));
          const chunkLexMap = new Map((Array.isArray(chunkLexicon) ? chunkLexicon : []).map((item) => [String(item?.word || "").toLowerCase(), item]));
          const chunkContextRows = chunkWords.map((word) => {
            const key = String(word || "").toLowerCase();
            const plan = chunkPlanMap.get(key);
            const lexItem = chunkLexMap.get(key);
            const contextMeaning = String(plan?.meaning || lexItem?.senses?.[0]?.meaning || "").trim();
            const hints = buildMustKeepEnglishHints(word, contextMeaning);
            return {
              word,
              contextMeaning,
              mustKeepEnglish: Boolean(plan?.mustKeepEnglish ?? hints.mustKeepEnglish),
              preferredPattern: String(plan?.preferredPattern || hints.preferredPattern || "").trim(),
              forbiddenChineseOnly: normalizeChinesePhraseList(plan?.forbiddenChineseOnly || hints.forbiddenChineseOnly || [], 10),
              allowedTemplates: Array.isArray(plan?.allowedTemplates) ? plan.allowedTemplates : hints.allowedTemplates
            };
          });
          const strictLeadRules =
            strictLead && idx === 0
              ? [
                  "The passage must start with a target word in the first sentence.",
                  "The first sentence must contain a target word.",
                  "Before the first target word, allow at most 8 Chinese characters.",
                  "No Chinese-only intro."
                ]
              : [];
          const denseConstraint = [
            extraConstraint,
            `Regenerate only this failed dense chunk ${idx + 1}/${chunks.length}.`,
            strictLeadRules.join(" "),
            "Coverage is validated by exact literal English surface forms.",
            "Chinese translation does NOT count as usage.",
            "Never replace a target word with Chinese-only wording."
          ]
            .filter(Boolean)
            .join(" ");
          let regenerated = await generateArticlePackage(
            chunkWords,
            level,
            quickMode,
            chunkLexicon,
            "mixed_dense",
            denseConstraint,
            selectedModel,
            chunkPlan
          );
          let chunkArticle = String(regenerated?.article || "").trim();
          let localMissing = findMissingWords(chunkArticle, chunkWords);
          let localSoftIssues = findSoftMissingByChineseSubstitution(chunkArticle, chunkContextRows);

          if (localMissing.length > 0) {
            const localRetryConstraint = [
              denseConstraint,
              "Important local fix: every target word in this chunk must appear as the exact English token.",
              "Coverage is validated by exact literal English surface forms.",
              "Chinese translation does NOT count as usage.",
              "Never replace a target word with Chinese-only wording.",
              `Missing local words: ${localMissing.join(", ")}.`
            ]
              .filter(Boolean)
              .join(" ");
            regenerated = await generateArticlePackage(
              chunkWords,
              level,
              quickMode,
              chunkLexicon,
              "mixed_dense",
              localRetryConstraint,
              selectedModel,
              chunkPlan
            );
            chunkArticle = String(regenerated?.article || "").trim();
            localMissing = findMissingWords(chunkArticle, chunkWords);
            localSoftIssues = findSoftMissingByChineseSubstitution(chunkArticle, chunkContextRows);
          }

          if (localSoftIssues.length > 0) {
            chunkArticle = restoreEnglishIntoChinesePhrase(chunkArticle, localSoftIssues);
            localMissing = findMissingWords(chunkArticle, chunkWords);
            localSoftIssues = findSoftMissingByChineseSubstitution(chunkArticle, chunkContextRows);
          }

          if (localMissing.length > 0) {
            chunkArticle = appendGuaranteedMissingWordsMixed(chunkArticle, localMissing);
            deterministicChunkAppendUsed = true;
          }

          chunks[idx] = {
            ...chunk,
            article: chunkArticle,
            words: chunkWords.slice()
          };
          if (idx === 0) {
            pack.title = String(regenerated?.title || pack?.title || "").trim() || pack?.title || "";
          }
        }

        pack.chunks = chunks;
        pack.article = rebuildMixedArticleFromChunks(pack);
        pack.hasDeterministicChunkAppend = deterministicChunkAppendUsed;
        return pack;
      };
      const generateMainArticle = async (extraConstraint = "") => {
        if (generationMode === "mixed") {
          return generateMixedDenseArticleByChunks(
            words,
            level,
            quickMode,
            lexicon,
            extraConstraint,
            selectedModel,
            mixedUsagePlan
          );
        }
        return generateArticlePackage(words, level, quickMode, lexicon, generationMode, extraConstraint, selectedModel, []);
      };

      let articlePack = await generateMainArticle("");
      if (generationMode === "mixed") {
        articlePack.article = normalizeMixedArticleStyle(articlePack.article, words, lexicon);
      }
      let missing = findMissingWords(articlePack.article, words);
      let overused = generationMode === "mixed" ? findOverusedWords(articlePack.article, words, 2) : [];
      let sparseDiagnostics =
        generationMode === "mixed"
          ? computeSparseIssues(articlePack.article)
          : { betweenWordIssues: [], leadIssue: null, tailIssue: null };

      const retryCount = generationMode === "mixed" ? (quickMode ? 0 : 1) : quickMode ? 1 : 2;
      for (
        let i = 0;
        i < retryCount &&
        (missing.length > 0 ||
          overused.length > 0 ||
          sparseDiagnostics.betweenWordIssues.length > 0 ||
          sparseDiagnostics.leadIssue !== null ||
          sparseDiagnostics.tailIssue !== null);
        i += 1
      ) {
        const retryConstraint = [
          `Important fix (round ${i + 1}): ALL target words must be included.`,
          `Missing words: ${missing.join(", ")}.`,
          overused.length > 0
            ? `Overused words (too many repeats): ${overused.join(", ")}. Reduce each to 1 occurrence, max 2.`
            : "",
          sparseDiagnostics.betweenWordIssues.length > 0
            ? `Large Chinese gap(s) between adjacent target words: ${summarizeBetweenWordIssues(
                sparseDiagnostics.betweenWordIssues
              )}.`
            : "",
          sparseDiagnostics.leadIssue
            ? `Lead Chinese-only gap before first target word is too long (${sparseDiagnostics.leadIssue.chineseChars} chars).`
            : "",
          sparseDiagnostics.tailIssue
            ? `Tail Chinese-only gap after last target word is too long (${sparseDiagnostics.tailIssue.chineseChars} chars).`
            : "",
          "If needed, split into short fragments, but keep natural Chinese body and include every target word.",
          "Mixed mode should stay compact and natural, avoid long Chinese-only blocks.",
          "Shorten Chinese distance between adjacent target words. Keep compact layout; no long Chinese paragraph.",
          "Coverage is validated by exact literal English surface forms.",
          "Chinese translation does NOT count as usage.",
          "Never replace a target word with Chinese-only wording.",
          "Every target word must appear in the final passage as the exact English token from input.",
          "The passage must start with a target word in the first sentence.",
          "Do not write a long Chinese-only introduction before the first target word.",
          "Before the first target word, allow at most 12 Chinese characters.",
          "Start directly with the mixed content, not with background setup."
        ]
          .filter(Boolean)
          .join(" ");

        if (generationMode === "mixed" && Array.isArray(articlePack?.chunks) && articlePack.chunks.length > 0) {
          const retryChunkIndexes = pickRetryChunkIndexes(
            articlePack,
            missing,
            overused,
            sparseDiagnostics.betweenWordIssues,
            sparseDiagnostics.leadIssue,
            sparseDiagnostics.tailIssue
          );
          articlePack = await regenerateMixedChunks(articlePack, retryChunkIndexes, retryConstraint, Boolean(sparseDiagnostics.leadIssue));
        } else {
          articlePack = await generateMainArticle(retryConstraint);
        }
        if (generationMode === "mixed") {
          articlePack.article = normalizeMixedArticleStyle(articlePack.article, words, lexicon);
          if (Array.isArray(articlePack?.chunks) && articlePack.chunks.length > 0) {
            articlePack.chunks = articlePack.chunks.map((chunk) => ({
              ...chunk,
              article: normalizeMixedArticleStyle(chunk?.article || "", chunk?.words || [], lexicon)
            }));
            articlePack.article = rebuildMixedArticleFromChunks(articlePack);
          }
        }
        missing = findMissingWords(articlePack.article, words);
        overused = generationMode === "mixed" ? findOverusedWords(articlePack.article, words, 2) : [];
        sparseDiagnostics =
          generationMode === "mixed"
            ? computeSparseIssues(articlePack.article)
            : { betweenWordIssues: [], leadIssue: null, tailIssue: null };
      }

      let mixedSemanticRows = [];

      if (missing.length > 0) {
        if (generationMode !== "mixed") {
          articlePack.article = appendMissingWordsSentence(articlePack.article, missing, lexicon);
          missing = findMissingWords(articlePack.article, words);
        } else {
          const missingBeforeRewrite = missing.slice();
          const rewritten = await generateMissingWordsRewrite(
            missingBeforeRewrite,
            lexicon,
            generationMode,
            quickMode,
            selectedModel
          );
          articlePack.article = `${String(articlePack.article || "").trim()}\n\n${rewritten}`.trim();
          if (Array.isArray(articlePack?.chunks) && articlePack.chunks.length > 0) {
            const lastChunkIndex = articlePack.chunks.length - 1;
            const prev = String(articlePack.chunks[lastChunkIndex]?.article || "").trim();
            articlePack.chunks[lastChunkIndex] = {
              ...articlePack.chunks[lastChunkIndex],
              article: `${prev}\n\n${rewritten}`.trim()
            };
          }
          articlePack.article = normalizeMixedArticleStyle(articlePack.article, words, lexicon);
          missing = findMissingWords(articlePack.article, words);
          overused = findOverusedWords(articlePack.article, words, 2);
          sparseDiagnostics = computeSparseIssues(articlePack.article);

          if (missing.length > 0) {
            const fallbackRewrite = buildMissingRewriteFallback(missing, lexicon, generationMode);
            articlePack.article = `${String(articlePack.article || "").trim()}\n${fallbackRewrite}`.trim();
            if (Array.isArray(articlePack?.chunks) && articlePack.chunks.length > 0) {
              const lastChunkIndex = articlePack.chunks.length - 1;
              const prev = String(articlePack.chunks[lastChunkIndex]?.article || "").trim();
              articlePack.chunks[lastChunkIndex] = {
                ...articlePack.chunks[lastChunkIndex],
                article: `${prev}\n${fallbackRewrite}`.trim()
              };
            }
            articlePack.article = normalizeMixedArticleStyle(articlePack.article, words, lexicon);
            missing = findMissingWords(articlePack.article, words);
            overused = findOverusedWords(articlePack.article, words, 2);
            sparseDiagnostics = computeSparseIssues(articlePack.article);
          }
        }
      }

      const contextGlossesBeforeRefine =
        generationMode === "mixed" ? buildContextGlosses(words, baseLexiconRaw, lexicon, mixedUsagePlan, []) : [];
      if (generationMode === "mixed" && shouldRunContextRefine(words, lexicon, generationMode, generationQuality, contextGlossesBeforeRefine)) {
        lexicon = await refineMixedLexiconByContext(words, lexicon, articlePack.article, quickMode, selectedModel);
        articlePack.article = normalizeMixedArticleStyle(articlePack.article, words, lexicon);
        missing = findMissingWords(articlePack.article, words);
        overused = findOverusedWords(articlePack.article, words, 2);
        sparseDiagnostics = computeSparseIssues(articlePack.article);
      }

      if (
        generationMode === "mixed" &&
        generationQuality === "advanced" &&
        missing.length === 0 &&
        overused.length === 0 &&
        sparseDiagnostics.betweenWordIssues.length === 0 &&
        sparseDiagnostics.leadIssue === null &&
        sparseDiagnostics.tailIssue === null &&
        !articlePack?.hasDeterministicChunkAppend
      ) {
        mixedSemanticRows = await reviewMixedSemantics(words, lexicon, articlePack.article, quickMode, selectedModel);
        const awkwardRows = mixedSemanticRows.filter((row) => !row?.natural || !row?.meaningOk);
        if (awkwardRows.length > 0) {
          articlePack.article = await rewriteAwkwardMixedClauses(
            articlePack.article,
            awkwardRows,
            lexicon,
            quickMode,
            selectedModel
          );
          articlePack.article = normalizeMixedArticleStyle(articlePack.article, words, lexicon);
          missing = findMissingWords(articlePack.article, words);
          overused = findOverusedWords(articlePack.article, words, 2);
          sparseDiagnostics = computeSparseIssues(articlePack.article);
        }
      }

      if (generationMode === "mixed") {
        articlePack.article = normalizeMixedArticleStyle(articlePack.article, words, lexicon);
      }
      articlePack.article = enforceWordMarkers(articlePack.article, lexicon);
      missing = findMissingWords(articlePack.article, words);
      overused = generationMode === "mixed" ? findOverusedWords(articlePack.article, words, 2) : [];
      sparseDiagnostics =
        generationMode === "mixed"
          ? computeSparseIssues(articlePack.article)
          : { betweenWordIssues: [], leadIssue: null, tailIssue: null };

      if (generationMode === "mixed" && sparseDiagnostics.leadIssue !== null) {
        if (Array.isArray(articlePack?.chunks) && articlePack.chunks.length > 0) {
          articlePack = await regenerateMixedChunks(
            articlePack,
            [0],
            [
              "Lead gap hard fix.",
              "The passage must start with a target word in the first sentence.",
              "Before the first target word, allow at most 8 Chinese characters.",
              "No Chinese-only intro."
            ].join(" "),
            true
          );
          articlePack.article = normalizeMixedArticleStyle(articlePack.article, words, lexicon);
          articlePack.article = enforceWordMarkers(articlePack.article, lexicon);
          missing = findMissingWords(articlePack.article, words);
          overused = findOverusedWords(articlePack.article, words, 2);
          sparseDiagnostics = computeSparseIssues(articlePack.article);
        }

        if (sparseDiagnostics.leadIssue !== null) {
          const fallbackWords =
            Array.isArray(articlePack?.chunks?.[0]?.words) && articlePack.chunks[0].words.length > 0
              ? articlePack.chunks[0].words.slice(0, 2)
              : words.slice(0, 2);
          const deterministicOpening = buildDeterministicMixedOpeningChunk(fallbackWords);
          if (deterministicOpening) {
            if (Array.isArray(articlePack?.chunks) && articlePack.chunks.length > 0) {
              const firstChunk = articlePack.chunks[0];
              articlePack.chunks[0] = {
                ...firstChunk,
                article: `${deterministicOpening}\n${String(firstChunk?.article || "").trim()}`.trim()
              };
              articlePack.article = rebuildMixedArticleFromChunks(articlePack);
            } else {
              articlePack.article = `${deterministicOpening}\n${String(articlePack.article || "").trim()}`.trim();
            }
            articlePack.article = normalizeMixedArticleStyle(articlePack.article, words, lexicon);
            articlePack.article = enforceWordMarkers(articlePack.article, lexicon);
            missing = findMissingWords(articlePack.article, words);
            overused = findOverusedWords(articlePack.article, words, 2);
            sparseDiagnostics = computeSparseIssues(articlePack.article);
          }
        }
      }

      if (generationMode === "mixed") {
        const restoreContextGlosses = buildContextGlosses(words, baseLexiconRaw, lexicon, mixedUsagePlan, []);
        const softMissingIssues = findSoftMissingByChineseSubstitution(articlePack.article, restoreContextGlosses);
        if (softMissingIssues.length > 0) {
          articlePack.article = restoreEnglishIntoChinesePhrase(articlePack.article, softMissingIssues);
          articlePack.article = enforceWordMarkers(articlePack.article, lexicon);
          missing = findMissingWords(articlePack.article, words);
        }
      }

      if (generationMode === "mixed" && missing.length > 0) {
        articlePack.article = appendGuaranteedMissingWordsMixed(articlePack.article, missing);
        if (Array.isArray(articlePack?.chunks) && articlePack.chunks.length > 0) {
          const lastChunkIndex = articlePack.chunks.length - 1;
          const prev = String(articlePack.chunks[lastChunkIndex]?.article || "").trim();
          articlePack.chunks[lastChunkIndex] = {
            ...articlePack.chunks[lastChunkIndex],
            article: appendGuaranteedMissingWordsMixed(prev, missing)
          };
          articlePack.hasDeterministicChunkAppend = true;
        }
        articlePack.article = enforceWordMarkers(articlePack.article, lexicon);
        missing = findMissingWords(articlePack.article, words);
      }

      if (generationMode === "mixed" && missing.length > 0) {
        throw new Error(
          `Still missing exact English tokens (Chinese translation does not count): ${missing.join(", ")}`
        );
      }

      const paragraphsEn = splitParagraphs(articlePack.article);
      const paragraphsZh = generationMode === "mixed" ? [] : await generateParagraphTranslations(paragraphsEn, lexicon, quickMode, selectedModel);
      const alignment =
        generationMode === "mixed" ? [] : await generateAlignment(words, lexicon, paragraphsEn, paragraphsZh, quickMode, selectedModel, generationMode);
      const baseLexicon = buildBaseLexiconForResponse(baseLexiconRaw);
      const contextGlosses =
        generationMode === "mixed" ? buildContextGlosses(words, baseLexiconRaw, lexicon, mixedUsagePlan, alignment) : [];
      const runs = generationMode === "mixed" ? buildArticleRuns(articlePack.article, words, contextGlosses) : [];
      const defaultTitle = defaultTitleByDate(words.length);

      return { lexicon, baseLexicon, contextGlosses, runs, articlePack, missing, paragraphsEn, paragraphsZh, alignment, defaultTitle };
    };

    const generated = isAdmin
      ? await modelTraceStorage.run(traceStore, generateContent)
      : await generateContent();

    const { lexicon, baseLexicon, contextGlosses, runs, articlePack, missing, paragraphsEn, paragraphsZh, alignment, defaultTitle } = generated;

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
      baseLexicon,
      contextGlosses,
      runs,
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



