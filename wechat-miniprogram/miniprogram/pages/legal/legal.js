const policies = require('../../data/policies');
require('../../utils/theme').themedPage({
  data: { title: '', sections: [], supplement: '' },
  onLoad(options) {
    const privacy = options.type !== 'terms';
    const policy = policies[privacy ? 'privacy' : 'terms'];
    this.setData({ title: privacy ? '隐私政策' : '服务条款', sections: policy.sections,
      supplement: privacy ? '小程序适配说明（2026年10月7日，1.1.2）：小程序使用微信本地存储保存登录令牌、输入草稿、配色主题、阅读字号、按账号隔离的资料缓存及最近生成历史。邮箱和密码经 HTTPS 提交给 Texta 后端；本地不保存密码。微信快捷登录启用后，仅在你主动登录或确认绑定时获取临时登录凭证，由后端向微信校验并获取此小程序内的用户标识（OpenID），首次使用会自动创建 Texta 账号，之后通过此标识登录同一账号；邮箱不是使用小程序的必填信息。你可在账号设置中主动填写新邮箱并设置密码，以在网页端访问同一资料和套餐；也可输入已注册邮箱及原账号密码，经验证后将当前微信账号的学习资料合并至该邮箱账号，并将微信登录关联至该账号，保留原邮箱账号套餐、合计已用额度。合并会撤销原微信账号登录会话，原账号停用并保留合并关系记录；本机历史会并入目标账号，本机原缓存保留为备份。密码仅用于身份校验，不保存在小程序本地。微信会话密钥不保存、不返回小程序；不为此获取手机号、头像或微信昵称。生成词汇会由后端提交给既有 AI 服务商；输入补全与拼写提示使用本地词典，不上传输入内容。文件导入仅读取你选择的文件，导出文件保存在本机。小程序未接入图片生成、微信支付、广告或浏览器语音服务。下方是现有 Texta 服务的完整中文政策，其中网站和支付说明按其实际适用范围执行。' : '小程序适配说明（2026年10月6日）：本小程序使用 Texta 的账号、生成、用量和学习资料服务，未在小程序内提供付费购买。下方为现有 Texta 服务的完整中文条款。' });
    wx.setNavigationBarTitle({ title: this.data.title });
  },
  contact() { wx.setClipboardData({ data: '1963372275@qq.com' }); }
});
