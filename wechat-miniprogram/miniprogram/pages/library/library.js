const api = require('../../utils/api');
const library = require('../../utils/library');
const { key } = require('../../utils/words');
function dateLabel(value) { return String(value || '').slice(0, 10); }
require('../../utils/theme').themedPage({
  data: { tab: 'favorites', query: '', category: 'unknown', favorites: [], notebook: [], history: [], loggedIn: false,
    syncing: false, syncText: '', error: '', wordOpen: false, entry: null, sourceArticle: null },
  onShow() { this.refresh(); if (api.signedIn()) this.sync(); },
  async onPullDownRefresh() { try { await this.sync(); } finally { wx.stopPullDownRefresh(); } },
  refresh() {
    const value = library.read(), query = this.data.query.trim().toLowerCase();
    const articleRows = rows => rows.filter(row => !row.deletedAt && (!query || (row.title + ' ' + (row.words || []).join(' ')).toLowerCase().includes(query)))
      .sort((a, b) => String(b.savedAt || b.createdAt).localeCompare(String(a.savedAt || a.createdAt)))
      .map(row => ({ id: row.id, title: row.title, date: dateLabel(row.savedAt || row.createdAt), count: (row.words || []).length, mode: row.generationMode === 'mixed' ? '中文嵌词' : '中英对照' }));
    const notebook = value.notebookEntries.filter(row => {
      const mastered = !!(value.vocabPrefs[row.key] && value.vocabPrefs[row.key].mastery === 'mastered');
      return !row.deletedAt && (this.data.category === 'all' || (this.data.category === 'mastered' ? mastered : !mastered)) &&
        (!query || (row.word + ' ' + (row.baseMeanings || []).join(' ') + ' ' + (row.senses || []).map(s => s.meaning).join(' ')).toLowerCase().includes(query));
    }).sort((a, b) => a.word.localeCompare(b.word, 'en')).map(row => ({ key: row.key, word: row.word, pos: row.pos,
      meaning: (row.baseMeanings && row.baseMeanings.length ? row.baseMeanings : (row.senses || []).map(s => s.meaning)).join('；'), mastered: !!(value.vocabPrefs[row.key] && value.vocabPrefs[row.key].mastery === 'mastered') }));
    this.setData({ loggedIn: api.signedIn(), favorites: articleRows(value.favorites), notebook, history: articleRows(library.history()),
      syncText: value.dirty ? '本地有待同步修改' : value.syncedAt ? '已同步云端资料' : '下拉或点击同步读取云端资料' });
  },
  changeTab(e) { this.setData({ tab: e.currentTarget.dataset.tab, query: '', error: '' }); this.refresh(); },
  changeCategory(e) { this.setData({ category: e.currentTarget.dataset.category }); this.refresh(); },
  search(e) { this.setData({ query: e.detail.value }); this.refresh(); },
  login() { wx.navigateTo({ url: '/pages/auth/auth' }); },
  generate() { wx.switchTab({ url: '/pages/index/index' }); },
  async sync() {
    if (!api.signedIn() || this.data.syncing) return;
    this.setData({ syncing: true, error: '' });
    try { await library.sync(); } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ syncing: false }); this.refresh(); }
  },
  openArticle(e) { wx.navigateTo({ url: '/pages/result/result?id=' + encodeURIComponent(e.currentTarget.dataset.id) }); },
  openWord(e) {
    const entry = library.read().notebookEntries.find(row => row.key === e.currentTarget.dataset.key);
    if (!entry) return;
    this.setData({ wordOpen: true, entry, sourceArticle: entry.sourceArticle || null });
  },
  closeWord() { this.setData({ wordOpen: false }); },
  openSource() {
    if (!this.data.sourceArticle || !this.data.sourceArticle.article) return;
    getApp().globalData.currentArticle = this.data.sourceArticle;
    this.closeWord(); wx.navigateTo({ url: '/pages/result/result' });
  },
  async remove(e) {
    const type = e.currentTarget.dataset.type, id = e.currentTarget.dataset.id;
    wx.showModal({ title: type === 'word' ? '移出生词本？' : '取消收藏？', content: '确认后会同步此修改，生成历史仍保留在本机。', success: async res => {
      if (!res.confirm) return;
      try { library.remove(type, id); this.refresh(); await this.sync(); }
      catch (error) { this.setData({ error: error.message }); }
    } });
  },
  reviewWords() {
    const rows = this.data.notebook;
    if (!rows.length) return;
    wx.setStorageSync('texta_draft', { input: rows.slice(0, 120).map(row => row.word).join('\n'), mode: 'standard', shortMode: true });
    getApp().globalData.reviewDraft = true;
    wx.switchTab({ url: '/pages/index/index' });
  }
});
