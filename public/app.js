const wordsInput = document.getElementById("words");
const levelSelect = document.getElementById("level");
const generationModeSelect = document.getElementById("generationMode");
const generationQualitySelect = document.getElementById("generationQuality");
const quickModeInput = document.getElementById("quickMode");
const wordFileInput = document.getElementById("wordFileInput");
const uploadWordsBtn = document.getElementById("uploadWordsBtn");
const clearWordsBtn = document.getElementById("clearWordsBtn");
const openGuideBtn = document.getElementById("openGuideBtn");
const fileImportHintEl = document.getElementById("fileImportHint");
const generateBtn = document.getElementById("generateBtn");
const readingModeBtn = document.getElementById("readingModeBtn");
const toggleZhBtn = document.getElementById("toggleZhBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const exportWordBtn = document.getElementById("exportWordBtn");
const favoriteBtn = document.getElementById("favoriteBtn");
const exportTitleInput = document.getElementById("exportTitle");
const fontSizeSelectEl = document.getElementById("fontSizeSelect");
const libraryFavoritesBtnEl = document.getElementById("libraryFavoritesBtn");
const libraryNotebookBtnEl = document.getElementById("libraryNotebookBtn");
const addUnknownToNotebookBtnEl = document.getElementById("addUnknownToNotebookBtn");
const statusEl = document.getElementById("status");
const spellHintsEl = document.getElementById("spellHints");
const wordChipsEl = document.getElementById("wordChips");
const favoritesListEl = document.getElementById("favoritesList");
const userBadgeEl = document.getElementById("userBadge");
const logoutBtnEl = document.getElementById("logoutBtn");
const usageTextEl = document.getElementById("usageText");
const upgradeVipBtnEl = document.getElementById("upgradeVipBtn");
const adminReviewLinkEl = document.getElementById("adminReviewLink");
const adminUsageLinkEl = document.getElementById("adminUsageLink");
const inputPanelEl = document.querySelector(".input-panel");
const userRowEl = document.querySelector(".user-row");
const guideCardEl = document.querySelector(".guide-card");
const mobileBottomNavEl = document.getElementById("mobileBottomNav");
const mobileNavBtnEls = Array.from(document.querySelectorAll(".mobile-nav-btn"));

const resultSection = document.getElementById("resultSection");
const articleViewEl = document.getElementById("articleView");
const notebookViewEl = document.getElementById("notebookView");
const notebookEntriesEl = document.getElementById("notebookEntries");
const notebookCountEl = document.getElementById("notebookCount");
const notebookSearchInputEl = document.getElementById("notebookSearchInput");
const notebookPosFilterEl = document.getElementById("notebookPosFilter");
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
const guideModalEl = document.getElementById("guideModal");
const closeGuideBtnEl = document.getElementById("closeGuideBtn");
const closeGuideFooterBtnEl = document.getElementById("closeGuideFooterBtn");
const guideDontShowEl = document.getElementById("guideDontShow");

let latestArticle = "";
let latestWords = [];
let latestLexicon = [];
let latestParagraphsEn = [];
let latestParagraphsZh = [];
let latestAlignment = [];
let latestUsage = null;
let latestGenerationMode = "standard";
let latestGenerationQuality = "normal";
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
let currentMobilePage = "home";
let currentFontSize = localStorage.getItem("texta_font_size") || "small";
let currentLibraryMode = localStorage.getItem("texta_library_mode") || "favorites";
let currentNotebookFocusKey = "";
let notebookSearchTerm = "";
let notebookPosFilter = "all";
const API_BASE = String(window.TEXTA_API_BASE || "").trim().replace(/\/$/, "");
const FAVORITES_KEY = "texta_favorites_v1";
const VOCAB_PREFS_KEY = "texta_vocab_prefs_v1";
const NOTEBOOK_KEY = "texta_notebook_v1";
const GUIDE_FORCE_OPEN_KEY = "texta_guide_force_open";
let favorites = [];
let vocabPrefs = {};
let notebookEntries = [];
let librarySyncTimer = null;
let librarySyncInFlight = false;
let librarySyncPending = false;
let librarySyncPaused = false;
const LIBRARY_SYNC_DELAY_MS = 800;

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 860px)").matches;
}

function actionIconSvg(name) {
  const icons = {
    book: `
      <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6.5 5.5h9.25a2.75 2.75 0 0 1 2.75 2.75V18.5H9.25A2.75 2.75 0 0 0 6.5 21.25V5.5Z" />
        <path d="M6.5 5.5h-.25A2.25 2.25 0 0 0 4 7.75v9.5a2.25 2.25 0 0 0 2.25 2.25h.25" />
        <path d="M9.5 8.5h6" />
      </svg>
    `,
    heart: `
      <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 20.25c-4.2-2.92-7-5.43-7-8.72A4.02 4.02 0 0 1 9.06 7.5c1.19 0 2.32.52 2.94 1.5.62-.98 1.75-1.5 2.94-1.5A4.02 4.02 0 0 1 19 11.53c0 3.29-2.8 5.8-7 8.72Z" />
      </svg>
    `,
    "heart-fill": `
      <svg class="action-icon action-icon-fill" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 20.25c-4.2-2.92-7-5.43-7-8.72A4.02 4.02 0 0 1 9.06 7.5c1.19 0 2.32.52 2.94 1.5.62-.98 1.75-1.5 2.94-1.5A4.02 4.02 0 0 1 19 11.53c0 3.29-2.8 5.8-7 8.72Z" />
      </svg>
    `,
    export: `
      <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 15.5V5.75" />
        <path d="m8.75 9 3.25-3.25L15.25 9" />
        <path d="M6 13.75v3a1.75 1.75 0 0 0 1.75 1.75h8.5A1.75 1.75 0 0 0 18 16.75v-3" />
      </svg>
    `
  };

  return icons[name] || "";
}

function setButtonContent(button, html, title) {
  if (!button) return;
  button.innerHTML = html;
  button.setAttribute("aria-label", title);
  button.title = title;
}

function applyReadingFontSize() {
  const size = ["small", "medium", "large"].includes(currentFontSize) ? currentFontSize : "small";
  currentFontSize = size;
  exportAreaEl.classList.remove("font-small", "font-medium", "font-large");
  exportAreaEl.classList.add(`font-${size}`);
  if (fontSizeSelectEl) {
    fontSizeSelectEl.value = size;
  }
  localStorage.setItem("texta_font_size", size);
}

function isCurrentArticleFavorited() {
  if (!currentFavoriteId) return false;
  return favorites.some((item) => item.id === currentFavoriteId);
}

function syncActionButtonStates() {
  readingModeBtn.classList.toggle("is-active", readingMode);
  toggleZhBtn.classList.toggle("is-active", !showChinese);
  favoriteBtn.classList.toggle("is-active", isCurrentArticleFavorited());
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

function getGuideSeenKey(user = currentUser) {
  const userId = String(user?.id || "").trim();
  if (!userId) return "texta_guide_seen_guest";
  return `texta_guide_seen_${userId}`;
}

function markGuideSeen(user = currentUser) {
  const key = getGuideSeenKey(user);
  localStorage.setItem(key, "1");
}

function shouldAutoOpenGuide(user = currentUser) {
  if (localStorage.getItem(GUIDE_FORCE_OPEN_KEY) === "1") {
    return true;
  }
  const key = getGuideSeenKey(user);
  return localStorage.getItem(key) !== "1";
}

function openGuideModal(autoOpen = false) {
  if (!guideModalEl) return;
  if (guideDontShowEl) {
    guideDontShowEl.checked = true;
  }
  guideModalEl.classList.remove("hidden");
  guideModalEl.setAttribute("aria-hidden", "false");
  if (autoOpen) {
    statusEl.textContent = "欢迎使用 Texta，可先查看一次使用说明。";
  }
}

function closeGuideModal(options = {}) {
  if (!guideModalEl) return;
  const { respectCheckbox = true } = options;
  const shouldRemember = !respectCheckbox || !guideDontShowEl || guideDontShowEl.checked;
  if (shouldRemember) {
    markGuideSeen();
  }
  localStorage.removeItem(GUIDE_FORCE_OPEN_KEY);
  guideModalEl.classList.add("hidden");
  guideModalEl.setAttribute("aria-hidden", "true");
}

function mountGuideButtonNearUser() {
  if (!openGuideBtn || !userRowEl) return;

  if (guideCardEl) {
    guideCardEl.classList.add("hidden");
  }

  let actionsEl = userRowEl.querySelector(".user-row-actions");
  if (!actionsEl) {
    actionsEl = document.createElement("div");
    actionsEl.className = "user-row-actions";
    userRowEl.appendChild(actionsEl);
  }

  if (logoutBtnEl && logoutBtnEl.parentElement !== actionsEl) {
    actionsEl.appendChild(logoutBtnEl);
  }

  openGuideBtn.classList.remove("ghost-btn");
  openGuideBtn.classList.add("guide-mini-btn");
  openGuideBtn.textContent = "说明";
  openGuideBtn.setAttribute("aria-label", "使用说明");
  openGuideBtn.title = "使用说明";
  if (openGuideBtn.parentElement !== actionsEl) {
    actionsEl.insertBefore(openGuideBtn, actionsEl.firstChild);
  }
}

function renderUsage(usage, user = currentUser) {
  latestUsage = usage || null;
  if (!usageTextEl) return;
  const isAdmin = String(user?.role || "").toLowerCase() === "admin";
  const isVip = String(user?.plan || "").toLowerCase() === "vip";
  if (isAdmin || usage?.isUnlimited) {
    usageTextEl.textContent = "今日剩余次数：无限（管理员）";
  } else {
    const remaining = Number(usage?.remaining ?? 0);
    const limit = Number(usage?.limit ?? (isVip ? 50 : 10));
    const planLabel = isVip ? "VIP" : "普通";
    usageTextEl.textContent = `今日剩余次数：${remaining} / ${limit}（${planLabel}）`;
  }

  if (upgradeVipBtnEl) {
    if (isAdmin || isVip) {
      upgradeVipBtnEl.classList.add("hidden");
    } else {
      upgradeVipBtnEl.classList.remove("hidden");
    }
  }

  if (adminReviewLinkEl) {
    if (isAdmin) {
      adminReviewLinkEl.classList.remove("hidden");
    } else {
      adminReviewLinkEl.classList.add("hidden");
    }
  }

  if (adminUsageLinkEl) {
    if (isAdmin) {
      adminUsageLinkEl.classList.remove("hidden");
    } else {
      adminUsageLinkEl.classList.add("hidden");
    }
  }
}

async function refreshUsage() {
  if (!authToken) return;
  try {
    const response = await apiFetch("/api/usage");
    if (!response.ok) return;
    const data = await response.json();
    renderUsage(data.usage || null);
  } catch {
    // Ignore usage refresh errors.
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
    const isAdmin = String(currentUser?.role || "").toLowerCase() === "admin";
    const isVip = String(currentUser?.plan || "").toLowerCase() === "vip";
    const roleText = isAdmin ? "管理员" : isVip ? "VIP用户" : "普通用户";
    userBadgeEl.textContent = `${currentUser?.name || currentUser?.email || "用户"} · ${roleText}`;
    logoutBtnEl.classList.remove("hidden");
    await refreshUsage();
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
  scheduleLibrarySync();
}

function loadVocabPrefs() {
  try {
    const raw = localStorage.getItem(VOCAB_PREFS_KEY);
    const parsed = JSON.parse(raw || "{}");
    vocabPrefs = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    vocabPrefs = {};
  }
}

function saveVocabPrefs() {
  localStorage.setItem(VOCAB_PREFS_KEY, JSON.stringify(vocabPrefs));
  scheduleLibrarySync();
}

function loadNotebookEntries() {
  try {
    const raw = localStorage.getItem(NOTEBOOK_KEY);
    const parsed = JSON.parse(raw || "[]");
    notebookEntries = Array.isArray(parsed) ? parsed : [];
  } catch {
    notebookEntries = [];
  }
}

function saveNotebookEntries() {
  localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(notebookEntries.slice(0, 500)));
  scheduleLibrarySync();
}

function dedupeBy(items, pickKey) {
  const out = [];
  const seen = new Set();
  for (const item of items || []) {
    const key = pickKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function normalizeIsoDate(value, fallback = new Date().toISOString()) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString();
}

function normalizeFavorite(item) {
  const nowIso = new Date().toISOString();
  const id = String(item?.id || "").trim() || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const savedAtRaw = String(item?.savedAt || "").trim();
  const savedAt = savedAtRaw || nowIso;
  const createdAt = normalizeIsoDate(item?.createdAt || savedAtRaw, nowIso);
  const updatedAt = normalizeIsoDate(item?.updatedAt || item?.createdAt || savedAtRaw, nowIso);
  return {
    id,
    title: String(item?.title || "未命名文章"),
    savedAt,
    words: Array.isArray(item?.words) ? item.words : [],
    article: String(item?.article || ""),
    lexicon: Array.isArray(item?.lexicon) ? item.lexicon : [],
    paragraphsEn: Array.isArray(item?.paragraphsEn) ? item.paragraphsEn : [],
    paragraphsZh: Array.isArray(item?.paragraphsZh) ? item.paragraphsZh : [],
    alignment: Array.isArray(item?.alignment) ? item.alignment : [],
    missing: Array.isArray(item?.missing) ? item.missing : [],
    createdAt,
    updatedAt
  };
}

function normalizeNotebookEntry(item) {
  const nowIso = new Date().toISOString();
  const word = String(item?.word || "").trim();
  const key = String(item?.key || item?.wordKey || keyifyWord(word)).trim();
  if (!key) return null;
  return {
    id: String(item?.id || "").trim() || `nb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    key,
    word: word || key,
    pos: String(item?.pos || ""),
    senses: Array.isArray(item?.senses) ? item.senses : [],
    collocations: Array.isArray(item?.collocations) ? item.collocations : [],
    synonyms: Array.isArray(item?.synonyms) ? item.synonyms : [],
    antonyms: Array.isArray(item?.antonyms) ? item.antonyms : [],
    wordFormation: String(item?.wordFormation || ""),
    createdAt: normalizeIsoDate(item?.createdAt, nowIso),
    updatedAt: normalizeIsoDate(item?.updatedAt || item?.createdAt, nowIso)
  };
}

function normalizeVocabPrefsMap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  const nowIso = new Date().toISOString();
  for (const [key, value] of Object.entries(raw)) {
    const wordKey = String(key || "").trim();
    if (!wordKey) continue;
    const mastery = String(value?.mastery || "").toLowerCase() === "mastered" ? "mastered" : "unknown";
    out[wordKey] = {
      word: String(value?.word || ""),
      mastery,
      createdAt: normalizeIsoDate(value?.createdAt || value?.updatedAt, nowIso),
      updatedAt: normalizeIsoDate(value?.updatedAt || value?.createdAt, nowIso)
    };
  }
  return out;
}

function applyLibraryState({ favorites: incomingFavorites, notebookEntries: incomingNotebook, vocabPrefs: incomingVocabPrefs }) {
  const normalizedFavorites = dedupeBy(
    (Array.isArray(incomingFavorites) ? incomingFavorites : []).map(normalizeFavorite),
    (item) => item.id
  ).slice(0, 50);

  const normalizedNotebook = dedupeBy(
    (Array.isArray(incomingNotebook) ? incomingNotebook : [])
      .map(normalizeNotebookEntry)
      .filter(Boolean),
    (item) => item.key
  ).slice(0, 500);

  const normalizedVocab = normalizeVocabPrefsMap(incomingVocabPrefs);

  librarySyncPaused = true;
  favorites = normalizedFavorites;
  notebookEntries = normalizedNotebook;
  vocabPrefs = normalizedVocab;
  saveFavorites();
  saveNotebookEntries();
  saveVocabPrefs();
  librarySyncPaused = false;
}

function mergeByUpdatedAt(existingMap, nextMap) {
  const merged = { ...existingMap };
  for (const [key, value] of Object.entries(nextMap || {})) {
    const current = merged[key];
    if (!current) {
      merged[key] = value;
      continue;
    }
    const a = String(current.updatedAt || "");
    const b = String(value.updatedAt || "");
    if (b >= a) {
      merged[key] = value;
    }
  }
  return merged;
}

function mergeLibrary(localState, remoteState) {
  const localFavorites = (localState.favorites || []).map(normalizeFavorite);
  const remoteFavorites = (remoteState.favorites || []).map(normalizeFavorite);
  const favoriteMap = new Map();
  for (const item of remoteFavorites) favoriteMap.set(item.id, item);
  for (const item of localFavorites) {
    if (!favoriteMap.has(item.id)) favoriteMap.set(item.id, item);
  }
  const favoritesMerged = Array.from(favoriteMap.values())
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, 50);

  const localNotebook = (localState.notebookEntries || [])
    .map(normalizeNotebookEntry)
    .filter(Boolean);
  const remoteNotebook = (remoteState.notebookEntries || [])
    .map(normalizeNotebookEntry)
    .filter(Boolean);
  const notebookMap = new Map();
  for (const item of remoteNotebook) notebookMap.set(item.key, item);
  for (const item of localNotebook) {
    const existing = notebookMap.get(item.key);
    if (!existing || String(item.updatedAt || "") >= String(existing.updatedAt || "")) {
      notebookMap.set(item.key, item);
    }
  }
  const notebookMerged = Array.from(notebookMap.values())
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, 500);

  const localVocab = normalizeVocabPrefsMap(localState.vocabPrefs || {});
  const remoteVocab = normalizeVocabPrefsMap(remoteState.vocabPrefs || {});
  const vocabMerged = mergeByUpdatedAt(remoteVocab, localVocab);

  return {
    favorites: favoritesMerged,
    notebookEntries: notebookMerged,
    vocabPrefs: vocabMerged
  };
}

function librarySnapshot() {
  return {
    favorites: favorites.slice(0, 50),
    notebookEntries: notebookEntries.slice(0, 500),
    vocabPrefs
  };
}

async function syncLibraryNow() {
  if (!authToken || librarySyncPaused) return;
  if (librarySyncInFlight) {
    librarySyncPending = true;
    return;
  }
  librarySyncInFlight = true;
  try {
    const response = await apiFetch("/api/library/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(librarySnapshot())
    });
    if (!response.ok) {
      throw new Error(`library sync failed (${response.status})`);
    }
  } catch (error) {
    console.warn("Library sync failed:", error);
    if (statusEl) {
      statusEl.textContent = "云端同步暂时失败，已保存在本地，稍后会自动重试。";
    }
  } finally {
    librarySyncInFlight = false;
    if (librarySyncPending) {
      librarySyncPending = false;
      scheduleLibrarySync(true);
    }
  }
}

function scheduleLibrarySync(immediate = false) {
  if (!authToken || librarySyncPaused) return;
  if (librarySyncTimer) {
    clearTimeout(librarySyncTimer);
  }
  const delay = immediate ? 0 : LIBRARY_SYNC_DELAY_MS;
  librarySyncTimer = setTimeout(() => {
    librarySyncTimer = null;
    void syncLibraryNow();
  }, delay);
}

async function hydrateLibraryFromServer() {
  if (!authToken) return;
  const localState = {
    favorites: favorites.slice(),
    notebookEntries: notebookEntries.slice(),
    vocabPrefs: { ...vocabPrefs }
  };
  try {
    const response = await apiFetch("/api/library");
    if (!response.ok) return;
    const remote = await response.json();
    const merged = mergeLibrary(localState, {
      favorites: Array.isArray(remote?.favorites) ? remote.favorites : [],
      notebookEntries: Array.isArray(remote?.notebookEntries) ? remote.notebookEntries : [],
      vocabPrefs: remote?.vocabPrefs && typeof remote.vocabPrefs === "object" ? remote.vocabPrefs : {}
    });
    applyLibraryState(merged);
    await syncLibraryNow();
  } catch {
    // Keep local data if the server is temporarily unavailable.
  }
}

function getWordPref(wordOrKey, word = "") {
  const key = word ? keyifyWord(wordOrKey) : keyifyWord(wordOrKey || "");
  const fallbackWord = String(word || wordOrKey || "").trim();
  return {
    key,
    word: fallbackWord,
    mastery: String(vocabPrefs[key]?.mastery || "unknown"),
    updatedAt: String(vocabPrefs[key]?.updatedAt || "")
  };
}

function saveWordPref(key, patch = {}) {
  if (!key) return;
  const existing = vocabPrefs[key] || {};
  const now = new Date().toISOString();
  vocabPrefs[key] = {
    ...existing,
    ...patch,
    createdAt: String(existing.createdAt || patch.createdAt || now),
    updatedAt: now
  };
  saveVocabPrefs();
}

function removeNotebookEntry(key) {
  notebookEntries = notebookEntries.filter((item) => item.key !== key);
  saveNotebookEntries();
}

function upsertNotebookEntry(item) {
  const word = String(item?.word || "").trim();
  const key = keyifyWord(word);
  if (!key || !word) return;

  const entry = {
    key,
    word,
    pos: String(item?.pos || ""),
    senses: Array.isArray(item?.senses) ? item.senses : [],
    collocations: Array.isArray(item?.collocations) ? item.collocations : [],
    synonyms: Array.isArray(item?.synonyms) ? item.synonyms : [],
    antonyms: Array.isArray(item?.antonyms) ? item.antonyms : [],
    wordFormation: String(item?.wordFormation || ""),
    updatedAt: new Date().toISOString()
  };

  const index = notebookEntries.findIndex((row) => row.key === key);
  if (index >= 0) {
    notebookEntries[index] = { ...notebookEntries[index], ...entry };
  } else {
    notebookEntries.unshift(entry);
  }
  saveNotebookEntries();
}

function syncNotebookEntriesFromLexicon(lexicon) {
  for (const item of Array.isArray(lexicon) ? lexicon : []) {
    const key = keyifyWord(item?.word || "");
    if (!key) continue;
    if (!vocabPrefs[key]) {
      saveWordPref(key, {
        word: String(item?.word || "").trim(),
        mastery: "unknown"
      });
    }
  }
}

function isWordInNotebook(key) {
  return notebookEntries.some((item) => item.key === key);
}

function getUnknownWordsNotInNotebook() {
  return latestLexicon.filter((item) => {
    const key = keyifyWord(item?.word || "");
    if (!key) return false;
    return getWordPref(key, item?.word || "").mastery !== "mastered" && !isWordInNotebook(key);
  });
}

function syncGlossaryFooterButton() {
  if (!addUnknownToNotebookBtnEl) return;
  const hasLexicon = Array.isArray(latestLexicon) && latestLexicon.length > 0;
  const pending = getUnknownWordsNotInNotebook();
  addUnknownToNotebookBtnEl.disabled = !hasLexicon || pending.length === 0;
  addUnknownToNotebookBtnEl.textContent = pending.length > 0 ? `将陌生词添加到生词本（${pending.length}）` : "陌生词已全部加入生词本";
}

function getNotebookEntriesSorted() {
  return [...notebookEntries].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

function buildNotebookSearchText(item) {
  const senses = Array.isArray(item?.senses) ? item.senses.map((sense) => String(sense?.meaning || "").trim()) : [];
  const collocations = Array.isArray(item?.collocations) ? item.collocations : [];
  return [item?.word || "", item?.pos || "", ...senses, ...collocations].join(" ").toLowerCase();
}

function getNotebookPosOptions(rows) {
  return Array.from(
    new Set(
      rows
        .map((item) => String(item?.pos || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
}

function syncNotebookFilters(rows) {
  const posOptions = getNotebookPosOptions(rows);
  if (notebookPosFilterEl) {
    const optionsHtml = ['<option value="all">全部词性</option>']
      .concat(posOptions.map((pos) => `<option value="${escapeHtml(pos)}">${escapeHtml(pos)}</option>`))
      .join("");
    notebookPosFilterEl.innerHTML = optionsHtml;
    if (!posOptions.includes(notebookPosFilter) && notebookPosFilter !== "all") {
      notebookPosFilter = "all";
    }
    notebookPosFilterEl.value = notebookPosFilter;
  }
  if (notebookSearchInputEl) {
    notebookSearchInputEl.value = notebookSearchTerm;
  }
}

function filterNotebookRows(rows) {
  const keyword = notebookSearchTerm.trim().toLowerCase();
  return rows.filter((item) => {
    const matchKeyword = !keyword || buildNotebookSearchText(item).includes(keyword);
    const matchPos = notebookPosFilter === "all" || String(item?.pos || "").trim() === notebookPosFilter;
    return matchKeyword && matchPos;
  });
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

function renderNotebookSidebar() {
  if (!favoritesListEl) return;
  const rows = getNotebookEntriesSorted();
  if (!rows.length) {
    favoritesListEl.innerHTML = `<div class="empty-library">暂无生词，先把右侧词汇标记成“陌生”并加入生词本。</div>`;
    return;
  }

  favoritesListEl.innerHTML = rows
    .map(
      (item) => `
      <div class="fav-item notebook-item" data-notebook-key="${escapeHtml(item.key)}">
        <div class="fav-left">
          <div class="fav-main">${escapeHtml(item.word || "未命名单词")}</div>
          <div class="fav-meta">陌生词 · ${escapeHtml(formatNotebookMeta(item.updatedAt))}</div>
        </div>
        <div class="word-state-pill">生词本</div>
      </div>
    `
    )
    .join("");
}

function renderLibraryList() {
  if (currentLibraryMode === "notebook") {
    renderNotebookSidebar();
    return;
  }
  renderFavorites();
}

function splitWords(rawText) {
  return String(rawText || "")
    .split(/[\n,，]+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .filter((value, index, arr) => arr.findIndex((x) => x.toLowerCase() === value.toLowerCase()) === index);
}

function normalizeWordToken(raw) {
  return String(raw || "")
    .trim()
    .replace(/^[^A-Za-z]+/, "")
    .replace(/[^A-Za-z-]+$/g, "");
}

function extractWordsFromText(rawText) {
  const matches = String(rawText || "").match(/[A-Za-z][A-Za-z-]{1,29}/g) || [];
  const out = [];
  const seen = new Set();
  for (const raw of matches) {
    const token = normalizeWordToken(raw);
    if (!token) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(token);
    if (out.length >= 120) break;
  }
  return out;
}

function showFileImportHint(message, isError = false) {
  if (!fileImportHintEl) return;
  fileImportHintEl.textContent = String(message || "").trim();
  fileImportHintEl.classList.remove("hidden", "error");
  if (isError) {
    fileImportHintEl.classList.add("error");
  }
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取文件失败，请重试。"));
    reader.readAsText(file, "UTF-8");
  });
}

async function handleWordFileImport(file) {
  if (!file) return;
  const name = String(file.name || "");
  const lower = name.toLowerCase();
  const supported = [".txt", ".md", ".csv", ".json"];
  if (!supported.some((ext) => lower.endsWith(ext))) {
    showFileImportHint("暂仅支持 txt / md / csv / json 文件。", true);
    return;
  }

  try {
    const text = await readTextFile(file);
    const words = extractWordsFromText(text);
    if (words.length === 0) {
      showFileImportHint("未识别到英文单词，请检查文件内容。", true);
      return;
    }

    const current = splitWords(wordsInput.value);
    const merged = [...current];
    const seen = new Set(current.map((x) => x.toLowerCase()));
    for (const word of words) {
      const key = word.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(word);
      if (merged.length >= 120) break;
    }

    wordsInput.value = merged.join(", ");
    scheduleSpellcheck();
    renderSpelling();
    showFileImportHint(`已从 ${name} 识别并导入 ${Math.min(words.length, 120)} 个单词。`);
    statusEl.textContent = `文件识别完成，当前共 ${merged.length} 个单词。`;
  } catch (error) {
    showFileImportHint(error.message || "文件解析失败。", true);
  }
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

function formatNotebookMeta(value) {
  if (!value) return "最近更新未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
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
  }

  const out = Array.from(termToKeys.entries())
    .map(([term, keys]) => ({ term, keys: Array.from(keys) }))
    .sort((a, b) => b.term.length - a.term.length);

  return out;
}

function buildAlignmentWordMap(alignment) {
  const map = new Map();
  for (const row of Array.isArray(alignment) ? alignment : []) {
    const key = keyifyWord(row?.word || "");
    if (!key) continue;
    map.set(key, {
      marker: String(row?.marker || "①"),
      englishForms: Array.isArray(row?.english_forms) ? row.english_forms.map((x) => String(x || "").trim()).filter(Boolean) : [],
      zhTerms: Array.isArray(row?.zh_terms) ? row.zh_terms.map((x) => String(x || "").trim()).filter(Boolean) : []
    });
  }
  return map;
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

function normalizeSenseMarkerSpacing(text) {
  const markerSet = "①②③④⑤⑥⑦⑧⑨⑩";
  return String(text || "")
    .replace(new RegExp(`\\s*([${markerSet}])`, "g"), "$1")
    .replace(new RegExp(`([${markerSet}])\\s+`, "g"), "$1 ");
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
  const formToKey = new Map();
  for (const w of words || []) {
    const key = keyifyWord(w);
    if (!key) continue;
    formToKey.set(String(w).toLowerCase(), key);
    const regex = buildWordRegex(w);
    const source = regex.source.replace(/^\\b\(/, "").replace(/\)\\b$/, "");
    source
      .split("|")
      .map((x) => x.replace(/\\/g, ""))
      .filter(Boolean)
      .forEach((f) => formToKey.set(f.toLowerCase(), key));
  }

  const forms = Array.from(formToKey.keys()).sort((a, b) => b.length - a.length).map((f) => escapeRegExp(f));
  let normalized = normalizeSenseMarkerSpacing(String(text || "")).replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, "");
  let html = escapeHtml(normalized);
  if (forms.length > 0) {
    const combined = new RegExp(`\\b(${forms.join("|")})\\b`, "gi");
    html = html.replace(combined, (m) => {
      const key = formToKey.get(String(m).toLowerCase()) || keyifyWord(m);
      return `<mark class=\"vocab-en\" data-word-key=\"${key}\">${m}</mark>`;
    });
  }
  return renderSenseSuperscript(html);
}

function highlightEnglishWithAlignment(text, words, alignment) {
  const rows = Array.isArray(alignment) ? alignment : [];
  if (rows.length === 0) {
    return highlightEnglishWordsWithKeys(text, words);
  }

  const formToKey = new Map();
  const markerByKey = new Map();
  for (const row of rows) {
    const key = keyifyWord(row?.word || "");
    if (!key) continue;
    markerByKey.set(key, String(row?.marker || "①"));
    const forms = Array.isArray(row?.english_forms) ? row.english_forms : [];
    const merged = [String(row?.word || ""), ...forms].map((x) => String(x || "").trim()).filter(Boolean);
    for (const form of merged) {
      formToKey.set(form.toLowerCase(), key);
    }
  }

  for (const w of words || []) {
    const key = keyifyWord(w);
    if (!key || formToKey.has(String(w).toLowerCase())) continue;
    formToKey.set(String(w).toLowerCase(), key);
  }

  const forms = Array.from(formToKey.keys()).sort((a, b) => b.length - a.length).map((f) => escapeRegExp(f));
  let normalized = normalizeSenseMarkerSpacing(String(text || "")).replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, "");
  let html = escapeHtml(normalized);
  if (forms.length > 0) {
    const combined = new RegExp(`\\b(${forms.join("|")})\\b`, "gi");
    html = html.replace(combined, (m) => {
      const key = formToKey.get(String(m).toLowerCase()) || resolveWordKeyByToken(m, words) || keyifyWord(m);
      const marker = escapeHtml(markerByKey.get(key) || "①");
      return `<mark class=\"vocab-en\" data-word-key=\"${key}\">${m}<sup class=\"sense-marker\">${marker}</sup></mark>`;
    });
  }
  return html;
}

function buildMixedLexiconNoteMap(lexicon) {
  const map = new Map();
  for (const item of Array.isArray(lexicon) ? lexicon : []) {
    const key = keyifyWord(item?.word || "");
    if (!key) continue;
    const rawPos = String(item?.pos || "").trim();
    const pos = /^(n|v|adj|adv)\.?$/i.test(rawPos)
      ? rawPos.toLowerCase().endsWith(".")
        ? rawPos.toLowerCase()
        : `${rawPos.toLowerCase()}.`
      : /noun/i.test(rawPos)
        ? "n."
        : /verb/i.test(rawPos)
          ? "v."
          : /adjective/i.test(rawPos)
            ? "adj."
            : /adverb/i.test(rawPos)
              ? "adv."
              : rawPos;
    const senses = Array.isArray(item?.senses) ? item.senses : [];
    const zhMeaning =
      senses.map((s) => String(s?.meaning || "").trim()).find((text) => /[\u4e00-\u9fff]/.test(text)) ||
      "中文释义待补充";
    const note = [pos, zhMeaning].filter(Boolean).join(" ").trim();
    map.set(key, note || "中文释义待补充");
  }
  return map;
}

function highlightMixedEnglishWithNotes(text, words, alignment, lexicon) {
  const rows = Array.isArray(alignment) ? alignment : [];
  const formToKey = new Map();

  for (const row of rows) {
    const key = keyifyWord(row?.word || "");
    if (!key) continue;
    const forms = Array.isArray(row?.english_forms) ? row.english_forms : [];
    const merged = [String(row?.word || ""), ...forms].map((x) => String(x || "").trim()).filter(Boolean);
    for (const form of merged) {
      formToKey.set(form.toLowerCase(), key);
    }
  }

  for (const w of words || []) {
    const key = keyifyWord(w);
    if (!key || formToKey.has(String(w).toLowerCase())) continue;
    formToKey.set(String(w).toLowerCase(), key);
  }

  const forms = Array.from(formToKey.keys()).sort((a, b) => b.length - a.length).map((f) => escapeRegExp(f));
  const noteMap = buildMixedLexiconNoteMap(lexicon);
  let normalized = normalizeSenseMarkerSpacing(String(text || "")).replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, "");
  let html = escapeHtml(normalized);
  if (forms.length > 0) {
    const combined = new RegExp(`\\b(${forms.join("|")})\\b`, "gi");
    html = html.replace(combined, (m) => {
      const key = formToKey.get(String(m).toLowerCase()) || resolveWordKeyByToken(m, words) || keyifyWord(m);
      const note = escapeHtml(noteMap.get(key) || "词义待补充");
      return `<span class=\"mixed-vocab\" data-word-key=\"${key}\"><mark class=\"vocab-en\" data-word-key=\"${key}\">${m}</mark><span class=\"mixed-note\">${note}</span></span>`;
    });
  }
  return html;
}

function highlightChineseWithKeys(text, termKeyPairs) {
  let html = escapeHtml(normalizeSenseMarkerSpacing(normalizeZhSenseMarkers(text)));
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

function highlightChineseWithAlignment(text, termKeyPairs, alignment) {
  const alignMap = buildAlignmentWordMap(alignment);
  if (alignMap.size === 0) {
    return highlightChineseWithKeys(text, termKeyPairs);
  }

  let html = escapeHtml(normalizeSenseMarkerSpacing(normalizeZhSenseMarkers(text)).replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, ""));
  for (const item of termKeyPairs || []) {
    const term = String(item?.term || "");
    if (!term) continue;
    const keys = Array.isArray(item?.keys) ? item.keys.filter(Boolean) : [];
    if (keys.length === 0) continue;
    const primaryKey = keys[0];
    const marker = escapeHtml(alignMap.get(primaryKey)?.marker || "①");
    const keysAttr = escapeHtml(keys.join(","));
    const regex = new RegExp(escapeRegExp(term), "g");
    html = html.replace(
      regex,
      (m) => `<mark class=\"vocab-zh\" data-word-keys=\"${keysAttr}\">${m}<sup class=\"sense-marker\">${marker}</sup></mark>`
    );
  }
  return html;
}

function applyChineseVisibility() {
  if (showChinese) {
    exportAreaEl.classList.remove("hide-zh");
  } else {
    exportAreaEl.classList.add("hide-zh");
  }
  syncActionButtonLabels();
}

function applyReadingMode() {
  if (readingMode) {
    document.body.classList.add("reading-mode");
  } else {
    document.body.classList.remove("reading-mode");
  }
  syncActionButtonLabels();
}

function updateMobileNavVisibility() {
  if (!mobileBottomNavEl) return;
  mobileBottomNavEl.classList.toggle("hidden", !isMobileLayout() || readingMode);
}

function updateMobileNavActive(target = "") {
  if (!mobileNavBtnEls.length) return;
  mobileNavBtnEls.forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-target") === target);
  });
}

function hasArticlePage() {
  return !resultSection.classList.contains("hidden");
}

function hasGlossaryPage() {
  return !glossaryPanelEl.classList.contains("hidden");
}

function applyMobilePageLayout() {
  updateMobileNavVisibility();

  if (!isMobileLayout() || readingMode) {
    inputPanelEl?.classList.remove("mobile-page-hidden");
    resultSection?.classList.remove("mobile-page-hidden");
    glossaryPanelEl?.classList.remove("mobile-page-hidden");
    updateMobileNavActive("");
    return;
  }

  if (currentMobilePage === "article" && !hasArticlePage()) {
    currentMobilePage = "home";
  }

  if (currentMobilePage === "glossary" && !hasGlossaryPage()) {
    currentMobilePage = hasArticlePage() ? "article" : "home";
  }

  inputPanelEl?.classList.toggle("mobile-page-hidden", currentMobilePage !== "home");
  resultSection?.classList.toggle("mobile-page-hidden", currentMobilePage !== "article");
  glossaryPanelEl?.classList.toggle("mobile-page-hidden", currentMobilePage !== "glossary");
  updateMobileNavActive(currentMobilePage);
}

function setMobilePage(target) {
  if (target === "article" && !hasArticlePage()) {
    statusEl.textContent = "请先生成文章。";
    return;
  }

  if (target === "glossary" && !hasGlossaryPage()) {
    statusEl.textContent = "请先生成文章。";
    return;
  }

  currentMobilePage = target;
  applyMobilePageLayout();
  if (isMobileLayout()) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function focusMobileResultAfterGenerate() {
  if (!isMobileLayout()) return;
  currentMobilePage = "article";
  applyMobilePageLayout();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function syncActionButtonLabels() {
  if (isMobileLayout()) {
    setButtonContent(readingModeBtn, actionIconSvg("book"), readingMode ? "退出阅读模式" : "阅读模式");
    setButtonContent(toggleZhBtn, '<span class="action-text-icon">ZH</span>', showChinese ? "隐藏中文" : "显示中文");
    setButtonContent(favoriteBtn, actionIconSvg(isCurrentArticleFavorited() ? "heart-fill" : "heart"), isCurrentArticleFavorited() ? "取消收藏" : "收藏文章");
    setButtonContent(exportPdfBtn, actionIconSvg("export"), "导出 PDF");
    setButtonContent(exportWordBtn, actionIconSvg("export"), "导出 Word");
    syncActionButtonStates();
    return;
  }

  setButtonContent(readingModeBtn, readingMode ? "退出阅读模式" : "阅读模式", readingMode ? "退出阅读模式" : "阅读模式");
  setButtonContent(toggleZhBtn, showChinese ? "隐藏中文" : "显示中文", showChinese ? "隐藏中文" : "显示中文");
  setButtonContent(favoriteBtn, isCurrentArticleFavorited() ? "取消收藏" : "收藏文章", isCurrentArticleFavorited() ? "取消收藏" : "收藏文章");
  setButtonContent(exportPdfBtn, "导出 PDF", "导出 PDF");
  setButtonContent(exportWordBtn, "导出 Word", "导出 Word");
  syncActionButtonStates();
}

function setResultMode(mode) {
  articleViewEl?.classList.toggle("hidden", mode !== "article");
  notebookViewEl?.classList.toggle("hidden", mode !== "notebook");
}

function syncLibraryTabs() {
  libraryFavoritesBtnEl?.classList.toggle("active", currentLibraryMode === "favorites");
  libraryNotebookBtnEl?.classList.toggle("active", currentLibraryMode === "notebook");
}

function focusNotebookEntry(key) {
  if (!key || !notebookEntriesEl) return;
  const all = notebookEntriesEl.querySelectorAll(".glossary-item[data-word-key]");
  all.forEach((el) => el.classList.remove("active"));
  const target = notebookEntriesEl.querySelector(`.glossary-item[data-word-key="${key}"]`);
  if (!target) return;
  target.classList.add("active");
  target.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setLibraryMode(mode, options = {}) {
  currentLibraryMode = mode === "notebook" ? "notebook" : "favorites";
  localStorage.setItem("texta_library_mode", currentLibraryMode);
  syncLibraryTabs();
  renderLibraryList();

  if (currentLibraryMode === "notebook") {
    renderNotebookView();
    setResultMode("notebook");
    resultSection.classList.remove("hidden");
  } else {
    setResultMode("article");
    if (options.focusArticle && latestArticle) {
      resultSection.classList.remove("hidden");
    }
  }

  if (isMobileLayout() && options.navigate !== false) {
    const targetPage = options.mobilePage === "glossary" ? "glossary" : "article";
    currentMobilePage = targetPage;
    applyMobilePageLayout();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function refreshMobileNav() {
  syncActionButtonLabels();
  applyMobilePageLayout();
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

function refreshVocabularySurfaces() {
  renderGlossary(latestLexicon);
  renderNotebookView();
  renderLibraryList();
  syncGlossaryFooterButton();
  syncActionButtonLabels();
}

function setWordMastery(item, mastery) {
  const word = String(item?.word || "").trim();
  const key = keyifyWord(word || item?.key || "");
  if (!key) return;

  if (mastery === "mastered") {
    saveWordPref(key, { word, mastery: "mastered" });
    removeNotebookEntry(key);
  } else if (mastery === "unknown") {
    saveWordPref(key, { word, mastery: "unknown" });
  } else {
    saveWordPref(key, { word, mastery: "unknown" });
    removeNotebookEntry(key);
  }

  refreshVocabularySurfaces();
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
  if (isMobileLayout()) {
    currentMobilePage = "glossary";
    applyMobilePageLayout();
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.requestAnimationFrame(() => updateGlossaryFollow([key]));
    return;
  }
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

function renderParagraphBlocks(paragraphsEn, paragraphsZh, words, lexicon, alignment, generationMode = "standard") {
  const isMixedMode = String(generationMode || "").toLowerCase() === "mixed";
  const zhTermKeyPairs = buildChineseTermKeyPairsFromAlignment(alignment, lexicon);

  articleBlocksEl.innerHTML = paragraphsEn
    .map((en, i) => {
      const zh = paragraphsZh[i] || "";
      const enHtml = (isMixedMode
        ? highlightMixedEnglishWithNotes(en, words, alignment, lexicon)
        : highlightEnglishWithAlignment(en, words, alignment)
      ).replace(/\n/g, "<br>");
      const zhHtml = highlightChineseWithAlignment(zh, zhTermKeyPairs, alignment).replace(/\n/g, "<br>");

      return `
        <article class=\"para-card${isMixedMode ? " mixed-mode" : ""}\" data-idx=\"${i}\" style=\"animation-delay:${Math.min(i * 40, 220)}ms\">
          <p class=\"para-en\">${enHtml}</p>
          ${isMixedMode ? "" : `<p class=\"para-zh\">${zhHtml || "(该段翻译生成失败，请重试)"}</p>`}
        </article>
      `;
    })
    .join("");

  applyChineseVisibility();
}

function findLexiconItemByKey(key) {
  return latestLexicon.find((item) => keyifyWord(item?.word || "") === key) || notebookEntries.find((item) => item.key === key) || null;
}

function buildStudyControls(item) {
  const key = keyifyWord(item?.word || item?.key || "");
  const pref = getWordPref(key, item?.word || "");
  const isMastered = pref.mastery === "mastered";
  const isUnknown = pref.mastery === "unknown";

  return `
    <div class="study-controls" data-word-key="${escapeHtml(key)}">
      <div class="mastery-group" aria-label="单词掌握状态">
        <button type="button" class="mastery-btn${isMastered ? " active" : ""}" data-action="mastery" data-word-key="${escapeHtml(key)}" data-mastery="mastered">已掌握</button>
        <button type="button" class="mastery-btn${isUnknown ? " active" : ""}" data-action="mastery" data-word-key="${escapeHtml(key)}" data-mastery="unknown">陌生</button>
      </div>
    </div>
  `;
}

function renderLexiconCard(item, terms = []) {
  const word = escapeHtml(item?.word || "");
  const key = keyifyWord(item?.word || item?.key || "");
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
      const meaning = highlightText(s?.meaning || "", terms, "vocab-zh", false);
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
      ${buildStudyControls(item)}
    </div>
  `;
}

function renderGlossary(lexicon) {
  if (!Array.isArray(lexicon) || lexicon.length === 0) {
    glossaryEl.innerHTML = "<p>生成后显示词汇扩展内容。</p>";
    return;
  }

  const zhTerms = collectChineseTerms(lexicon);
  pronunciationMap = new Map();
  glossaryEl.innerHTML = lexicon.map((item) => renderLexiconCard(item, zhTerms)).join("");
  lastActiveGlossaryKey = "";
}

function renderNotebookView() {
  if (!notebookEntriesEl || !notebookCountEl) return;
  const rows = getNotebookEntriesSorted();
  syncNotebookFilters(rows);
  const filteredRows = filterNotebookRows(rows);
  notebookCountEl.textContent = filteredRows.length === rows.length ? `${rows.length} 个单词` : `显示 ${filteredRows.length} / ${rows.length} 个单词`;

  if (!rows.length) {
    notebookEntriesEl.innerHTML = `<div class="empty-library notebook-empty">生词本还是空的。先在右侧词汇区把陌生词加入生词本。</div>`;
    return;
  }

  if (!filteredRows.length) {
    notebookEntriesEl.innerHTML = `<div class="empty-library notebook-empty">没有找到符合当前搜索或筛选条件的单词。</div>`;
    return;
  }

  const zhTerms = collectChineseTerms(filteredRows);
  notebookEntriesEl.innerHTML = filteredRows.map((item) => renderLexiconCard(item, zhTerms)).join("");

  if (currentNotebookFocusKey) {
    window.requestAnimationFrame(() => focusNotebookEntry(currentNotebookFocusKey));
  }
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
  wrapper.className = "export-print-root";
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
        .export-print-root { page-break-inside:auto; }
        .para-card {
          border:1px solid #e5e7eb;
          border-radius:14px;
          background:#fff;
          padding:12px;
          margin:0 0 10px;
          break-inside: avoid;
          page-break-inside: avoid;
          -webkit-column-break-inside: avoid;
        }
        .para-en,.para-zh { white-space: pre-wrap; line-height: 1.72; margin:0; }
        .para-zh { margin-top:8px; padding-top:8px; border-top:1px dashed #d1d5db; }
        .glossary { border:1px solid #e5e7eb; border-radius:14px; padding:8px 10px; }
        .glossary-item {
          border-bottom:1px dashed #e5e7eb;
          padding:8px 0;
          break-inside: avoid;
          page-break-inside: avoid;
          -webkit-column-break-inside: avoid;
        }
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
  previewPaperEl.innerHTML = `<div class="export-preview-inner" style=\"padding:${marginPx}px;\">${bundle.innerHTML}</div>`;
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
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: {
        mode: ["css", "legacy"],
        avoid: [".para-card", ".glossary-item", ".article-title", "h2"]
      }
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
  latestGenerationMode = String(data.generationMode || "standard").toLowerCase() === "mixed" ? "mixed" : "standard";
  latestGenerationQuality = String(data.generationQuality || "normal").toLowerCase() === "advanced" ? "advanced" : "normal";
  if (data && data.usage) {
    renderUsage(data.usage);
  }
  currentFavoriteId = String(data.id || "").trim();

  const finalTitle = String(data.title || "").trim() || defaultTitleByWords(latestWords);
  articleTitleEl.textContent = finalTitle;
  exportTitleInput.value = finalTitle || String(data.defaultTitle || defaultTitleByWords(latestWords));

  syncNotebookEntriesFromLexicon(latestLexicon);
  renderParagraphBlocks(latestParagraphsEn, latestParagraphsZh, latestWords, latestLexicon, latestAlignment, latestGenerationMode);
  renderGlossary(latestLexicon);
  renderNotebookView();
  syncGlossaryFooterButton();

  if (Array.isArray(data.missing) && data.missing.length > 0) {
    missingWordsEl.textContent = `提示：仍有 ${data.missing.length} 个词未命中：${data.missing.join(", ")}`;
  } else {
    missingWordsEl.textContent = "";
  }

  showChinese = true;
  applyChineseVisibility();
  resultSection.classList.remove("hidden");
  glossaryPanelEl.classList.remove("hidden");
  setLibraryMode("favorites", { navigate: false, focusArticle: true });
  exportPdfBtn.disabled = false;
  exportWordBtn.disabled = false;
  focusMobileResultAfterGenerate();
  refreshMobileNav();
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
  favorites[index].updatedAt = new Date().toISOString();
  saveFavorites();
  renderLibraryList();
  syncActionButtonLabels();

  if (currentFavoriteId && currentFavoriteId === id) {
    articleTitleEl.textContent = nextTitle;
    exportTitleInput.value = nextTitle;
  }
  statusEl.textContent = "收藏标题已更新。";
}

function favoriteFromCurrent() {
  const now = new Date().toISOString();
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
    missing: [],
    createdAt: now,
    updatedAt: now
  };
}

generateBtn.addEventListener("click", async () => {
  const wordsText = wordsInput.value.trim();
  const level = levelSelect.value;
  const generationMode = String(generationModeSelect?.value || "standard");
  const generationQuality = String(generationQualitySelect?.value || "normal").toLowerCase() === "advanced" ? "advanced" : "normal";
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
  const qualityLabel = generationQuality === "advanced" ? "高级生成（消耗2次）" : "普通生成（消耗1次）";
  statusEl.textContent = quickMode ? `${qualityLabel} + 快速模式生成中...` : `AI 正在${qualityLabel}，请稍等（大约10-15秒）...`;

  try {
    latestWords = splitWords(wordsText);
    exportTitleInput.value = defaultTitleByWords(latestWords);
    if (!API_BASE && location.hostname.includes("github.io")) {
      throw new Error("GitHub Pages 仅托管前端。请先在 public/site-config.js 配置后端 API 地址（TEXTA_API_BASE）。");
    }

    const response = await apiFetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words: wordsText, level, quickMode, generationMode, generationQuality })
    });

    const data = await response.json();
    if (response.status === 401) {
      setAuthToken("");
      currentUser = null;
      location.href = "./index.html";
      throw new Error("登录已过期，请重新登录。");
    }
    if (response.status === 429) {
      if (data && data.usage) {
        renderUsage(data.usage);
      }
      throw new Error(data.error || "今日次数已用完");
    }
      if (!response.ok) {
        throw new Error((data && (data.detail || data.error)) || "请求失败");
      }

      applyArticleData({ ...data, words: latestWords });
      const usedCost = Number(data?.usageCost || (generationQuality === "advanced" ? 2 : 1));
      statusEl.textContent = `生成完成（本次消耗：${usedCost} 次）。`;
    } catch (error) {
      statusEl.textContent = `生成失败：${error.message}`;
    } finally {
      generateBtn.disabled = false;
  }
});

wordsInput.addEventListener("input", scheduleSpellcheck);
uploadWordsBtn?.addEventListener("click", () => {
  wordFileInput?.click();
});
wordFileInput?.addEventListener("change", async () => {
  const file = wordFileInput.files && wordFileInput.files[0] ? wordFileInput.files[0] : null;
  await handleWordFileImport(file);
  wordFileInput.value = "";
});
clearWordsBtn?.addEventListener("click", () => {
  wordsInput.value = "";
  spellState = [];
  renderSpelling();
  if (fileImportHintEl) {
    fileImportHintEl.textContent = "";
    fileImportHintEl.classList.add("hidden");
  }
  statusEl.textContent = "已清空单词输入。";
});

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
  const masteryBtn = target.closest(".mastery-btn[data-word-key][data-mastery]");
  if (masteryBtn) {
    const key = masteryBtn.getAttribute("data-word-key") || "";
    const mastery = masteryBtn.getAttribute("data-mastery") || "";
    const item = findLexiconItemByKey(key);
    if (item) {
      setWordMastery(item, mastery);
    }
    return;
  }
  const btn = target.closest(".speak-btn[data-word-key]");
  if (!btn) return;
  const key = btn.getAttribute("data-word-key");
  const accent = btn.getAttribute("data-accent") || "us";
  speakGlossaryByKeyWithAccent(key || "", accent);
});

notebookEntriesEl?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const masteryBtn = target.closest(".mastery-btn[data-word-key][data-mastery]");
  if (masteryBtn) {
    const key = masteryBtn.getAttribute("data-word-key") || "";
    const mastery = masteryBtn.getAttribute("data-mastery") || "";
    const item = findLexiconItemByKey(key);
    if (item) {
      currentNotebookFocusKey = key;
      setWordMastery(item, mastery);
      renderNotebookView();
    }
    return;
  }
  const speakBtn = target.closest(".speak-btn[data-word-key]");
  if (speakBtn) {
    const key = speakBtn.getAttribute("data-word-key");
    const accent = speakBtn.getAttribute("data-accent") || "us";
    speakGlossaryByKeyWithAccent(key || "", accent);
  }
});

readingModeBtn.addEventListener("click", () => {
  readingMode = !readingMode;
  applyReadingMode();
  refreshMobileNav();
});

mobileNavBtnEls.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = String(btn.getAttribute("data-target") || "home");
    setMobilePage(target);
  });
});

libraryFavoritesBtnEl?.addEventListener("click", () => {
  setLibraryMode("favorites", { navigate: false, focusArticle: Boolean(latestArticle) });
});

libraryNotebookBtnEl?.addEventListener("click", () => {
  setLibraryMode("notebook", { navigate: false });
});

addUnknownToNotebookBtnEl?.addEventListener("click", () => {
  const pending = getUnknownWordsNotInNotebook();
  if (pending.length === 0) {
    statusEl.textContent = "当前陌生词已经全部加入生词本。";
    syncGlossaryFooterButton();
    return;
  }

  pending.forEach((item) => upsertNotebookEntry(item));
  renderNotebookView();
  renderLibraryList();
  syncGlossaryFooterButton();
  statusEl.textContent = `已将 ${pending.length} 个陌生词加入生词本。`;
});

notebookSearchInputEl?.addEventListener("input", () => {
  notebookSearchTerm = String(notebookSearchInputEl.value || "");
  renderNotebookView();
});

notebookPosFilterEl?.addEventListener("change", () => {
  notebookPosFilter = String(notebookPosFilterEl.value || "all");
  renderNotebookView();
});

toggleZhBtn.addEventListener("click", () => {
  showChinese = !showChinese;
  applyChineseVisibility();
});

exportPdfBtn.addEventListener("click", () => openExportPreview("pdf"));
exportWordBtn.addEventListener("click", () => openExportPreview("word"));
closeModalBtn.addEventListener("click", closeExportPreview);
openGuideBtn?.addEventListener("click", () => openGuideModal(false));
closeGuideBtnEl?.addEventListener("click", () => closeGuideModal({ respectCheckbox: true }));
closeGuideFooterBtnEl?.addEventListener("click", () => closeGuideModal({ respectCheckbox: true }));
guideModalEl?.addEventListener("click", (event) => {
  if (event.target === guideModalEl) {
    closeGuideModal({ respectCheckbox: true });
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (guideModalEl && !guideModalEl.classList.contains("hidden")) {
    closeGuideModal({ respectCheckbox: true });
  }
  if (exportModalEl && !exportModalEl.classList.contains("hidden")) {
    closeExportPreview();
  }
});
fontSizeSelectEl?.addEventListener("change", () => {
  currentFontSize = String(fontSizeSelectEl.value || "small");
  applyReadingFontSize();
});

favoriteBtn.addEventListener("click", () => {
  if (!latestArticle) {
    statusEl.textContent = "请先生成文章再收藏。";
    return;
  }
  if (isCurrentArticleFavorited()) {
    favorites = favorites.filter((item) => item.id !== currentFavoriteId);
    saveFavorites();
    renderLibraryList();
    syncActionButtonLabels();
    statusEl.textContent = "已取消收藏。";
    return;
  }

  const item = favoriteFromCurrent();
  currentFavoriteId = item.id;
  favorites.unshift(item);
  saveFavorites();
  renderLibraryList();
  syncActionButtonLabels();
  statusEl.textContent = "已加入收藏夹。";
});

favoritesListEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (currentLibraryMode === "notebook") {
    const notebookItem = target.closest(".notebook-item[data-notebook-key]");
    if (!notebookItem) return;
    const key = notebookItem.getAttribute("data-notebook-key") || "";
    currentNotebookFocusKey = key;
    setLibraryMode("notebook", { mobilePage: "glossary" });
    focusNotebookEntry(key);
    return;
  }

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
    if (currentFavoriteId === delId) {
      currentFavoriteId = "";
    }
    saveFavorites();
    renderLibraryList();
    syncActionButtonLabels();
    statusEl.textContent = "已从收藏夹删除。";
    return;
  }
  const itemEl = target.closest(".fav-item[data-fav-id]");
  if (!itemEl) return;
  const id = itemEl.getAttribute("data-fav-id");
  const found = favorites.find((x) => x.id === id);
  if (!found) return;

  setLibraryMode("favorites", { focusArticle: true, mobilePage: "article" });
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
  mountGuideButtonNearUser();
  const ok = await loadMe();
  if (!ok) {
    location.href = "./index.html";
    return;
  }
  loadFavorites();
  loadVocabPrefs();
  loadNotebookEntries();
  await hydrateLibraryFromServer();
  renderSpelling();
  applyReadingFontSize();
  applyReadingMode();
  applyChineseVisibility();
  renderNotebookView();
  setLibraryMode(currentLibraryMode, { navigate: false, focusArticle: Boolean(latestArticle) });
  syncGlossaryFooterButton();
  refreshMobileNav();
  if (shouldAutoOpenGuide(currentUser)) {
    window.setTimeout(() => openGuideModal(true), 120);
  }
}

init();

window.addEventListener("resize", refreshMobileNav);
