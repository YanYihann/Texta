const express = require("express");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
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

function splitWords(rawText) {
  return String(rawText || "")
    .split(/[\n,;，；\s]+/)
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
    const meanings = found?.meanings?.length ? found.meanings : ["(释义生成失败，请重试)"];
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
    `Words: ${words.join(", ")}`
  ].join("\n");

  const text = await callOpenAIText(prompt, { maxTokens: quickMode ? 600 : 1200 });
  let parsed = extractJsonArray(text);

  if (!Array.isArray(parsed)) {
    const retryPrompt = [
      "Return ONLY JSON array, no markdown, no explanation.",
      "Each item keys must be exactly: word,pos,meanings,collocations,word_formation,synonyms,antonyms.",
      "Keep same order as input words.",
      `Words: ${words.join(", ")}`
    ].join("\n");
    const retryText = await callOpenAIText(retryPrompt, { maxTokens: quickMode ? 600 : 1200 });
    parsed = extractJsonArray(retryText);
  }

  let lexicon = normalizeLexicon(words, parsed);

  const failedWords = lexicon
    .filter((x) => (x?.senses || []).some((s) => String(s?.meaning || "").includes("释义生成失败")))
    .map((x) => x.word);

  if (failedWords.length > 0) {
    const fallbackPrompt = [
      "You are an IELTS vocabulary assistant.",
      "Return ONLY JSON array.",
      "For each word provide practical IELTS meanings and basic word data.",
      "Output format: {\"word\": string, \"pos\": string, \"meanings\": string[], \"collocations\": string[], \"word_formation\": string, \"synonyms\": string[], \"antonyms\": string[]}",
      "If a word is misspelled, infer the most likely intended word and still provide useful meanings for the given spelling.",
      `Words: ${failedWords.join(", ")}`
    ].join("\n");

    const fallbackText = await callOpenAIText(fallbackPrompt, { maxTokens: quickMode ? 700 : 1400 });
    const fallbackParsed = extractJsonArray(fallbackText);
    const recovered = normalizeLexicon(failedWords, fallbackParsed);
    const recoveredMap = new Map(recovered.map((x) => [x.word.toLowerCase(), x]));
    lexicon = lexicon.map((item) => recoveredMap.get(item.word.toLowerCase()) || item);
  }

  return lexicon;
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

async function generateArticlePackage(words, level, quickMode, lexicon, extraConstraint = "") {
  const promptLevel = levelToPromptText(level);
  const lengthRule = quickMode ? "Length: 120-180 words." : "Length: 220-320 words.";
  const paragraphRule = quickMode
    ? "Use 2-3 short paragraphs separated by blank lines."
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

  const text = await callOpenAIText(prompt, { maxTokens: quickMode ? 360 : 760 });
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

app.post("/api/spellcheck", async (req, res) => {
  try {
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

    if (!quickMode && missing.length > 0) {
      articlePack = await generateArticlePackage(
        words,
        level,
        quickMode,
        lexicon,
        `Important fix: ensure these missing words appear: ${missing.join(", ")}.`
      );
      articlePack.article = enforceWordMarkers(articlePack.article, lexicon);
      missing = findMissingWords(articlePack.article, words);
    }

    const paragraphsEn = splitParagraphs(articlePack.article);
    const paragraphsZh = await generateParagraphTranslations(paragraphsEn, lexicon, quickMode);
    const defaultTitle = defaultTitleByDate(words.length);

    res.json({
      title: articlePack.title || defaultTitle,
      defaultTitle,
      article: articlePack.article,
      missing,
      lexicon,
      paragraphsEn,
      paragraphsZh
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate article.", detail: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
