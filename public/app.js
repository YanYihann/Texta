const wordsInput = document.getElementById("words");
const levelSelect = document.getElementById("level");
const quickModeInput = document.getElementById("quickMode");
const generateBtn = document.getElementById("generateBtn");
const readingModeBtn = document.getElementById("readingModeBtn");
const toggleZhBtn = document.getElementById("toggleZhBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const exportWordBtn = document.getElementById("exportWordBtn");
const favoriteBtn = document.getElementById("favoriteBtn");
const exportTitleInput = document.getElementById("exportTitle");
const statusEl = document.getElementById("status");
const spellHintsEl = document.getElementById("spellHints");
const wordChipsEl = document.getElementById("wordChips");
const favoritesListEl = document.getElementById("favoritesList");
const userBadgeEl = document.getElementById("userBadge");
const logoutBtnEl = document.getElementById("logoutBtn");

const resultSection = document.getElementById("resultSection");
const glossaryPanelEl = document.getElementById("glossaryPanel");
const missingWordsEl = document.getElementById("missingWords");
const articleTitleEl = document.getElementById("articleTitle");
const articleBlocksEl = document.getElementById("articleBlocks");
const glossaryEl = document.getElementById("glossary");
const exportAreaEl = document.getElementById("exportArea");

const exportModalEl = document.getElementById("exportModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const previewTitleInput = document.getElementById("previewTitle");
const previewIncludeZhInput = document.getElementById("previewIncludeZh");
const previewMarginSelect = document.getElementById("previewMargin");
const previewPaperEl = document.getElementById("previewPaper");
const confirmExportBtn = document.getElementById("confirmExportBtn");

let latestArticle = "";
let latestWords = [];
let latestLexicon = [];
let latestParagraphsEn = [];
let latestParagraphsZh = [];
let latestAlignment = [];
let showChinese = true;
let pendingExportType = "pdf";
let readingMode = false;
let spellTimer = null;
let spellState = [];
let lastActiveGlossaryKey = "";
let pronunciationMap = new Map();
let currentFavoriteId = "";
let authToken = localStorage.getItem("texta_auth_token") || "";
let currentUser = null;
const API_BASE = String(window.TEXTA_API_BASE || "").trim().replace(/\/$/, "");
const FAVORITES_KEY = "texta_favorites_v1";
let favorites = [];

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  return fetch(apiUrl(path), { ...options, headers });
}

function setAuthToken(token) {
  authToken = String(token || "").trim();
  if (authToken) {
    localStorage.setItem("texta_auth_token", authToken);
  } else {
    localStorage.removeItem("texta_auth_token");
  }
}

async function loadMe() {
  if (!authToken) {
    return false;
  }

  try {
    const response = await apiFetch("/api/auth/me");
    if (!response.ok) {
      setAuthToken("");
      currentUser = null;
      return false;
    }
    const data = await response.json();
    currentUser = data.user || null;
    const roleText = currentUser?.role === "admin" ? "管理员" : "用户";
    userBadgeEl.textContent = `${currentUser?.name || currentUser?.email || "用户"} · ${roleText}`;
    logoutBtnEl.classList.remove("hidden");
    return Boolean(currentUser);
  } catch {
    currentUser = null;
    return false;
  }
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = JSON.parse(raw || "[]");
    favorites = Array.isArray(parsed) ? parsed : [];
  } catch {
    favorites = [];
  }
}

function saveFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites.slice(0, 50)));
}

function renderFavorites() {
  if (!favoritesListEl) return;
  if (!favorites.length) {
    favoritesListEl.innerHTML = `<div class="fav-meta">暂无收藏</div>`;
    return;
  }
  favoritesListEl.innerHTML = favorites
    .map(
      (item) => `
      <div class="fav-item" data-fav-id="${escapeHtml(item.id)}">
        <div class="fav-left">
          <div class="fav-main">${escapeHtml(item.title || "未命名文章")}</div>
          <div class="fav-meta">${escapeHtml(item.savedAt || "")}</div>
        </div>
        <div class="fav-actions">
          <button class="fav-rename" type="button" data-fav-rename="${escapeHtml(item.id)}">改标题</button>
          <button class="fav-delete" type="button" data-fav-delete="${escapeHtml(item.id)}">删除</button>
        </div>
      </div>
    `
    )
    .join("");
}

function splitWords(rawText) {
  return String(rawText || "")
    .split(/[\n,;，；\s]+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .filter((value, index, arr) => arr.findIndex((x) => x.toLowerCase() === value.toLowerCase()) === index);
}

function splitParagraphs(rawText) {
  return String(rawText || "")
    .replace(/\r/g, "")
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeRegExp(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keyifyWord(word) {
  return String(word || "").toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

function todayStamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function defaultTitleByWords(words) {
  return `Vocabulary ${todayStamp()} (${words.length} words)`;
}

function collectChineseTerms(lexicon) {
  const terms = [];
  const addTerm = (raw) => {
    const term = String(raw || "").trim();
    if (!term || term.includes("失败") || term.includes("未返回")) {
      return;
    }
    if (!terms.includes(term)) {
      terms.push(term);
    }
    if (term.length > 2 && /[的地得]$/.test(term)) {
      const stem = term.slice(0, -1).trim();
      if (stem.length >= 2 && !terms.includes(stem)) {
        terms.push(stem);
      }
    }
  };

  for (const item of lexicon || []) {
    const senses = Array.isArray(item?.senses) ? item.senses : [];
    for (const sense of senses) {
      const fullMeaning = String(sense?.meaning || "").trim();
      addTerm(fullMeaning);
      fullMeaning
        .split(/[，,；;、/\s()（）]+/)
        .map((x) => x.trim())
        .filter((x) => x && x.length >= 2)
        .forEach(addTerm);
    }
  }
  return terms;
}

function buildChineseTermKeyPairs(lexicon) {
  const termToKeys = new Map();

  const add = (termRaw, key) => {
    const term = String(termRaw || "").trim();
    if (!term || term.includes("失败") || term.includes("未返回")) {
      return;
    }
    const keys = termToKeys.get(term) || new Set();
    keys.add(key);
    termToKeys.set(term, keys);

    if (term.length > 2 && /[的地得]$/.test(term)) {
      const stem = term.slice(0, -1).trim();
      if (stem.length >= 2) {
        const stemKeys = termToKeys.get(stem) || new Set();
        stemKeys.add(key);
        termToKeys.set(stem, stemKeys);
      }
    }
  };

  for (const item of lexicon || []) {
    const key = keyifyWord(item?.word || "");
    if (!key) continue;
    const senses = Array.isArray(item?.senses) ? item.senses : [];
    for (const sense of senses) {
      const fullMeaning = String(sense?.meaning || "").trim();
      add(fullMeaning, key);
      fullMeaning
        .split(/[，,；;、/\s()（）]+/)
        .map((x) => x.trim())
        .filter((x) => x && x.length >= 2)
        .forEach((part) => add(part, key));
    }
  }

  return Array.from(termToKeys.entries())
    .map(([term, keySet]) => ({ term, keys: Array.from(keySet) }))
    .sort((a, b) => b.term.length - a.term.length);
}

function buildChineseTermKeyPairsFromAlignment(alignment, lexicon) {
  const rows = Array.isArray(alignment) ? alignment : [];
  const termToKeys = new Map();
  const lexMap = new Map((lexicon || []).map((x) => [String(x.word || "").toLowerCase(), x]));

  const add = (termRaw, key) => {
    const term = String(termRaw || "").trim();
    if (!term || term.includes("失败") || term.includes("未返回")) {
      return;
    }
    const set = termToKeys.get(term) || new Set();
    set.add(key);
    termToKeys.set(term, set);
    if (term.length > 2 && /[的地得]$/.test(term)) {
      const stem = term.slice(0, -1).trim();
      if (stem.length >= 2) {
        const stemSet = termToKeys.get(stem) || new Set();
        stemSet.add(key);
        termToKeys.set(stem, stemSet);
      }
    }
  };

  for (const row of rows) {
    const word = String(row?.word || "").trim();
    const key = keyifyWord(word);
    if (!key) continue;
    const zhTerms = Array.isArray(row?.zh_terms) ? row.zh_terms : [];
    for (const term of zhTerms) add(term, key);
    if (zhTerms.length === 0) {
      const lex = lexMap.get(word.toLowerCase());
      const senses = Array.isArray(lex?.senses) ? lex.senses : [];
      for (const s of senses) add(String(s?.meaning || "").trim(), key);
    }
  }

  const out = Array.from(termToKeys.entries())
    .map(([term, keys]) => ({ term, keys: Array.from(keys) }))
    .sort((a, b) => b.term.length - a.term.length);

  return out.length > 0 ? out : buildChineseTermKeyPairs(lexicon);
}

function normalizeZhSenseMarkers(text) {
  const markerSet = "①②③④⑤⑥⑦⑧⑨⑩";
  let out = String(text || "");

  // Normalize forms like: ①灾难性 -> 灾难性①
  out = out.replace(new RegExp(`([${markerSet}])\\s*([\\u4e00-\\u9fa5A-Za-z][\\u4e00-\\u9fa5A-Za-z-]*)`, "g"), "$2$1");
  // Normalize forms like: ① 灾难性的 -> 灾难性的①
  out = out.replace(new RegExp(`([${markerSet}])\\s+([\\u4e00-\\u9fa5A-Za-z][^，。；：、,.!?！？\\s]{1,18})`, "g"), "$2$1");

  return out;
}

function renderSenseSuperscript(html) {
  return String(html || "").replace(/([①②③④⑤⑥⑦⑧⑨⑩])/g, '<sup class="sense-marker">$1</sup>');
}

function buildWordRegex(word) {
  const lower = String(word || "").toLowerCase();
  const forms = new Set();
  forms.add(escapeRegExp(lower));

  const addForm = (v) => {
    const value = String(v || "").trim();
    if (!value) return;
    forms.add(escapeRegExp(value));
  };

  // Common inflections and derivations
  addForm(`${lower}s`);
  addForm(`${lower}es`);
  addForm(`${lower}ed`);
  addForm(`${lower}ing`);
  addForm(`${lower}age`);
  addForm(`${lower}ages`);
  addForm(`${lower}al`);
  addForm(`${lower}ally`);
  addForm(`${lower}ment`);
  addForm(`${lower}ments`);
  addForm(`${lower}tion`);
  addForm(`${lower}tions`);
  addForm(`${lower}er`);
  addForm(`${lower}ers`);
  addForm(`${lower}ly`);
  addForm(`${lower}ness`);
  addForm(`${lower}y`);
  addForm(`${lower}ies`);

  // Example: literate -> literacy, numerate -> numeracy
  if (lower.endsWith("ate") && lower.length > 4) {
    const stem = lower.slice(0, -3);
    addForm(`${stem}acy`);
    addForm(`${stem}acies`);
    addForm(`${stem}ation`);
    addForm(`${stem}ations`);
  }

  // Example: create -> creation, active -> activity
  if (lower.endsWith("e") && lower.length > 3) {
    const stem = lower.slice(0, -1);
    addForm(`${stem}ion`);
    addForm(`${stem}ions`);
    addForm(`${stem}ive`);
    addForm(`${stem}ivity`);
  }

  return new RegExp(`\\b(${Array.from(forms).join("|")})\\b`, "gi");
}

function resolveWordKeyByToken(token, words) {
  const t = String(token || "").toLowerCase();
  if (!t) return "";
  for (const w of words || []) {
    const key = keyifyWord(w);
    const regex = buildWordRegex(w);
    const exact = new RegExp(`^(?:${regex.source.replace(/^\\b\(/, "").replace(/\)\\b$/, "")})$`, "i");
    if (exact.test(t)) {
      return key;
    }
  }
  return "";
}

function highlightText(text, terms, className, withBoundary) {
  let html = escapeHtml(text);
  const safeTerms = (terms || []).filter(Boolean).sort((a, b) => b.length - a.length);

  for (const term of safeTerms) {
    const escaped = escapeRegExp(term);
    const englishWord = /^[A-Za-z]+$/.test(term);
    const regex = withBoundary && englishWord ? new RegExp(`\\b${escaped}\\b`, "gi") : new RegExp(escaped, "g");
    html = html.replace(regex, (m) => `<mark class=\"${className}\">${m}</mark>`);
  }

  return renderSenseSuperscript(html);
}

function highlightEnglishWordsWithKeys(text, words) {
  let html = escapeHtml(text);
  const sorted = [...(words || [])].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const w of sorted) {
    const key = keyifyWord(w);
    const regex = buildWordRegex(w);
    html = html.replace(regex, (m) => `<mark class=\"vocab-en\" data-word-key=\"${key}\">${m}</mark>`);
  }

  // Fallback: any English token immediately before sense marker should be highlighted.
  // Example: literacy② / drainage① / mishaps③
  html = html.replace(
    /(^|[\s(>.,;:!?'"-])([A-Za-z][A-Za-z'-]*)([①②③④⑤⑥⑦⑧⑨⑩])/g,
    (all, pre, token, marker) => {
      if (String(pre).includes("</mark")) return all;
      const matchedKey = resolveWordKeyByToken(token, words);
      const key = matchedKey || keyifyWord(token);
      return `${pre}<mark class=\"vocab-en\" data-word-key=\"${key}\">${token}</mark>${marker}`;
    }
  );

  return renderSenseSuperscript(html);
}

function highlightEnglishWithAlignment(text, words, alignment) {
  const rows = Array.isArray(alignment) ? alignment : [];
  if (rows.length === 0) {
    return highlightEnglishWordsWithKeys(text, words);
  }

  let html = escapeHtml(text);
  const formItems = [];
  for (const row of rows) {
    const key = keyifyWord(row?.word || "");
    if (!key) continue;
    const forms = Array.isArray(row?.english_forms) ? row.english_forms : [];
    const merged = [String(row?.word || ""), ...forms].map((x) => String(x || "").trim()).filter(Boolean);
    for (const form of merged) {
      formItems.push({ key, form });
    }
  }

  formItems.sort((a, b) => b.form.length - a.form.length);
  for (const item of formItems) {
    const regex = new RegExp(`\\b${escapeRegExp(item.form)}\\b`, "gi");
    html = html.replace(regex, (m) => `<mark class=\"vocab-en\" data-word-key=\"${item.key}\">${m}</mark>`);
  }

  html = html.replace(
    /(^|[\s(>.,;:!?'"-])([A-Za-z][A-Za-z'-]*)([①②③④⑤⑥⑦⑧⑨⑩])/g,
    (all, pre, token, marker) => {
      if (String(pre).includes("</mark")) return all;
      const matchedKey = resolveWordKeyByToken(token, words);
      const key = matchedKey || keyifyWord(token);
      return `${pre}<mark class=\"vocab-en\" data-word-key=\"${key}\">${token}</mark>${marker}`;
    }
  );

  return renderSenseSuperscript(html);
}

function highlightChineseWithKeys(text, termKeyPairs) {
  let html = escapeHtml(normalizeZhSenseMarkers(text));
  for (const item of termKeyPairs || []) {
    const term = String(item?.term || "");
    if (!term) continue;
    const keys = Array.isArray(item?.keys) ? item.keys.filter(Boolean) : [];
    const keysAttr = escapeHtml(keys.join(","));
    const regex = new RegExp(escapeRegExp(term), "g");
    html = html.replace(regex, (m) => `<mark class=\"vocab-zh\" data-word-keys=\"${keysAttr}\">${m}</mark>`);
  }
  return renderSenseSuperscript(html);
}

function applyChineseVisibility() {
  if (showChinese) {
    exportAreaEl.classList.remove("hide-zh");
    toggleZhBtn.textContent = "隐藏中文";
  } else {
    exportAreaEl.classList.add("hide-zh");
    toggleZhBtn.textContent = "显示中文";
  }
}

function applyReadingMode() {
  if (readingMode) {
    document.body.classList.add("reading-mode");
    readingModeBtn.textContent = "退出阅读模式";
  } else {
    document.body.classList.remove("reading-mode");
    readingModeBtn.textContent = "阅读模式";
  }
}

function renderSpelling() {
  const words = splitWords(wordsInput.value);
  if (words.length === 0) {
    spellHintsEl.classList.add("hidden");
    spellHintsEl.innerHTML = "";
    wordChipsEl.innerHTML = "";
    return;
  }

  const map = new Map(spellState.map((x) => [String(x.word || "").toLowerCase(), x]));
  wordChipsEl.innerHTML = words
    .map((w) => {
      const info = map.get(w.toLowerCase());
      const bad = info && info.ok === false;
      const cls = bad ? "chip bad" : "chip";
      const tip = bad && info.suggestion ? ` title=\"建议: ${escapeHtml(info.suggestion)}\"` : "";
      return `<span class=\"${cls}\"${tip}>${escapeHtml(w)}</span>`;
    })
    .join("");

  const badItems = words
    .map((w) => map.get(w.toLowerCase()))
    .filter((x) => x && x.ok === false && x.suggestion);

  if (badItems.length === 0) {
    spellHintsEl.classList.add("hidden");
    spellHintsEl.innerHTML = "";
    return;
  }

  spellHintsEl.classList.remove("hidden");
  spellHintsEl.innerHTML = badItems
    .map((x) => `${escapeHtml(x.word)} -> <strong>${escapeHtml(x.suggestion)}</strong>`)
    .join("<br>");
}

async function runSpellcheck() {
  if (!authToken) {
    spellState = [];
    renderSpelling();
    return;
  }

  const wordsText = wordsInput.value.trim();
  if (!wordsText) {
    spellState = [];
    renderSpelling();
    return;
  }

  try {
    const response = await apiFetch("/api/spellcheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words: wordsText })
    });
    if (response.status === 401) {
      setAuthToken("");
      currentUser = null;
      location.href = "./index.html";
      spellState = [];
      renderSpelling();
      return;
    }
    const data = await response.json();
    spellState = Array.isArray(data.items) ? data.items : [];
  } catch {
    spellState = [];
  }
  renderSpelling();
}

function scheduleSpellcheck() {
  if (spellTimer) {
    clearTimeout(spellTimer);
  }
  spellTimer = setTimeout(runSpellcheck, 350);
}

function updateGlossaryFollow(wordKeys) {
  const keys = Array.from(wordKeys || []).filter(Boolean);
  const all = glossaryEl.querySelectorAll(".glossary-item[data-word-key]");
  all.forEach((el) => el.classList.remove("active"));
  if (keys.length === 0) {
    return;
  }

  let target = null;
  for (const key of keys) {
    const item = glossaryEl.querySelector(`.glossary-item[data-word-key=\"${key}\"]`);
    if (item) {
      item.classList.add("active");
      if (!target) target = item;
    }
  }

  if (target && lastActiveGlossaryKey !== keys[0]) {
    lastActiveGlossaryKey = keys[0];
    target.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function jumpToGlossaryKey(key) {
  if (!key) return;
  updateGlossaryFollow([key]);
}

function speakGlossaryByKey(key) {
  speakGlossaryByKeyWithAccent(key, "us");
}

function speakGlossaryByKeyWithAccent(key, accent) {
  const word = pronunciationMap.get(key);
  if (!word) return;
  if (!("speechSynthesis" in window)) {
    statusEl.textContent = "当前浏览器不支持语音功能。";
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = accent === "uk" ? "en-GB" : "en-US";
  u.rate = 1;
  window.speechSynthesis.speak(u);
}

function renderParagraphBlocks(paragraphsEn, paragraphsZh, words, lexicon, alignment) {
  const zhTermKeyPairs = buildChineseTermKeyPairsFromAlignment(alignment, lexicon);

  articleBlocksEl.innerHTML = paragraphsEn
    .map((en, i) => {
      const zh = paragraphsZh[i] || "(该段翻译生成失败，请重试)";
      const enHtml = highlightEnglishWithAlignment(en, words, alignment).replace(/\n/g, "<br>");
      const zhHtml = highlightChineseWithKeys(zh, zhTermKeyPairs).replace(/\n/g, "<br>");

      return `
        <article class=\"para-card\" data-idx=\"${i}\" style=\"animation-delay:${Math.min(i * 40, 220)}ms\">
          <p class=\"para-en\">${enHtml}</p>
          <p class=\"para-zh\">${zhHtml}</p>
        </article>
      `;
    })
    .join("");

  applyChineseVisibility();
}

function renderGlossary(lexicon) {
  if (!Array.isArray(lexicon) || lexicon.length === 0) {
    glossaryEl.innerHTML = "<p>生成后显示词汇扩展内容。</p>";
    return;
  }

  const zhTerms = collectChineseTerms(lexicon);
  pronunciationMap = new Map();

  glossaryEl.innerHTML = lexicon
    .map((item) => {
      const word = escapeHtml(item?.word || "");
      const key = keyifyWord(item?.word || "");
      const pos = escapeHtml(item?.pos || "");
      const senses = Array.isArray(item?.senses) ? item.senses : [];
      const collocations = Array.isArray(item?.collocations) ? item.collocations : [];
      const synonyms = Array.isArray(item?.synonyms) ? item.synonyms : [];
      const antonyms = Array.isArray(item?.antonyms) ? item.antonyms : [];
      const wordFormation = String(item?.wordFormation || "");
      pronunciationMap.set(key, String(item?.word || ""));

      const senseHtml = senses
        .map((s) => {
          const marker = renderSenseSuperscript(escapeHtml(s?.marker || ""));
          const meaning = highlightText(s?.meaning || "", zhTerms, "vocab-zh", false);
          return `<div class=\"sense-line\">${marker} ${meaning}</div>`;
        })
        .join("");

      const collocationHtml = collocations.length
        ? collocations.map((c) => `<div class=\"extra-line\">• ${escapeHtml(c)}</div>`).join("")
        : "<div class=\"extra-line\">(暂无)</div>";

      const synonymHtml = synonyms.length
        ? `<div class=\"extra-line\">${escapeHtml(synonyms.join(", "))}</div>`
        : "<div class=\"extra-line\">(暂无)</div>";

      const antonymHtml = antonyms.length
        ? `<div class=\"extra-line\">${escapeHtml(antonyms.join(", "))}</div>`
        : "<div class=\"extra-line\">(暂无)</div>";

      return `
        <div class=\"glossary-item\" data-word-key=\"${key}\">
          <div class=\"glossary-head\">
            <div class=\"head-left\">
              <span class=\"glossary-word\">${word}</span>
              <span class=\"glossary-pos\">${pos}</span>
            </div>
            <div class=\"head-actions\">
              <button class=\"speak-btn\" type=\"button\" data-word-key=\"${key}\" data-accent=\"us\">美音</button>
              <button class=\"speak-btn\" type=\"button\" data-word-key=\"${key}\" data-accent=\"uk\">英音</button>
            </div>
          </div>
          ${senseHtml}
          <div class=\"extra-line\"><span class=\"extra-label\">短语搭配:</span></div>
          ${collocationHtml}
          <div class=\"extra-line\"><span class=\"extra-label\">词根词缀:</span>${escapeHtml(wordFormation || "(暂无)")}</div>
          <div class=\"extra-line\"><span class=\"extra-label\">同近义词:</span></div>
          ${synonymHtml}
          <div class=\"extra-line\"><span class=\"extra-label\">反义词:</span></div>
          ${antonymHtml}
        </div>
      `;
    })
    .join("");

  lastActiveGlossaryKey = "";
}

function safeFileName(name) {
  return String(name || "untitled").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}

function buildExportBundle(title, includeChinese) {
  const articleClone = exportAreaEl.cloneNode(true);
  const titleNode = articleClone.querySelector("#articleTitle") || articleClone.querySelector(".article-title");
  if (titleNode) {
    titleNode.textContent = title;
  }

  articleClone.querySelectorAll(".para-card").forEach((el) => {
    el.style.opacity = "1";
    el.style.transform = "none";
    el.style.animation = "none";
    el.style.background = "#ffffff";
  });

  if (!includeChinese) {
    articleClone.querySelectorAll(".para-zh").forEach((el) => el.remove());
  }

  const glossaryClone = glossaryEl.cloneNode(true);

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <h1>${escapeHtml(title)}</h1>
    <div>${articleClone.innerHTML}</div>
    <h2 style="margin-top:14px;">生词中文释义</h2>
    <div class="glossary">${glossaryClone.innerHTML}</div>
  `;

  return wrapper;
}

function makeWordFriendlyHtml(innerHtml, marginPx) {
  const normalized = String(innerHtml || "")
    .replace(/<mark class="vocab-en"[^>]*>/g, '<span class="vocab-en-inline">')
    .replace(/<mark class="vocab-zh"[^>]*>/g, '<span class="vocab-zh-inline">')
    .replaceAll("</mark>", "</span>");

  return `
  <html>
    <head>
      <meta charset=\"utf-8\" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; color:#111827; padding:${marginPx}px; }
        h1 { margin:0 0 8px; }
        h2 { margin:14px 0 8px; }
        .article-title { font-size:22px; margin:0 0 8px; }
        .para-card { border:1px solid #e5e7eb; border-radius:14px; background:#fff; padding:12px; margin:0 0 10px; }
        .para-en,.para-zh { white-space: pre-wrap; line-height: 1.72; margin:0; }
        .para-zh { margin-top:8px; padding-top:8px; border-top:1px dashed #d1d5db; }
        .glossary { border:1px solid #e5e7eb; border-radius:14px; padding:8px 10px; }
        .glossary-item { border-bottom:1px dashed #e5e7eb; padding:8px 0; }
        .glossary-item:last-child { border-bottom:none; }
        .glossary-word { font-weight:700; }
        .glossary-pos { color:#6b7280; font-size:12px; margin-left:6px; }
        .sense-marker { font-size:0.68em; vertical-align:super; line-height:0; margin-left:1px; }
        .extra-label { color:#6b7280; font-size:12px; margin-right:4px; }
        .vocab-en-inline { background:#fff3b0; border-radius:5px; padding:0 2px; }
        .vocab-zh-inline { background:#d7f8e7; border-radius:5px; padding:0 2px; }
      </style>
    </head>
    <body>
      ${normalized}
    </body>
  </html>`;
}

function renderPreviewPaper() {
  const title = String(previewTitleInput.value || "").trim();
  const includeChinese = Boolean(previewIncludeZhInput.checked);
  const marginPx = Number(previewMarginSelect.value || "12");

  const bundle = buildExportBundle(title, includeChinese);
  previewPaperEl.innerHTML = `<div style=\"padding:${marginPx}px;\">${bundle.innerHTML}</div>`;
}

function openExportPreview(type) {
  if (!latestArticle) {
    statusEl.textContent = "请先生成文章。";
    return;
  }

  pendingExportType = type;
  const baseTitle = String(exportTitleInput.value || "").trim() || articleTitleEl.textContent.trim() || defaultTitleByWords(latestWords);
  previewTitleInput.value = baseTitle;
  previewIncludeZhInput.checked = showChinese;
  previewMarginSelect.value = "12";
  renderPreviewPaper();

  exportModalEl.classList.remove("hidden");
  exportModalEl.setAttribute("aria-hidden", "false");
  confirmExportBtn.textContent = type === "pdf" ? "确认导出 PDF" : "确认导出 Word";
}

function closeExportPreview() {
  exportModalEl.classList.add("hidden");
  exportModalEl.setAttribute("aria-hidden", "true");
}

function downloadBlob(filename, content, mimeType) {
  const file = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ensurePreviewTitle() {
  const title = String(previewTitleInput.value || "").trim();
  if (!title) {
    statusEl.textContent = "请先填写标题。";
    previewTitleInput.focus();
    return "";
  }
  return title;
}

function exportWordFromPreview() {
  const title = ensurePreviewTitle();
  if (!title) {
    return;
  }

  const marginPx = Number(previewMarginSelect.value || "12");
  const content = makeWordFriendlyHtml(previewPaperEl.innerHTML, marginPx);
  downloadBlob(`${safeFileName(title)}.doc`, content, "application/msword;charset=utf-8");

  exportTitleInput.value = title;
  statusEl.textContent = "Word 已导出。";
  closeExportPreview();
}

async function exportPdfFromPreview() {
  const title = ensurePreviewTitle();
  if (!title) {
    return;
  }

  if (typeof window.html2pdf !== "function") {
    statusEl.textContent = "PDF 库加载失败，请刷新后重试。";
    return;
  }

  const margin = Number(previewMarginSelect.value || "12");

  await window
    .html2pdf()
    .set({
      margin: [margin, margin, margin, margin],
      filename: `${safeFileName(title)}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    })
    .from(previewPaperEl)
    .save();

  exportTitleInput.value = title;
  statusEl.textContent = "PDF 已导出。";
  closeExportPreview();
}

function applyArticleData(data) {
  latestArticle = String(data.article || "");
  latestWords = Array.isArray(data.words) ? data.words : latestWords;
  latestLexicon = Array.isArray(data.lexicon) ? data.lexicon : [];
  latestParagraphsEn = Array.isArray(data.paragraphsEn) && data.paragraphsEn.length > 0 ? data.paragraphsEn : splitParagraphs(latestArticle);
  latestParagraphsZh = Array.isArray(data.paragraphsZh) ? data.paragraphsZh : [];
  latestAlignment = Array.isArray(data.alignment) ? data.alignment : [];
  currentFavoriteId = String(data.id || "").trim();

  const finalTitle = String(data.title || "").trim() || defaultTitleByWords(latestWords);
  articleTitleEl.textContent = finalTitle;
  exportTitleInput.value = finalTitle || String(data.defaultTitle || defaultTitleByWords(latestWords));

  renderParagraphBlocks(latestParagraphsEn, latestParagraphsZh, latestWords, latestLexicon, latestAlignment);
  renderGlossary(latestLexicon);

  if (Array.isArray(data.missing) && data.missing.length > 0) {
    missingWordsEl.textContent = `提示：仍有 ${data.missing.length} 个词未命中：${data.missing.join(", ")}`;
  } else {
    missingWordsEl.textContent = "";
  }

  showChinese = true;
  applyChineseVisibility();
  resultSection.classList.remove("hidden");
  glossaryPanelEl.classList.remove("hidden");
  exportPdfBtn.disabled = false;
  exportWordBtn.disabled = false;
}

function renameFavoriteById(id) {
  const index = favorites.findIndex((x) => x.id === id);
  if (index < 0) return;
  const oldTitle = String(favorites[index].title || "").trim() || "未命名文章";
  const nextTitleRaw = window.prompt("请输入新的收藏标题：", oldTitle);
  if (nextTitleRaw === null) return;
  const nextTitle = String(nextTitleRaw).trim();
  if (!nextTitle) {
    statusEl.textContent = "标题不能为空。";
    return;
  }

  favorites[index].title = nextTitle;
  saveFavorites();
  renderFavorites();

  if (currentFavoriteId && currentFavoriteId === id) {
    articleTitleEl.textContent = nextTitle;
    exportTitleInput.value = nextTitle;
  }
  statusEl.textContent = "收藏标题已更新。";
}

function favoriteFromCurrent() {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: articleTitleEl.textContent || defaultTitleByWords(latestWords),
    savedAt: new Date().toLocaleString(),
    words: latestWords,
    article: latestArticle,
    lexicon: latestLexicon,
    paragraphsEn: latestParagraphsEn,
    paragraphsZh: latestParagraphsZh,
    alignment: latestAlignment,
    missing: []
  };
}

generateBtn.addEventListener("click", async () => {
  const wordsText = wordsInput.value.trim();
  const level = levelSelect.value;
  const quickMode = Boolean(quickModeInput.checked);

  if (!wordsText) {
    statusEl.textContent = "请先输入单词。";
    return;
  }

  generateBtn.disabled = true;
  exportPdfBtn.disabled = true;
  exportWordBtn.disabled = true;
  resultSection.classList.add("hidden");
  glossaryPanelEl.classList.add("hidden");
  missingWordsEl.textContent = "";
  statusEl.textContent = quickMode ? "快速模式生成中（更省钱）..." : "AI 正在生成双语文章，请稍等...";

  try {
    latestWords = splitWords(wordsText);
    exportTitleInput.value = defaultTitleByWords(latestWords);
    if (!API_BASE && location.hostname.includes("github.io")) {
      throw new Error("GitHub Pages 仅托管前端。请先在 public/site-config.js 配置后端 API 地址（TEXTA_API_BASE）。");
    }

    const response = await apiFetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words: wordsText, level, quickMode })
    });

    const data = await response.json();
    if (response.status === 401) {
      setAuthToken("");
      currentUser = null;
      location.href = "./index.html";
      throw new Error("登录已过期，请重新登录。");
    }
    if (!response.ok) {
      throw new Error(data.error || "请求失败");
    }

    applyArticleData({ ...data, words: latestWords });
    statusEl.textContent = "生成完成。";
  } catch (error) {
    statusEl.textContent = `生成失败：${error.message}`;
  } finally {
    generateBtn.disabled = false;
  }
});

wordsInput.addEventListener("input", scheduleSpellcheck);

articleBlocksEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const mark = target.closest("mark.vocab-en[data-word-key]");
  if (mark) {
    const key = mark.getAttribute("data-word-key");
    jumpToGlossaryKey(key || "");
    return;
  }

  const zhMark = target.closest("mark.vocab-zh[data-word-keys]");
  if (!zhMark) return;
  const keys = String(zhMark.getAttribute("data-word-keys") || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (keys.length > 0) {
    jumpToGlossaryKey(keys[0]);
  }
});

glossaryEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const btn = target.closest(".speak-btn[data-word-key]");
  if (!btn) return;
  const key = btn.getAttribute("data-word-key");
  const accent = btn.getAttribute("data-accent") || "us";
  speakGlossaryByKeyWithAccent(key || "", accent);
});

readingModeBtn.addEventListener("click", () => {
  readingMode = !readingMode;
  applyReadingMode();
});

toggleZhBtn.addEventListener("click", () => {
  showChinese = !showChinese;
  applyChineseVisibility();
});

exportPdfBtn.addEventListener("click", () => openExportPreview("pdf"));
exportWordBtn.addEventListener("click", () => openExportPreview("word"));
closeModalBtn.addEventListener("click", closeExportPreview);

favoriteBtn.addEventListener("click", () => {
  if (!latestArticle) {
    statusEl.textContent = "请先生成文章再收藏。";
    return;
  }
  const item = favoriteFromCurrent();
  favorites.unshift(item);
  saveFavorites();
  renderFavorites();
  statusEl.textContent = "已加入收藏夹。";
});

favoritesListEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const rename = target.closest(".fav-rename[data-fav-rename]");
  if (rename) {
    const renameId = rename.getAttribute("data-fav-rename");
    renameFavoriteById(renameId || "");
    return;
  }
  const del = target.closest(".fav-delete[data-fav-delete]");
  if (del) {
    const delId = del.getAttribute("data-fav-delete");
    favorites = favorites.filter((x) => x.id !== delId);
    saveFavorites();
    renderFavorites();
    statusEl.textContent = "已从收藏夹删除。";
    return;
  }
  const itemEl = target.closest(".fav-item[data-fav-id]");
  if (!itemEl) return;
  const id = itemEl.getAttribute("data-fav-id");
  const found = favorites.find((x) => x.id === id);
  if (!found) return;

  latestWords = Array.isArray(found.words) ? found.words : [];
  wordsInput.value = latestWords.join(", ");
  applyArticleData(found);
  statusEl.textContent = "已从收藏夹打开文章。";
});

previewTitleInput.addEventListener("input", renderPreviewPaper);
previewIncludeZhInput.addEventListener("change", renderPreviewPaper);
previewMarginSelect.addEventListener("change", renderPreviewPaper);

confirmExportBtn.addEventListener("click", async () => {
  if (pendingExportType === "word") {
    exportWordFromPreview();
    return;
  }
  await exportPdfFromPreview();
});

logoutBtnEl.addEventListener("click", async () => {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Ignore network error on logout.
  }
  setAuthToken("");
  currentUser = null;
  location.href = "./index.html";
});

async function init() {
  const ok = await loadMe();
  if (!ok) {
    location.href = "./index.html";
    return;
  }
  loadFavorites();
  renderFavorites();
  renderSpelling();
  applyReadingMode();
}

init();

