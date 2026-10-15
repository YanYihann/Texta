const api = require('../../utils/api');
const library = require('../../utils/library');
const reading = require('../../utils/reading');
const exporter = require('../../utils/export');
const { documentModel } = require('../../utils/export-layout');
require('../../utils/theme').themedPage({
  data: { article: null, blocks: [], glossary: [], view: 'paired', saved: false, saving: false, wordOpen: false, entry: null,
    error: '', notice: '', exporting: false, fontSize: 36, exportOpen: false, exportTitle: '', exportType: 'pdf', includeChinese: true, hasChinese: false,
    marginIndex: 1, margins: ['窄 · 8 mm', '标准 · 12 mm', '宽 · 16 mm'], exportPreview: null },
  onLoad(options) {
    const article = options.id ? library.articleById(options.id) : getApp().globalData.currentArticle;
    if (!article || !article.article) { this.setData({ error: '这篇文章暂时无法读取，请回到资料库重新打开。' }); return; }
    this.setData({ article, blocks: reading.paragraphs(article), glossary: article.baseLexicon && article.baseLexicon.length ? article.baseLexicon : article.lexicon || [],
      saved: library.hasArticle(article.id), view: article.generationMode === 'mixed' ? 'english' : 'paired', fontSize: wx.getStorageSync('texta_reading_size') || 36,
      hasChinese: (article.paragraphsZh || []).some(Boolean) });
  },
  onShow() { if (this.data.article) this.setData({ saved: library.hasArticle(this.data.article.id) }); },
  changeView(e) { this.setData({ view: e.currentTarget.dataset.view }); },
  openWord(e) {
    const word = e.currentTarget.dataset.word; if (!word) return;
    this.setData({ entry: reading.definition(this.data.article, word), wordOpen: true });
  },
  closeWord() { this.setData({ wordOpen: false }); },
  source() { this.closeWord(); },
  async save() {
    if (!this.data.article || this.data.saving || !api.requireLogin()) return;
    this.setData({ saving: true, error: '', notice: '' });
    try { library.saveArticle(this.data.article); this.setData({ saved: true }); await library.sync(); this.setData({ notice: '文章已收藏并同步到云端。' }); }
    catch (error) { this.setData({ error: error.message, notice: this.data.saved ? '本地收藏已保留，可以稍后到资料库重试同步。' : '' }); }
    finally { this.setData({ saving: false }); }
  },
  copy() { if (!this.data.article) return; wx.setClipboardData({ data: reading.plainText(this.data.article), fail: () => this.setData({ error: '复制失败，请重试。' }) }); },
  size() {
    const fontSize = this.data.fontSize === 36 ? 42 : this.data.fontSize === 42 ? 32 : 36;
    this.setData({ fontSize }); wx.setStorageSync('texta_reading_size', fontSize);
  },
  exportFile() {
    if (this.data.exporting || !this.data.article) return;
    this.setData({ exportOpen: true, exportTitle: this.data.article.title, includeChinese: this.data.view !== 'english', error: '', notice: '' });
    this.refreshPreview();
    if (wx.pageScrollTo) wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },
  closeExport() { if (!this.data.exporting) this.setData({ exportOpen: false }); },
  exportOptions() { return { title: this.data.exportTitle, includeChinese: this.data.includeChinese, margin: [8,12,16][this.data.marginIndex] }; },
  refreshPreview() { this.setData({ exportPreview: documentModel(this.data.article, this.exportOptions()) }); },
  exportTitleInput(e) { this.setData({ exportTitle: e.detail.value }); this.refreshPreview(); },
  changeExportType(e) { this.setData({ exportType: e.currentTarget.dataset.type }); },
  changeExportChinese(e) { this.setData({ includeChinese: e.detail.value }); this.refreshPreview(); },
  changeMargin(e) { this.setData({ marginIndex: Number(e.detail.value) }); this.refreshPreview(); },
  async confirmExport() {
      if (this.data.exporting || !this.data.article) return;
      this.setData({ exporting: true, error: '', notice: '' });
      try {
        const type = this.data.exportType;
        const filePath = await exporter.exportArticle(this, this.data.article, type, this.exportOptions());
        this.setData({ notice: '文件已生成，可在预览菜单中分享或保存。' });
        if (type === 'txt') {
          if (wx.shareFileMessage) await new Promise((resolve, reject) => wx.shareFileMessage({ filePath, fileName: exporter.fileName({ title: this.data.exportTitle || this.data.article.title }, type), success: resolve, fail: reject }));
          else throw new Error('当前微信版本不支持分享文本文件，请使用复制文章。');
        } else await new Promise((resolve, reject) => wx.openDocument({ filePath, fileType: type, showMenu: true, success: resolve, fail: reject }));
      } catch (error) {
        if (!/cancel/i.test(error.errMsg || '')) this.setData({ error: error.message || '文件预览失败，请重试，或选择复制文章。' });
      } finally { this.setData({ exporting: false }); }
  },
  back() { wx.switchTab({ url: '/pages/index/index' }); },
  onShareAppMessage() { return { title: 'Texta · 用文章记单词', path: '/pages/index/index' }; }
});
