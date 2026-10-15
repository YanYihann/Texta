const api = require('../../utils/api');
const library = require('../../utils/library');
const config = require('../../config');
const wechat = require('../../utils/wechat');
require('../../utils/theme').themedPage({
  data: { user: null, loggedIn: false, usage: null, planName: '', syncing: false, error: '', notice: '', favoritesCount: 0, notebookCount: 0, masteredCount: 0,
    wechatEnabled: false, wechatBound: false, wechatChecking: false },
  onShow() {
    const auth = api.session(), value = library.read();
    this.setData({ loggedIn: api.signedIn(), user: api.signedIn() ? auth.user : null,
      favoritesCount: value.favorites.filter(row => !row.deletedAt).length,
      notebookCount: value.notebookEntries.filter(row => !row.deletedAt).length,
      masteredCount: value.notebookEntries.filter(row => !row.deletedAt && value.vocabPrefs[row.key] && value.vocabPrefs[row.key].mastery === 'mastered').length,
      error: '', usage: null });
    if (api.signedIn()) { this.loadUsage(); this.loadWechat(); }
    else this.setData({ wechatEnabled: false, wechatBound: false, wechatChecking: false });
  },
  async loadWechat() {
    const token = api.session().token;
    this.setData({ wechatChecking: true, wechatEnabled: false, wechatBound: false });
    const value = await wechat.status();
    if (api.session() && api.session().token === token) this.setData({ wechatEnabled: value.enabled, wechatBound: value.bound, wechatChecking: false });
  },
  bindWechat() {
    if (api.signedIn() && this.data.wechatEnabled && !this.data.wechatBound) wx.navigateTo({ url: '/pages/auth/auth?bind=wechat' });
  },
  async loadUsage() {
    const token = (api.session() || {}).token;
    try {
      const result = await api.request('/api/usage');
      if (!api.session() || api.session().token !== token) return;
      this.setData({ usage: result.usage, user: result.user, planName: result.role === 'admin' ? '管理员' : ({ free: '免费版', plus: 'Plus', pro: 'Pro', vip: 'VIP' }[result.plan] || result.plan) });
      if (api.session()) api.saveSession(Object.assign({}, api.session(), { user: result.user }));
    } catch (error) { this.setData({ error: error.message, loggedIn: api.signedIn() }); }
  },
  login() { wx.navigateTo({ url: '/pages/auth/auth' }); },
  bindEmail() { if (api.signedIn() && !api.session().user.email) wx.navigateTo({ url: '/pages/auth/auth?bind=email' }); },
  library() { wx.switchTab({ url: '/pages/library/library' }); },
  async sync() {
    if (!api.requireLogin() || this.data.syncing) return;
    this.setData({ syncing: true, error: '', notice: '' });
    try { await library.sync(); this.onShow(); this.setData({ notice: '资料已同步。' }); }
    catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ syncing: false }); }
  },
  logout() {
    const dirty = library.read().dirty;
    wx.showModal({ title: '退出登录？', content: dirty ? '还有未同步的资料。本地记录会保留，重新登录此账号后可继续同步。' : '本地记录会保留，重新登录此账号后可继续学习。',
      success: async res => {
        if (!res.confirm) return;
        try { await api.request('/api/auth/logout', { method: 'POST' }); } catch (_) {}
        api.clearSession(); getApp().globalData.currentArticle = null; this.onShow();
      }
    });
  },
  legal(e) { wx.navigateTo({ url: '/pages/legal/legal?type=' + e.currentTarget.dataset.type }); },
  contact() { wx.setClipboardData({ data: '1963372275@qq.com' }); },
  website() { wx.setClipboardData({ data: config.website }); },
  async health() {
    this.setData({ notice: '正在检查连接…', error: '' });
    try { const result = await api.request('/api/health', { auth: false }); this.setData({ notice: result.ok ? 'Texta 后端连接正常。' : '后端返回异常，请稍后重试。' }); }
    catch (error) { this.setData({ error: error.message, notice: '' }); }
  }
});
