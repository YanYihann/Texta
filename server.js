const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
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

  await prisma.$transaction(async (tx) => {
    for (const user of users) {
      await tx.user.upsert({
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

    await tx.session.deleteMany({});
    if (sessions.length > 0) {
      await tx.session.createMany({
        data: sessions.map((s) => ({
          token: String(s.token),
          userId: String(s.userId),
          expiresAt: BigInt(Number(s.expiresAt || 0)),
          createdAt: BigInt(Number(s.createdAt || Date.now()))
        }))
      });
    }

    await tx.usageDaily.deleteMany({});
    if (usageRows.length > 0) {
      await tx.usageDaily.createMany({ data: usageRows });
    }

    await tx.vipRequest.deleteMany({});
    if (vipRequests.length > 0) {
      await tx.vipRequest.createMany({
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
  });
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

function getShanghaiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(date);
}

function getDailyLimit(user) {
  if (String(user?.role || "").toLowerCase() === "admin") {
    return Number.POSITIVE_INFINITY;
  }
  const plan = String(user?.plan || "free").toLowerCase();
  return plan === "vip" ? 50 : 10;
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

function bumpUsage(store, user, dateKey = getShanghaiDateKey()) {
  if (!store.usageDaily || typeof store.usageDaily !== "object") {
    store.usageDaily = {};
  }
  if (!store.usageDaily[user.id] || typeof store.usageDaily[user.id] !== "object") {
    store.usageDaily[user.id] = {};
  }
  store.usageDaily[user.id][dateKey] = Number(store.usageDaily[user.id][dateKey] || 0) + 1;
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

      const pos = typeof item.pos === "string" ? item.pos.trim() : "";
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
    const pos = found?.pos || "";
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

  for (let attempt = 1; attempt <= OPENAI_RETRY_COUNT + 1; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

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
                model: OPENAI_MODEL,
                messages: [{ role: "user", content: prompt }],
                ...(maxTokens ? { max_tokens: maxTokens } : {})
              }
            : {
                model: OPENAI_MODEL,
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
      return text;
    } catch (error) {
      const isTimeout = error?.name === "AbortError";
      const retryable = isTimeout || isRetryableNetworkError(error);
      const hasNext = attempt <= OPENAI_RETRY_COUNT;

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

async function generateLexicon(words, quickMode) {
  const generateLexiconChunk = async (chunkWords) => {
    const prompt = [
      "You are an IELTS vocabulary assistant.",
      "Return ONLY JSON array.",
      "Each item format:",
      "{\"word\": string, \"pos\": string, \"meanings\": string[], \"collocations\": string[], \"word_formation\": string, \"synonyms\": string[], \"antonyms\": string[]}",
      "Rules:",
      "1) Keep same order as input words.",
      "2) pos should be concise (e.g. n., v., adj., adv.).",
      "3) meanings should be concise Chinese meanings, 1-3 items.",
      "4) Prefer IELTS high-frequency exam meanings, avoid rare/archaic niche senses.",
      "5) Prioritize meanings useful for reading/listening/writing tasks.",
      "6) collocations should be common IELTS-friendly phrase combinations (English phrase + concise Chinese).",
      "7) word_formation should include root/prefix/suffix notes when useful.",
      "8) synonyms/antonyms should be common high-frequency exam words.",
      `Words: ${chunkWords.join(", ")}`
    ].join("\n");

    const text = await callOpenAIText(prompt, { maxTokens: quickMode ? 650 : 1300 });
    let parsed = extractJsonArray(text);

    if (!Array.isArray(parsed)) {
      const retryPrompt = [
        "Return ONLY JSON array, no markdown, no explanation.",
        "Each item keys must be exactly: word,pos,meanings,collocations,word_formation,synonyms,antonyms.",
        "Keep same order as input words.",
        `Words: ${chunkWords.join(", ")}`
      ].join("\n");
      const retryText = await callOpenAIText(retryPrompt, { maxTokens: quickMode ? 650 : 1300 });
      parsed = extractJsonArray(retryText);
    }

    return normalizeLexicon(chunkWords, parsed);
  };

  const chunks = chunkArray(words, words.length > 12 ? 8 : words.length);
  let lexicon = [];
  for (const chunk of chunks) {
    const part = await generateLexiconChunk(chunk);
    lexicon = lexicon.concat(part);
  }

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
        "If a word is misspelled, infer the most likely intended word and still provide useful meanings for the given spelling.",
        `Words: ${c.join(", ")}`
      ].join("\n");
      const fallbackText = await callOpenAIText(fallbackPrompt, { maxTokens: quickMode ? 700 : 1400 });
      const fallbackParsed = extractJsonArray(fallbackText);
      recoveredAll = recoveredAll.concat(normalizeLexicon(c, fallbackParsed));
    }
    const recoveredMap = new Map(recoveredAll.map((x) => [x.word.toLowerCase(), x]));
    lexicon = lexicon.map((item) => recoveredMap.get(item.word.toLowerCase()) || item);
  }

  return lexicon;
}

async function generateArticlePackage(words, level, quickMode, lexicon, extraConstraint = "") {
  const promptLevel = levelToPromptText(level);
  const lengthRule = quickMode ? "Length: 120-180 words." : words.length > 16 ? "Length: 320-450 words." : "Length: 220-320 words.";
  const paragraphRule = quickMode
    ? "Use 2-3 short paragraphs separated by blank lines."
    : words.length > 16
      ? "Use 4-5 paragraphs separated by blank lines."
      : "Use 3-4 paragraphs separated by blank lines.";

  const vocabGuide = lexicon
    .map((item) => {
      const sensesText = item.senses.map((s) => `${s.marker} ${s.meaning}`).join("; ");
      return `${item.word} (${item.pos || "-"}): ${sensesText}`;
    })
    .join("\n");

  const prompt = [
    "Write an English IELTS-style article and return ONLY JSON object:",
    '{"title":"...", "article":"..."}',
    `Level: ${promptLevel}.`,
    lengthRule,
    paragraphRule,
    "Article must be plain text paragraphs separated by blank lines.",
    "Every target word must appear at least once.",
    "If a word has multiple senses in the guide, try to use at least 2 different senses across the article when natural.",
    "Whenever a target word appears, append one marker immediately after it, like drain①.",
    "Choose marker based on intended meaning from the guide.",
    "Make title concise and natural.",
    "Vocabulary guide:",
    vocabGuide,
    extraConstraint
  ]
    .filter(Boolean)
    .join("\n");

  const maxTokens = quickMode ? 420 : words.length > 16 ? 1200 : 820;
  const text = await callOpenAIText(prompt, { maxTokens });
  const parsed = extractJsonObject(text);

  if (parsed && typeof parsed.title === "string" && typeof parsed.article === "string") {
    return {
      title: parsed.title.trim() || defaultTitleByDate(words.length),
      article: parsed.article.trim()
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

async function generateParagraphTranslations(paragraphs, lexicon, quickMode) {
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

  const text = await callOpenAIText(prompt, { maxTokens: quickMode ? 520 : 980 });
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
    output.push({
      word: lex?.word || word,
      marker: String(item?.marker || lex?.senses?.[0]?.marker || "①"),
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
    output.push({
      word: String(w || ""),
      marker: String(lex?.senses?.[0]?.marker || "①"),
      zh_terms: fallbackZh.slice(0, 10),
      english_forms: inferredForms.length > 0 ? inferredForms : appearsInEn(String(w || "")) ? [String(w || "")] : []
    });
  }

  return output;
}

async function generateAlignment(words, lexicon, paragraphsEn, paragraphsZh, quickMode) {
  if (!Array.isArray(words) || words.length === 0) {
    return [];
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
    const text = await callOpenAIText(prompt, { maxTokens: quickMode ? 680 : 1200 });
    const parsedObj = extractJsonObject(text);
    if (parsedObj) {
      return normalizeAlignment(words, lexicon, parsedObj, paragraphsEn, paragraphsZh);
    }
    const parsedArr = extractJsonArray(text);
    return normalizeAlignment(words, lexicon, parsedArr, paragraphsEn, paragraphsZh);
  } catch {
    return normalizeAlignment(words, lexicon, [], paragraphsEn, paragraphsZh);
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
    if (!usageBefore.isUnlimited && usageBefore.remaining <= 0) {
      return res.status(429).json({
        error: "Daily limit reached. Upgrade to VIP for 50 uses/day.",
        usage: usageBefore
      });
    }
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY in .env" });
    }

    const rawWords = String(req.body.words || "");
    const level = String(req.body.level || "中级");
    const quickMode = Boolean(req.body.quickMode);
    const words = splitWords(rawWords);

    if (words.length === 0) {
      return res.status(400).json({ error: "Please provide at least one word." });
    }

    if (words.length > 120) {
      return res.status(400).json({ error: "Too many words. Please keep it under 120 words." });
    }

    const lexicon = await generateLexicon(words, quickMode);
    let articlePack = await generateArticlePackage(words, level, quickMode, lexicon);
    articlePack.article = enforceWordMarkers(articlePack.article, lexicon);
    let missing = findMissingWords(articlePack.article, words);

    const retryCount = quickMode ? 1 : 2;
    for (let i = 0; i < retryCount && missing.length > 0; i += 1) {
      articlePack = await generateArticlePackage(
        words,
        level,
        quickMode,
        lexicon,
        [
          `Important fix (round ${i + 1}): ensure ALL missing words appear naturally.`,
          `Missing words: ${missing.join(", ")}.`,
          "You can add one concise final paragraph to include any remaining words."
        ].join(" ")
      );
      articlePack.article = enforceWordMarkers(articlePack.article, lexicon);
      missing = findMissingWords(articlePack.article, words);
    }

    if (missing.length > 0) {
      articlePack.article = appendMissingWordsSentence(articlePack.article, missing, lexicon);
      articlePack.article = enforceWordMarkers(articlePack.article, lexicon);
      missing = findMissingWords(articlePack.article, words);
    }

    const paragraphsEn = splitParagraphs(articlePack.article);
    const paragraphsZh = await generateParagraphTranslations(paragraphsEn, lexicon, quickMode);
    const alignment = await generateAlignment(words, lexicon, paragraphsEn, paragraphsZh, quickMode);
    const defaultTitle = defaultTitleByDate(words.length);

    const storeAfter = await readAuthStore();
    bumpUsage(storeAfter, authedUser);
    await writeAuthStore(storeAfter);
    const usage = getUsageSnapshot(storeAfter, authedUser);

    res.json({
      title: articlePack.title || defaultTitle,
      defaultTitle,
      article: articlePack.article,
      missing,
      lexicon,
      paragraphsEn,
      paragraphsZh,
      alignment,
      usage
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



