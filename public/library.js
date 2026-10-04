// Library organization shares the authenticated library snapshot with app.js.
let libraryFolders = [];
let notebookCategory = "unknown";
let notebookSort = "az";
let notebookDateFilter = "";
let favoritesSearch = "";
let favoritesSort = "az";
let selectedFolder = "all";
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let calendarDirection = 1;
let calendarSize = localStorage.getItem("texta_calendar_size") === "mini" ? "mini" : "standard";
const FOLDERS_KEY = "texta_library_folders";

function findNotebookSource(item, { includeCurrent = false } = {}) {
  if (item?.sourceArticle?.article) return item.sourceArticle;
  const key = keyifyWord(item?.word || item?.key || "");
  const matches = article => article?.article && !article.deletedAt &&
    (article.words || []).some(word => keyifyWord(word) === key);
  // Prefer the current article only when first saving a word from that article.
  if (includeCurrent && latestArticle && latestWords.some(word => keyifyWord(word) === key)) return favoriteFromCurrent();
  return favorites.find(matches) || historyEntries.find(matches) || null;
}

function openNotebookSource(key) {
  const entry = notebookEntries.find(item => item.key === key && !item.deletedAt);
  const source = findNotebookSource(entry);
  if (!source) return;
  const original = normalizeFavorite(source);
  // Keep the saved definition available alongside the original article.
  original.lexicon = upsertWordEntryByKey(original.lexicon, key, entry);
  original.baseLexicon = upsertWordEntryByKey(original.baseLexicon, key, entry);
  wordsInput.value = original.words.join(", ");
  applyArticleData(original);
  document.dispatchEvent(new CustomEvent("texta:open-article"));
  setMobilePage("article");
  requestAnimationFrame(() => {
    updateGlossaryFollow([key]);
    const mark = [...articleBlocksEl.querySelectorAll("mark[data-word-key]")].find(element => element.dataset.wordKey === key);
    if (mark) { mark.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); mark.focus({ preventScroll: true }); }
  });
}

function libraryDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sortLibraryRows(rows, sort, field) {
  const alphabet = (a, b) => String(a[field] || "").localeCompare(String(b[field] || ""), "en", { sensitivity: "base", numeric: true });
  return [...rows].sort((a, b) => sort === "az" ? alphabet(a, b) : (sort === "oldest" ? 1 : -1) * String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || alphabet(a, b));
}

function mergeFolderRows(first, second) {
  const map = new Map();
  for (const raw of [...first, ...second]) {
    const id = String(raw?.id || "").trim().slice(0, 80);
    const name = sanitizeGlossTextForUi(raw?.name, 80);
    if (!id || !name) continue;
    const now = new Date().toISOString();
    const row = { id, name, createdAt: normalizeIsoDate(raw.createdAt, now), updatedAt: normalizeIsoDate(raw.updatedAt || raw.createdAt, now), deletedAt: String(raw.deletedAt || "") };
    if (!map.has(id) || row.updatedAt >= map.get(id).updatedAt) map.set(id, row);
  }
  return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 200);
}

function loadLibraryFolders() {
  try { const raw = JSON.parse(localStorage.getItem(FOLDERS_KEY) || "[]"); libraryFolders = mergeFolderRows([], Array.isArray(raw) ? raw : []); } catch { libraryFolders = []; }
}

function saveLibraryFolders(markDirty = true) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(libraryFolders));
  if (markDirty) librarySyncDirty = true;
  scheduleLibrarySync();
}

function recoverMasteredEntries() {
  // Older clients stored mastered preferences while removing the notebook row.
  for (const [key, pref] of Object.entries(vocabPrefs)) {
    if (pref.mastery !== "mastered" || notebookEntries.some(row => row.key === key)) continue;
    const row = normalizeNotebookEntry({ key, word: pref.word || key, createdAt: pref.createdAt || pref.updatedAt, updatedAt: pref.updatedAt });
    if (row) notebookEntries.push(row);
  }
}

function deleteFavorite(id) {
  const now = new Date().toISOString();
  favorites = favorites.map(item => item.id === id ? { ...item, deletedAt: now, updatedAt: now } : item);
}

function activeFolders() { return libraryFolders.filter(folder => !folder.deletedAt).sort((a, b) => a.name.localeCompare(b.name, "zh-CN")); }
function effectiveFolderId(item) { return activeFolders().some(folder => folder.id === item.folderId) ? item.folderId : ""; }

function renderOrganizedFavorites() {
  if (!favoritesListEl) return;
  const folders = activeFolders();
  if (selectedFolder !== "all" && selectedFolder !== "" && !folders.some(folder => folder.id === selectedFolder)) selectedFolder = "";
  const filter = document.getElementById("favoriteFolderFilter");
  filter.innerHTML = '<option value="all">全部文章</option><option value="">未分类</option>' + folders.map(folder => `<option value="${escapeHtml(folder.id)}">${escapeHtml(folder.name)}</option>`).join("");
  filter.value = selectedFolder;
  document.getElementById("renameFolderBtn").disabled = !selectedFolder || selectedFolder === "all";
  document.getElementById("deleteFolderBtn").disabled = !selectedFolder || selectedFolder === "all";
  const query = favoritesSearch.trim().toLowerCase();
  const active = favorites.filter(item => !item.deletedAt);
  const rows = sortLibraryRows(active.filter(item => (selectedFolder === "all" || effectiveFolderId(item) === selectedFolder) && (!query || [item.title, item.article, ...(item.words || [])].join(" ").toLowerCase().includes(query))), favoritesSort, "title");
  document.getElementById("favoritesCount").textContent = `${rows.length} 篇文章`;
  favoritesListEl.innerHTML = rows.length ? rows.map(item => `
    <div class="fav-item" data-fav-id="${escapeHtml(item.id)}">
      <div class="fav-left"><div class="fav-main">${escapeHtml(item.title || "未命名文章")}</div>
        <div class="fav-meta">${escapeHtml(formatNotebookMeta(item.createdAt))} · ${(item.words || []).length} 个词汇</div></div>
      <div class="fav-actions">
        <select data-fav-folder="${escapeHtml(item.id)}" aria-label="移动 ${escapeHtml(item.title)} 到文件夹"><option value="">未分类</option>${folders.map(folder => `<option value="${escapeHtml(folder.id)}"${effectiveFolderId(item) === folder.id ? " selected" : ""}>${escapeHtml(folder.name)}</option>`).join("")}</select>
        <button class="fav-rename" type="button" data-fav-rename="${escapeHtml(item.id)}">改标题</button>
        <button class="fav-delete" type="button" data-fav-delete="${escapeHtml(item.id)}">删除</button>
      </div>
    </div>`).join("") : `<div class="empty-library">${active.length || query || selectedFolder !== "all" ? "没有符合当前搜索或文件夹的文章。" : "还没有收藏。读到喜欢的文章，就把它收进来。"}</div>`;
}

function syncNotebookOrganizer() {
  document.querySelectorAll("[data-notebook-category]").forEach(button => {
    const category = button.dataset.notebookCategory;
    const count = notebookEntries.filter(item => !item.deletedAt && (getWordPref(item.key).mastery === "mastered") === (category === "mastered")).length;
    button.setAttribute("aria-pressed", String(category === notebookCategory));
    button.querySelector("span").textContent = count;
  });
  const calendar = document.getElementById("notebookCalendar");
  calendar.classList.toggle("hidden", notebookViewMode !== "calendar");
  notebookEntriesEl.classList.toggle("hidden", notebookViewMode === "calendar");
  const dateBar = document.getElementById("notebookDateBar");
  dateBar.classList.toggle("hidden", !notebookDateFilter);
  document.getElementById("notebookSelectedDate").textContent = notebookDateFilter ? `${notebookDateFilter} 加入的单词` : "";
  document.getElementById("notebookSort").value = notebookSort;
}

function renderNotebookCalendar(rows) {
  const calendar = document.getElementById("notebookCalendar");
  calendar.dataset.size = calendarSize;
  const year = calendarMonth.getFullYear(), month = calendarMonth.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const counts = new Map();
  for (const item of rows) { const key = libraryDateKey(item.createdAt); counts.set(key, (counts.get(key) || 0) + 1); }
  const today = libraryDateKey(new Date());
  const cells = Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    if (day < 1 || day > days) return '<div class="calendar-blank" aria-hidden="true"></div>';
    const date = libraryDateKey(new Date(year, month, day));
    const count = counts.get(date) || 0;
    return `<button type="button" class="calendar-day${count ? " has-words" : ""}${date === today ? " is-today" : ""}" data-calendar-date="${date}" ${count ? "" : "disabled"} ${date === today ? 'aria-current="date"' : ""} aria-label="${year}年${month + 1}月${day}日，${count} 个${notebookCategory === "mastered" ? "已掌握单词" : "生词"}"><span class="calendar-number" style="--day-delay:${index * 12}ms">${day}</span>${count ? `<span class="calendar-count">${count} 个词</span>` : ""}</button>`;
  }).join("");
  const monthCount = rows.filter(item => { const date = new Date(item.createdAt); return date.getFullYear() === year && date.getMonth() === month; }).length;
  calendar.innerHTML = `<div class="calendar-heading"><div><p class="calendar-eyebrow">按首次加入日期查看</p><h3 aria-live="polite">${year}<span>年</span> ${String(month + 1).padStart(2, "0")}<span>月</span></h3></div><div class="calendar-size-toggle" role="group" aria-label="日历大小"><button type="button" data-calendar-size="standard" aria-pressed="${calendarSize === "standard"}">标准</button><button type="button" data-calendar-size="mini" aria-pressed="${calendarSize === "mini"}">缩略图</button></div><div class="calendar-navigation"><button type="button" data-calendar-month="-1" aria-label="上个月">‹</button><button type="button" data-calendar-today>本月</button><button type="button" data-calendar-month="1" aria-label="下个月">›</button></div></div><div class="calendar-weekdays">${["一", "二", "三", "四", "五", "六", "日"].map(day => `<span>${day}</span>`).join("")}</div><div class="calendar-grid" style="--month-direction:${calendarDirection}">${cells}</div><div class="calendar-footer"><span><i aria-hidden="true"></i> 荧光圈标记加入日期 · 点击查看单词</span><span>本月 ${monthCount} 个词</span></div>`;
}

document.getElementById("notebookSort").addEventListener("change", event => { notebookSort = event.target.value; renderNotebookView(); });
document.querySelectorAll("[data-notebook-category]").forEach(button => button.addEventListener("click", () => {
  notebookCategory = button.dataset.notebookCategory; currentNotebookFocusKey = ""; renderNotebookView();
}));
document.getElementById("notebookCalendar").addEventListener("click", event => {
  const sizeButton = event.target.closest("[data-calendar-size]");
  if (sizeButton) { calendarSize = sizeButton.dataset.calendarSize; localStorage.setItem("texta_calendar_size", calendarSize); renderNotebookView(); document.querySelector(`[data-calendar-size="${calendarSize}"]`).focus(); return; }
  const monthButton = event.target.closest("[data-calendar-month]");
  if (monthButton) { calendarDirection = Number(monthButton.dataset.calendarMonth); calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + calendarDirection, 1); renderNotebookView(); document.querySelector(`[data-calendar-month="${calendarDirection}"]`).focus(); return; }
  if (event.target.closest("[data-calendar-today]")) { calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1); renderNotebookView(); document.querySelector("[data-calendar-today]").focus(); return; }
  const dateButton = event.target.closest("[data-calendar-date]");
  if (dateButton && !dateButton.disabled) { notebookDateFilter = dateButton.dataset.calendarDate; notebookViewMode = "list"; renderNotebookView(); document.getElementById("backToCalendarBtn").focus(); }
});
document.getElementById("backToCalendarBtn").addEventListener("click", () => { notebookDateFilter = ""; notebookViewMode = "calendar"; renderNotebookView(); document.querySelector("[data-calendar-today]").focus(); });
document.getElementById("clearNotebookDateBtn").addEventListener("click", () => { notebookDateFilter = ""; renderNotebookView(); document.getElementById("notebookSearchInput").focus(); });
document.getElementById("favoritesSearchInput").addEventListener("input", event => { favoritesSearch = event.target.value; renderFavorites(); });
document.getElementById("favoritesSort").addEventListener("change", event => { favoritesSort = event.target.value; renderFavorites(); });
document.getElementById("favoriteFolderFilter").addEventListener("change", event => { selectedFolder = event.target.value; renderFavorites(); });
document.getElementById("newFolderBtn").addEventListener("click", () => {
  const name = window.prompt("新建文件夹名称：");
  if (!name?.trim()) return;
  const now = new Date().toISOString();
  const folder = { id: `folder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name: sanitizeGlossTextForUi(name, 80), createdAt: now, updatedAt: now, deletedAt: "" };
  libraryFolders.unshift(folder); selectedFolder = folder.id; saveLibraryFolders(); renderFavorites();
});
document.getElementById("renameFolderBtn").addEventListener("click", () => {
  const folder = libraryFolders.find(item => item.id === selectedFolder && !item.deletedAt);
  if (!folder) return;
  const name = window.prompt("重命名文件夹：", folder.name);
  if (!name?.trim()) return;
  folder.name = sanitizeGlossTextForUi(name, 80); folder.updatedAt = new Date().toISOString(); saveLibraryFolders(); renderFavorites();
});
document.getElementById("deleteFolderBtn").addEventListener("click", () => {
  const folder = libraryFolders.find(item => item.id === selectedFolder && !item.deletedAt);
  if (!folder || !window.confirm(`删除文件夹“${folder.name}”？其中的文章会保留在“未分类”中。`)) return;
  const now = new Date().toISOString(); folder.deletedAt = now; folder.updatedAt = now;
  favorites = favorites.map(item => item.folderId === folder.id ? { ...item, folderId: "", updatedAt: now } : item);
  selectedFolder = ""; saveLibraryFolders(); saveFavorites(); renderFavorites();
});
favoritesListEl.addEventListener("change", event => {
  const select = event.target.closest("[data-fav-folder]");
  if (!select) return;
  const item = favorites.find(row => row.id === select.dataset.favFolder && !row.deletedAt);
  if (!item) return;
  item.folderId = activeFolders().some(folder => folder.id === select.value) ? select.value : "";
  item.updatedAt = new Date().toISOString(); saveFavorites(); renderFavorites();
});
