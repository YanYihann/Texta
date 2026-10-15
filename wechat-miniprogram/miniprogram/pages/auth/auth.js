const api = require('../../utils/api');
const library = require('../../utils/library');
const wechat = require('../../utils/wechat');
require('../../utils/theme').themedPage({
  data: { mode: 'login', email: '', password: '', name: '', loading: false, error: '', agreed: false,
    wechatReady: false, wechatChecking: true, bindingNeeded: false, bindingUser: null, notice: '', action: '',
    emailExpanded: false, emailBinding: false, passwordConfirm: '', emailMode: 'new' },
  onLoad(options = {}) {
    if (options.bind === 'wechat' && api.signedIn()) this.setData({ bindingNeeded: true, bindingUser: api.session().user });
    if (options.bind === 'email' && api.signedIn()) this.setData({ emailBinding: true, bindingUser: api.session().user });
    this.loadWechat();
  },
  toggleEmail() { if (!this.data.loading) this.setData({ emailExpanded: !this.data.emailExpanded, error: '' }); },
  changeEmailMode(e) { if (!this.data.loading) this.setData({ emailMode: e.currentTarget.dataset.mode, password: '', passwordConfirm: '', error: '' }); },
  async loadWechat() {
    const value = await wechat.status();
    this.setData({ wechatReady: value.enabled, wechatChecking: false });
  },
  changeMode(e) { this.setData({ mode: e.currentTarget.dataset.mode, error: '' }); },
  onInput(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }); },
  agreement(e) { this.setData({ agreed: e.detail.value.length > 0 }); },
  legal(e) { wx.navigateTo({ url: '/pages/legal/legal?type=' + e.currentTarget.dataset.type }); },
  acceptSession(result) {
    if (!result.token || !result.user || !result.user.id) throw new Error('登录结果不完整，请重试。');
    api.saveSession({ token: result.token, user: result.user, expiresAt: result.expiresAt });
    getApp().globalData.currentArticle = null;
    this.setData({ password: '', passwordConfirm: '' });
    library.sync().catch(() => {});
  },
  finish(title = '登录成功') {
    wx.showToast({ title, icon: 'success' });
    if (getCurrentPages().length > 1) wx.navigateBack(); else wx.switchTab({ url: '/pages/index/index' });
  },
  async wechatLogin() {
    if (this.data.loading) return;
    if (!this.data.agreed) { this.setData({ error: '请先阅读并同意服务条款与隐私政策。' }); return; }
    if (!this.data.wechatReady) { this.setData({ error: '微信登录暂未启用，请使用邮箱登录。' }); return; }
    this.setData({ loading: true, action: 'wechat', error: '', notice: '' });
    const previousToken = (api.session() || {}).token;
    try {
      const result = await wechat.login();
      if ((api.session() || {}).token !== previousToken) throw new Error('账号状态已改变，请重新选择登录方式。');
      this.acceptSession(result); this.finish();
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ loading: false, action: '' }); }
  },
  async bindWechat() {
    if (this.data.loading) return;
    if (!this.data.agreed) { this.setData({ error: '请先阅读并同意服务条款与隐私政策。' }); return; }
    if (!this.data.wechatReady) { this.setData({ error: '微信登录暂未启用，请稍后再绑定。' }); return; }
    if (!api.signedIn() || !this.data.bindingUser || api.session().user.id !== this.data.bindingUser.id) {
      this.setData({ bindingUser: null, error: '请先用邮箱登录需要绑定的账号。' }); return;
    }
    this.setData({ loading: true, action: 'bind', error: '' });
    try { await wechat.bind(api.session().token); this.finish('微信绑定成功'); }
    catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ loading: false, action: '' }); }
  },
  skipBinding() { if (!this.data.loading && api.signedIn()) this.finish('已登录'); },
  async bindEmail() {
    if (this.data.loading) return;
    if (!api.signedIn() || !this.data.bindingUser || api.session().user.id !== this.data.bindingUser.id) {
      this.setData({ error: '账号状态已改变，请重新进入设置。' }); return;
    }
    const email = this.data.email.trim().toLowerCase(), password = this.data.password;
    if (!/^\S+@\S+\.\S+$/.test(email)) { this.setData({ error: '请输入有效的邮箱地址。' }); return; }
    if (password.length < 6) { this.setData({ error: '密码至少需要 6 位。' }); return; }
    if (this.data.emailMode !== 'existing' && password !== this.data.passwordConfirm) { this.setData({ error: '两次输入的密码不一致。' }); return; }
    if (!this.data.agreed) { this.setData({ error: '请先阅读并同意服务条款与隐私政策。' }); return; }
    const session = api.session();
    this.setData({ loading: true, action: 'emailBind', error: '' });
    try {
      // Flush cloud learning data before account ownership changes; a failed flush leaves
      // the old account intact and the local pending records available for retry.
      if (this.data.emailMode === 'existing') await library.sync();
      if (!api.signedIn() || api.session().token !== session.token) throw new Error('账号状态已改变，请重新进入设置。');
      const result = await api.request('/api/auth/wechat/email', { method: 'POST', data: { email, password,
        ...(this.data.emailMode === 'existing' ? { mergeExisting: true } : {}) }, timeout: this.data.emailMode === 'existing' ? 90000 : 25000 });
      if (!api.signedIn() || api.session().token !== session.token) throw new Error('账号状态已改变，请重新进入设置。');
      if (!result.ok || !result.user || !result.user.email) throw new Error('邮箱绑定结果不完整，请刷新账号页面。');
      if (result.merged === true) {
        if (result.mergedFrom !== session.user.id || !result.token || !result.expiresAt) throw new Error('账号合并结果不完整，请重新微信登录。');
        library.migrateAccount(session.user.id, result.user.id);
        api.saveSession({ token: result.token, user: result.user, expiresAt: result.expiresAt });
        getApp().globalData.currentArticle = null;
        library.sync().catch(() => {});
      } else {
        if (result.user.id !== session.user.id) throw new Error('账号关联结果不完整，请重新登录。');
        api.saveSession(Object.assign({}, session, { user: result.user }));
      }
      this.setData({ password: '', passwordConfirm: '' }); this.finish(result.merged ? '账号已合并' : '邮箱绑定成功');
    } catch (error) { this.setData({ error: error.network && this.data.emailMode === 'existing'
      ? '关联结果尚未确认，请重新微信登录查看账号，避免立即重复提交。' : error.message }); }
    finally { this.setData({ loading: false, action: '' }); }
  },
  async submit() {
    if (this.data.loading) return;
    const email = this.data.email.trim().toLowerCase(), password = this.data.password;
    if (!/^\S+@\S+\.\S+$/.test(email)) { this.setData({ error: '请输入有效的邮箱地址。' }); return; }
    if (password.length < 6) { this.setData({ error: '密码至少需要 6 位。' }); return; }
    if (!this.data.agreed) { this.setData({ error: '请先阅读并同意服务条款与隐私政策。' }); return; }
    this.setData({ loading: true, action: 'email', error: '' });
    const previousToken = (api.session() || {}).token;
    let registered = false;
    try {
      if (this.data.mode === 'register') {
        await api.request('/api/auth/register', { method: 'POST', auth: false, data: { email, password, name: this.data.name.trim() || 'Texta User' } });
        registered = true;
      }
      const result = await api.request('/api/auth/login', { method: 'POST', auth: false, data: { email, password } });
      if ((api.session() || {}).token !== previousToken) throw new Error('账号状态已改变，请重新选择登录方式。');
      this.acceptSession(result);
      if (this.data.bindingNeeded) this.setData({ bindingUser: result.user, notice: '邮箱账号已登录。请核对下方账号，再确认绑定当前微信。' });
      else this.finish(registered ? '注册成功' : '登录成功');
    } catch (error) {
      this.setData({ error: registered ? '账号已注册成功，请切换到登录重试。' + error.message : error.message, mode: registered ? 'login' : this.data.mode });
    } finally { this.setData({ loading: false, action: '' }); }
  }
});
