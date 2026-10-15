const api = require('./api');
const { key } = require('./words');
let syncTask = null;
function empty() { return { favorites: [], notebookEntries: [], vocabPrefs: {}, libraryFolders: [], dirty: false, revision: 0 }; }
function owner() { const auth = api.session(); return auth && auth.user ? String(auth.user.id) : 'guest'; }
function storageKey(id = owner()) { return 'texta_library_' + id; }
function read(id = owner()) { return Object.assign(empty(), wx.getStorageSync(storageKey(id)) || {}); }
function persist(value, id = owner()) { wx.setStorageSync(storageKey(id), value); }
function mutate(fn) {
  const value = read(); fn(value); value.dirty = true; value.revision = Number(value.revision || 0) + 1; persist(value); return value;
}
function mergeRows(first, second, field) {
  const map = new Map();
  [...first, ...second].forEach(row => {
    const id = row[field]; if (!id) return;
    const current = map.get(id);
    if (!current || String(row.updatedAt || row.createdAt || '') >= String(current.updatedAt || current.createdAt || '')) map.set(id, row);
  });
  return [...map.values()];
}
function merge(local, remote) {
  const prefs = Object.assign({}, remote.vocabPrefs || {});
  Object.keys(local.vocabPrefs).forEach(id => {
    if (!prefs[id] || String(local.vocabPrefs[id].updatedAt || '') >= String(prefs[id].updatedAt || '')) prefs[id] = local.vocabPrefs[id];
  });
  return Object.assign({}, local, {
    favorites: mergeRows(remote.favorites || [], local.favorites, 'id'),
    notebookEntries: mergeRows(remote.notebookEntries || [], local.notebookEntries, 'key'),
    libraryFolders: mergeRows(remote.libraryFolders || [], local.libraryFolders, 'id'),
    vocabPrefs: prefs
  });
}
async function sync() {
  if (!api.signedIn()) throw new Error('请先登录再同步资料。');
  const id = owner();
  if (syncTask) {
    const task = syncTask;
    await task.promise;
    if (owner() !== id) throw new Error('账号已切换，请重新同步。');
    if (task.id === id && !read(id).dirty) return read(id);
    return sync();
  }
  const task = { id, promise: null };
  task.promise = (async () => {
    const remote = await api.request('/api/library');
    if (owner() !== id) throw new Error('账号已切换，同步已停止。');
    const local = read(id);
    const merged = merge(local, remote);
    persist(merged, id);
    if (local.dirty) {
      if (merged.favorites.length > 200 || merged.notebookEntries.length > 2000 ||
          merged.libraryFolders.length > 200 || Object.keys(merged.vocabPrefs).length > 5000)
        throw new Error('资料数量超过后端同步上限，本地修改已保留，请联系开发者处理。');
      // The backend replaces a whole snapshot. Always pull and preserve ALL collections first.
      await api.request('/api/library/sync', { method: 'POST', data: {
        favorites: merged.favorites, notebookEntries: merged.notebookEntries,
        vocabPrefs: merged.vocabPrefs, libraryFolders: merged.libraryFolders
      } });
      const current = read(id);
      if (current.revision === local.revision) { current.dirty = false; current.syncedAt = new Date().toISOString(); persist(current, id); }
    } else { merged.syncedAt = new Date().toISOString(); persist(merged, id); }
    return read(id);
  })();
  syncTask = task;
  try { return await task.promise; } finally { if (syncTask === task) syncTask = null; }
}
function uid(prefix) { return prefix + Date.now() + '_' + Math.random().toString(36).slice(2, 9); }
function articleById(id) {
  return read().favorites.find(row => row.id === id && !row.deletedAt) || history().find(row => row.id === id) || null;
}
function history() { return wx.getStorageSync('texta_history_' + owner()) || []; }
function addHistory(article) {
  if (!article.id) article.id = uid('article_');
  if (!article.createdAt) article.createdAt = new Date().toISOString();
  const rows = [article, ...history().filter(row => row.id !== article.id)].slice(0, 30);
  wx.setStorageSync('texta_history_' + owner(), rows); return article;
}
function migrateAccount(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return;
  const merged = merge(read(targetId), read(sourceId));
  merged.dirty = true; merged.revision = Number(merged.revision || 0) + 1; persist(merged, targetId);
  const historyKey = id => 'texta_history_' + id;
  const rows = mergeRows(wx.getStorageSync(historyKey(targetId)) || [], wx.getStorageSync(historyKey(sourceId)) || [], 'id');
  // Keep every history row on merge; the normal 30-item rolling cap applies only to future additions.
  wx.setStorageSync(historyKey(targetId), rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))));
}
function saveArticle(article) {
  return mutate(value => {
    const now = new Date().toISOString();
    const old = value.favorites.find(row => row.id === article.id);
    const row = Object.assign({}, old || {}, article, { id: article.id || uid('article_'), savedAt: now, updatedAt: now, deletedAt: '' });
    value.favorites = [row, ...value.favorites.filter(item => item.id !== row.id)];
  });
}
function hasArticle(id) { return read().favorites.some(row => row.id === id && !row.deletedAt); }
function addWord(entry, article) {
  return mutate(value => {
    const now = new Date().toISOString(), id = key(entry.word);
    const old = value.notebookEntries.find(row => row.key === id);
    const row = Object.assign({}, old || {}, entry, { id: old ? old.id : uid('nb_'), key: id, createdAt: old ? old.createdAt : now, updatedAt: now, deletedAt: '' });
    if (article) row.sourceArticle = article;
    value.notebookEntries = [row, ...value.notebookEntries.filter(item => item.key !== id)];
    if (!value.vocabPrefs[id]) value.vocabPrefs[id] = { word: entry.word, mastery: 'unknown', createdAt: now, updatedAt: now };
  });
}
function setMastery(word, mastered) {
  mutate(value => {
    const id = key(word), now = new Date().toISOString();
    value.vocabPrefs[id] = Object.assign({}, value.vocabPrefs[id], { word, mastery: mastered ? 'mastered' : 'unknown', updatedAt: now });
  });
}
function remove(type, id) {
  mutate(value => {
    const rows = type === 'word' ? value.notebookEntries : value.favorites;
    const row = rows.find(item => (type === 'word' ? item.key : item.id) === id);
    if (row) { row.deletedAt = new Date().toISOString(); row.updatedAt = row.deletedAt; }
  });
}
module.exports = { read, mutate, merge, sync, uid, history, addHistory, migrateAccount, articleById, saveArticle, hasArticle, addWord, setMastery, remove, owner };
