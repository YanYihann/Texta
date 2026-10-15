const api = require('../../utils/api');
const library = require('../../utils/library');
const words = require('../../utils/words');
const config = require('../../config');
const assist = require('../../utils/word-assist');
require('../../utils/theme').themedPage({
  data: { input: '', draftInput: '', chips: [], focused: false, completion: '', draftSuggestion: null, count: 0, mode: 'standard', shortMode: false, loading: false, error: '', status: '', suggestions: [], usageText: '登录后查看今日额度', loggedIn: false, recent: [] },
  onLoad() {
    const draft = wx.getStorageSync('texta_draft') || {};
    this.setData({ mode: draft.mode || 'standard', shortMode: !!draft.shortMode });
    this.updateEditor(draft.chips || words.splitWords(draft.input), draft.draftInput || '');
  },
  onShow() {
    if (getApp().globalData.reviewDraft) {
      const draft = wx.getStorageSync('texta_draft') || {};
      this.setData({ mode: draft.mode || 'standard', shortMode: !!draft.shortMode, error: '' });
      this.updateEditor(words.splitWords(draft.input), '');
      getApp().globalData.reviewDraft = false;
    }
    this.setData({ loggedIn: api.signedIn(), usageText: api.signedIn() ? '正在读取今日额度…' : '登录后查看今日额度',
      recent: library.history().slice(0, 3).map(row => ({ id: row.id, title: row.title, wordCount: (row.words || []).length })) });
    if (api.signedIn()) this.loadUsage();
  },
  onUnload() { clearTimeout(this.progressTimer); },
  async loadUsage() {
    const id = library.owner();
    try {
      const result = await api.request('/api/usage');
      if (library.owner() === id) this.setData({ usageText: result.usage.isUnlimited ? '今日额度不限' : '今日剩余 ' + result.usage.remaining + ' 次' });
    } catch (error) { this.setData({ usageText: error.status === 401 ? '请重新登录' : '额度暂时无法读取' }); }
  },
  persistDraft() { wx.setStorageSync('texta_draft', { input: this.data.input, chips: this.data.chips.map(row => row.word), draftInput: this.data.draftInput, mode: this.data.mode, shortMode: this.data.shortMode }); },
  updateEditor(list, draftInput) {
    const unique = words.splitWords(list.join('\n')), suggestions = [];
    const chips = unique.map(word => {
      const issues = assist.inspect(word);
      issues.forEach(issue => { if (!suggestions.some(row => words.key(row.word) === words.key(issue.word))) suggestions.push(issue); });
      return { word, issue: !!issues.length };
    });
    const input = [...unique, draftInput].filter(Boolean).join('\n');
    const token = (draftInput.match(/(?:^|\s)([A-Za-z]+)$/) || [])[1] || '';
    this.setData({ chips, draftInput, input, count: words.splitWords(input).length, suggestions, completion: token ? assist.completion(token) : '', draftSuggestion: assist.inspect(draftInput)[0] || null, error: '' });
    this.persistDraft();
  },
  onInput(e) { this.updateEditor(words.splitWords(e.detail.value), ''); },
  onDraftInput(e) {
    if (this.data.loading) return;
    const value = e.detail.value;
    if (/[,，;；\n\r\t]/.test(value)) this.updateEditor(words.splitWords([...this.data.chips.map(row => row.word), value].join('\n')), '');
    else this.updateEditor(this.data.chips.map(row => row.word), value);
  },
  commitDraft() { this.updateEditor(words.splitWords(this.data.input), ''); },
  focusEditor() { this.setData({ focused: true }); },
  blurEditor() { this.setData({ focused: false }); },
  editWord(e) {
    if (this.data.loading) return;
    const index = Number(e.currentTarget.dataset.index), list = this.data.chips.map(row => row.word), word = list[index];
    if (!word) return;
    list.splice(index, 1);
    if (this.data.draftInput.trim()) list.push(this.data.draftInput);
    this.updateEditor(list, word); this.focusEditor();
  },
  removeWord(e) { if (this.data.loading) return; const list = this.data.chips.map(row => row.word); list.splice(Number(e.currentTarget.dataset.index), 1); this.updateEditor(list, this.data.draftInput); },
  acceptCompletion() {
    if (!this.data.completion || this.data.loading) return;
    this.updateEditor(this.data.chips.map(row => row.word), this.data.draftInput.replace(/[A-Za-z]+$/, this.data.completion)); this.focusEditor();
  },
  changeMode(e) { this.setData({ mode: e.currentTarget.dataset.mode }); this.persistDraft(); },
  toggleShort(e) { this.setData({ shortMode: e.detail.value }); this.persistDraft(); },
  example() { this.updateEditor(['journey', 'discover', 'challenge', 'achieve', 'opportunity', 'curious'], ''); },
  clear() { this.updateEditor([], ''); this.focusEditor(); },
  login() { wx.navigateTo({ url: '/pages/auth/auth' }); },
  async paste() {
    try {
      const value = await new Promise((resolve, reject) => wx.getClipboardData({ success: resolve, fail: reject }));
      this.onInput({ detail: { value: value.data } });
    } catch (_) { this.setData({ error: '无法读取剪贴板，也可以直接在输入框中粘贴。' }); }
  },
  importFile() {
    wx.chooseMessageFile({ count: 1, type: 'file', extension: ['txt', 'md', 'csv', 'json'], success: res => {
      const file = res.tempFiles[0];
      if (file.size > 1024 * 1024) { this.setData({ error: '请选择小于 1 MB 的词表文件。' }); return; }
      wx.getFileSystemManager().readFile({ filePath: file.path, encoding: 'utf8', success: data => {
        try { const input = words.importWords(data.data, file.name.split('.').pop().toLowerCase()); this.onInput({ detail: { value: input } }); }
        catch (error) { this.setData({ error: error.message }); }
      }, fail: () => this.setData({ error: '无法读取文件，请使用 UTF-8 编码的词表。' }) });
    }, fail: error => { if (!/cancel/i.test(error.errMsg || '')) this.setData({ error: '无法选择文件，请重试或直接粘贴词表。' }); } });
  },
  replaceSuggestion(e) {
    const item = e.currentTarget.dataset.draft ? this.data.draftSuggestion : this.data.suggestions[e.currentTarget.dataset.index];
    if (!item) return;
    const replace = value => value.replace(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g, word => words.key(word) === words.key(item.word) ? item.suggestion : word);
    this.updateEditor(this.data.chips.map(row => replace(row.word)), replace(this.data.draftInput));
  },
  async generate() {
    if (this.data.loading) return;
    this.commitDraft();
    const list = words.splitWords(this.data.input), error = words.validate(list);
    if (error) { this.setData({ error }); return; }
    if (!api.requireLogin()) return;
    const id = library.owner();
    this.setData({ loading: true, error: '', status: '正在生成文章并准备词典卡，通常需要几十秒。' });
    this.progressTimer = setTimeout(() => this.setData({ status: '仍在处理，请稍候。词汇较多时会需要更长时间。' }), 30000);
    try {
      const result = await api.request('/api/generate', { method: 'POST', timeout: config.generationTimeout,
        data: { words: list.join('\n'), generationMode: this.data.mode, shortMode: this.data.shortMode, generationQuality: 'normal' } });
      if (library.owner() !== id) throw new Error('账号已切换，请返回原账号查看学习资料。');
      if (!result.article) throw new Error('服务未返回完整文章，请稍后重试。');
      const article = Object.assign({}, result, { words: list, id: library.uid('article_'), createdAt: new Date().toISOString() });
      getApp().globalData.currentArticle = article;
      try { library.addHistory(article); } catch (_) { wx.showToast({ title: '本地空间不足，请收藏到云端', icon: 'none' }); }
      this.setData({ status: '' });
      wx.navigateTo({ url: '/pages/result/result' });
    } catch (error) { this.setData({ error: error.message, status: '' }); }
    finally { clearTimeout(this.progressTimer); this.setData({ loading: false }); if (api.signedIn()) this.loadUsage(); }
  },
  openRecent(e) { wx.navigateTo({ url: '/pages/result/result?id=' + encodeURIComponent(e.currentTarget.dataset.id) }); },
  onShareAppMessage() { return { title: 'Texta · 用文章记单词', path: '/pages/index/index' }; }
});
