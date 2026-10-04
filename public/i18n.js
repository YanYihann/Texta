(() => {
  const dictionary = {
    '日历大小':'Calendar size','缩略图':'Thumbnail','跳转原文':'Open source article','来源文章':'Source article','暂无保存的原文':'No saved source article',
    '日历':'Calendar','生词':'Unfamiliar','单词状态':'Word status','A–Z 字母排序':'A–Z alphabetically',
    '加入时间 · 最新在前':'Added · newest first','加入时间 · 最早在前':'Added · oldest first','生词排序':'Notebook sorting','收藏排序':'Favorites sorting',
    '搜索收藏文章':'Search favorites','搜索标题、文章或词汇':'Search titles, articles or vocabulary','全部文章':'All articles','未分类':'Unfiled',
    '选择文件夹':'Choose a folder','＋ 新建文件夹':'+ New folder','重命名':'Rename','删除文件夹':'Delete folder',
    '‹ 返回日历':'‹ Back to calendar','显示全部':'Show all','生词日历':'Vocabulary calendar','本月':'This month','上个月':'Previous month','下个月':'Next month',
    '按首次加入日期查看':'Browse by the date first added','荧光圈标记加入日期 · 点击查看单词':'Highlighted dates mark additions · select to view words',
    '原文例句':'Sentence in the article','展开词汇详情':'Expand word details',
    '还没有已掌握的单词。掌握一个，就把它移到这里。':'No mastered words yet. Mark a word as mastered to move it here.',
    '生词本还是空的。先在词汇区把陌生词加入生词本。':'Your notebook is empty. Save unfamiliar words from the definitions.',
    '没有符合当前搜索或文件夹的文章。':'No articles match this search or folder.',
    '还没有收藏。读到喜欢的文章，就把它收进来。':'No favorites yet. Save an article you would like to revisit.',
    '修改词汇':'Edit vocabulary',
    '按 ESC 可退出阅读模式。':'Press ESC to exit focus mode.', '关闭词汇解析':'Close definition',
    '英文':'English','词性':'Part of speech','中文翻译':'Chinese meaning','词汇表':'Vocabulary list','当前列表没有可导出的生词。':'No words to export in the current list.',
    '文章生成':'Generate','收藏夹':'Favorites','生词本':'Notebook','历史记录':'History','历史':'History','账户':'Account',
    '帮助':'Help','使用说明':'Help','说明':'Help','输入词汇':'Vocabulary','填入示例词汇':'Use example words','导入文件':'Import file','清空':'Clear',
    '输入英文单词或短语，用逗号或换行分隔':'Enter English words or phrases, separated by commas or new lines',
    '短语中的空格会保留。支持 TXT、Markdown、CSV 和 JSON 文件。':'Spaces in phrases are preserved. Supports TXT, Markdown, CSV and JSON.',
    '难度等级':'Level','初级':'Beginner','中级':'Intermediate','高级':'Advanced','生成模式':'Output','英文文章 + 中文翻译':'English + Chinese translation','中英混合':'Mixed Chinese & English',
    '生成档位':'Quality','普通生成 · 1 次':'Standard · 1 credit','高级生成 · 5 次':'Advanced · 5 credits','快速模式':'Quick mode','生成更短文章':'Shorter article',
    '生成文章':'Generate article','文章阅读':'Reading','输入词汇，生成学习文章':'Enter vocabulary to create a study article',
    '点击文章中的高亮词查看释义，标记陌生词后加入生词本。':'Select a highlighted word to see its definition. Save unfamiliar words to your notebook.',
    '查看示例文章':'Preview example','示例文章':'Example article','阅读模式':'Focus mode','退出阅读模式':'Exit focus mode','隐藏中文':'Hide Chinese','显示中文':'Show Chinese',
    '收藏文章':'Save article','取消收藏':'Unsave article','导出':'Export','导出 PDF':'Export PDF','导出 Word':'Export Word','阅读字号':'Reading size','小':'Small','中':'Medium','大':'Large',
    '导出标题':'Export title','词汇解析':'Definitions','上一个单词':'Previous word','下一个单词':'Next word','选择单词':'Select word','输入':'Input','文章':'Article','词汇':'Words',
    '已掌握':'Mastered','陌生':'Unfamiliar','美音':'US','英音':'UK','单词掌握状态':'Word mastery','短语搭配:':'Collocations','词根词缀:':'Word formation','同近义词:':'Synonyms','反义词:':'Antonyms','(暂无)':'Not available',
    '将陌生词添加到生词本':'Add unfamiliar words to notebook','陌生词已全部加入生词本':'All unfamiliar words are saved','暂无收藏':'No saved articles yet.',
    '暂无历史记录（生成后会自动保存到本地）。':'No history yet. Generated articles are saved automatically.',
    '暂无生词，先把右侧词汇标记成“陌生”并加入生词本。':'No words yet. Mark a word as unfamiliar and add it to your notebook.',
    '生词本还是空的。先在右侧词汇区把陌生词加入生词本。':'Your notebook is empty. Add unfamiliar words from the definitions panel.',
    '没有找到符合当前搜索或筛选条件的单词。':'No words match your search or filter.','搜索单词、释义或搭配':'Search words, meanings or collocations','搜索生词':'Search notebook','筛选词性':'Filter by part of speech','全部词性':'All parts of speech',
    '返回文章':'Back to article','改标题':'Rename','删除':'Delete','未命名文章':'Untitled article','未命名单词':'Untitled word','陌生词':'Unfamiliar word',
    '列表':'List','卡片':'Cards','生词本视图':'Notebook view','查看详情':'View details','主题样式':'Theme style','荧光':'Highlighter','森林':'Forest','暖纸':'Warm paper','海蓝':'Ocean','薰衣草':'Lavender','模型请求诊断':'Model requests','系统':'System','浅色':'Light','深色':'Dark','主题切换':'Theme','学习导航':'Study navigation','移动端学习导航':'Mobile study navigation',
    '连接账户中…':'Connecting account…','未登录':'Signed out','退出登录':'Sign out','用户使用查看':'Usage administration','VIP 审核':'VIP review','VIP审核中心':'VIP review',
    '升级 VIP（10 元，每日 50 次）':'Upgrade to VIP · ¥10 · 50 daily credits','升级VIP（10元/日50次）':'Upgrade to VIP · ¥10 · 50 daily credits',
    '登录 Texta':'Sign in to Texta','登录':'Sign in','注册':'Register','邮箱':'Email','密码':'Password','用户名':'Name','登录并进入':'Sign in','注册并进入':'Create account',
    '请输入密码':'Enter your password','请输入你的用户名':'Enter your name','至少 6 位密码':'At least 6 characters','忘记密码？':'Forgot password?','显示密码':'Show password','隐藏密码':'Hide password','账户操作':'Account',
    '请填写邮箱和密码。':'Enter your email and password.','请输入有效的邮箱地址。':'Enter a valid email address.','密码至少需要 6 位。':'Use a password with at least 6 characters.',
    '暂未开放自助找回密码，请联系管理员处理。':'Self-service password reset is not available. Contact the administrator.',
    '使用邮箱注册或登录，进入后即可生成单词文章。':'Register or sign in with your email to generate vocabulary articles.',
    '登录中...如果后端刚启动，首次连接可能需要稍等。':'Signing in… The server may need a moment to start.',
    '注册中...如果后端刚启动，首次连接可能需要稍等。':'Creating your account… The server may need a moment to start.',
    '登录失败：网络连接超时或后端正在启动，请再点一次登录。':'Connection timed out. Wait a moment and try signing in again.',
    '注册失败：网络连接超时或后端正在启动，请稍后重试。':'Connection timed out. Wait a moment and try registering again.',
    '登录失败':'Sign-in failed','注册失败':'Registration failed','注册后自动登录失败':'Automatic sign-in failed','请求失败':'Request failed',
    '请先输入单词。':'Enter some vocabulary first.','请先生成文章。':'Generate an article first.','请先生成文章再收藏。':'Generate an article before saving it.',
    '已清空单词输入。':'Vocabulary cleared.','已加入收藏夹。':'Article saved.','已取消收藏。':'Article unsaved.','已从收藏夹删除。':'Removed from favorites.','已从历史记录删除。':'Removed from history.',
    '已从收藏夹打开文章。':'Opened a saved article.','已从历史记录打开文章。':'Opened an article from history.','收藏标题已更新。':'Saved title updated.','标题不能为空。':'Title cannot be empty.',
    '当前陌生词已经全部加入生词本。':'All unfamiliar words are already saved.','当前浏览器不支持语音功能。':'Speech is not supported in this browser.','发音播放失败，请重试。':'Pronunciation failed. Try again.',
    '云端同步暂时失败，已保存在本地，稍后会自动重试。':'Cloud sync failed. Your work is saved locally; sync will retry automatically.',
    '登录已过期，请重新登录后继续云端同步。':'Your session expired. Sign in again to continue syncing.','详细词典加载失败':'Definition could not load.','词义待补充':'Meaning not available.',
    '生成后显示词汇扩展内容。':'Definitions appear after generation.','正在生成，请稍候…':'Generating. Please wait…','正在生成…':'Generating…',
    '输入超过 120 个词，请删减后重试。':'Too many words. Reduce your list to 120 or fewer.','示例仅用于预览，不消耗次数。':'This example is for preview and uses no credits.',
    'Texta 使用说明':'Texta help','关闭':'Close','我知道了':'Got it','下次不再自动弹出':'Do not open automatically again',
    '先在上方输入单词，建议每次 6-15 个，命中率和可读性更稳定。':'Enter vocabulary above. A list of 6–15 words is a good starting point.',
    '普通生成用于日常练习；高级生成质量更高但消耗次数更多。':'Standard generation costs 1 credit; advanced generation costs 5 credits.',
    '中英混合模式适合“中文语境 + 英文挖空词”记忆；普通模式适合整篇阅读。':'Mixed mode puts English vocabulary in Chinese context. Standard mode produces English with Chinese translation.',
    '文章生成后可点击高亮词查看释义，并把陌生词加入生词本。':'Select highlighted words for definitions, then save unfamiliar words to your notebook.',
    '收藏夹和生词本会自动同步到云端，不同设备登录同账号可共享。':'Favorites and notebook sync across devices when you sign in to the same account.',
    '导出前可改标题、选择是否包含中文翻译，并调整页边距。':'Before export, edit the title, choose Chinese translations and adjust margins.',
    '欢迎使用 Texta，可先查看一次使用说明。':'Welcome to Texta. Read the help to get started.','导出前预览':'Export preview','标题':'Title','包含中文翻译':'Include Chinese translation','页边距':'Margins','窄':'Narrow','标准':'Standard','宽':'Wide','确认导出':'Export','确认导出 PDF':'Export PDF','确认导出 Word':'Export Word','请先填写标题。':'Enter a title first.','Word 已导出。':'Word exported.','PDF 已导出。':'PDF exported.','PDF 库加载失败，请刷新后重试。':'PDF export could not load. Refresh and try again.',
    '跳到词汇输入':'Skip to vocabulary input','切换界面语言':'Switch interface language','文章生成设置':'Generation settings','学习内容库':'Study library','输入的词汇':'Entered vocabulary',
    '无匹配文章':'No matching articles','学习者':'Learner','普通用户':'Free user','VIP用户':'VIP user','管理员':'Administrator','普通':'Free','用户':'User'
  };
  const patterns = [
    [/^(\d+) 篇文章$/, n => `${n} articles`],
    [/^(\d+) 个词$/, n => `${n} words`],
    [/^本月 (\d+) 个词$/, n => `${n} words this month`],
    [/^全年 (\d+) 个词$/, n => `${n} words this year`],
    [/^(.+) 加入的单词$/, date => `Words added on ${date}`],
    [/^删除 (.+)$/, word => `Delete ${word}`],
    [/^(.+) 的词汇详情$/, word => `Word details for ${word}`],
    [/^移动 (.+) 到文件夹$/, title => `Move ${title} to folder`],
    [/^已从 (.+) 新增 (\d+) 个词汇（最多 120 个）。$/, (file,n) => `Added ${n} vocabulary items from ${file} (120 maximum).`],
    [/^(\d+) \/ 120 个词$/, n => `${n} / 120 words`],
    [/^(\d+) 个单词$/, n => `${n} words`],
    [/^显示 (\d+) \/ (\d+) 个单词$/, (n,total) => `${n} of ${total} words`],
    [/^今日剩余次数：\s*(\d+) \/ (\d+)（(.+)）$/, (n,total,plan) => `Daily credits: ${n} / ${total} (${dictionary[plan] || plan})`],
    [/^今日剩余次数：无限（管理员）$/, () => 'Daily credits: unlimited (administrator)'],
    [/^(.+) · (普通用户|VIP用户|管理员)$/, (name,role) => `${name} · ${dictionary[role]}`],
    [/^将陌生词添加到生词本（(\d+)）$/, n => `Add unfamiliar words (${n})`],
    [/^已将 (\d+) 个陌生词加入生词本。$/, n => `${n} unfamiliar words added to notebook.`],
    [/^文件识别完成，当前共 (\d+) 个单词。$/, n => `File imported. ${n} words in total.`],
    [/^生成完成（本次消耗：(\d+) 次，思考耗时：(.+)）。$/, (n,time) => `Complete · ${n} credits · ${time}`],
    [/^生成失败：(.+)（已思考：(.+)）$/, (error,time) => `Generation failed: ${error} (${time})`],
    [/^正在生成…（已思考：(.+)）$/, time => `Generating… (${time})`],
    [/^登录失败：(.+)$/, error => `Sign-in failed: ${dictionary[error] || error}`],
    [/^注册失败：(.+)$/, error => `Registration failed: ${dictionary[error] || error}`],
    [/^提示：仍有 (\d+) 个词未命中：(.+)$/, (n,words) => `${n} words were not included: ${words}`],
    [/^陌生词 · (.+)$/, time => `Unfamiliar · ${time}`]
  ];
  dictionary['注册 Texta'] = 'Create a Texta account';
  dictionary['在本文中'] = 'In this article';
  dictionary['词义'] = 'Meanings'; dictionary['常见搭配'] = 'Collocations'; dictionary['词汇扩展'] = 'More word details'; dictionary['例句译文'] = 'Sentence translation';
  Object.assign(dictionary, {
    '日历视图':'Calendar view','上一年':'Previous year','下一年':'Next year','今年':'This year','正在翻译例句…':'Translating sentence…','例句翻译暂时不可用。':'Sentence translation is unavailable.','重试翻译':'Retry translation',
    'Texta 主页':'Texta home','PDF 导出失败，请重试。':'PDF export failed. Try again.',
    '返回主页面':'Back to study','升级 VIP':'Upgrade to VIP','支付 10 元可升级 VIP（每日 50 次）':'Pay ¥10 for VIP with 50 daily credits.',
    '收款码':'Payment QR code','扫码付款后，提交支付凭证供管理员审核。':'Scan to pay, then submit proof of payment for review.',
    '付款人昵称':'Payer name','例如：张三':'Your payment account name','支付凭证号（可选）':'Transaction number (optional)',
    '例如：订单号/转账单号':'Order or transfer number','凭证图片链接（可选）':'Receipt image URL (optional)','粘贴图片URL，或先留空':'Paste an image URL, or leave blank',
    '备注（可选）':'Note (optional)','补充说明':'Additional details','提交支付凭证':'Submit payment proof','提交中...':'Submitting…','网络异常，请稍后重试。':'Connection failed. Try again later.',
    '你已有待审核申请，请耐心等待管理员处理。':'Your request is pending review.','你的VIP申请已通过，可返回主页面查看。':'Your VIP request was approved. Return to study.',
    '你当前已是 VIP/管理员，无需重复申请。':'Your account already has VIP or administrator access.','已提交支付凭证，等待管理员审核通过后生效。':'Payment proof submitted. VIP access starts after approval.',
    '刷新':'Refresh','VIP 审核中心':'VIP review','返回用户列表':'Back to user list','用户使用详情':'User usage details','加载中...':'Loading…','搜索用户':'Search users','输入用户名或邮箱':'Enter a name or email',
    '身份筛选':'Role','全部身份':'All roles','VIP 用户':'VIP user','排序方式':'Sort by','按总使用次数降序':'Most credits used','按最近使用时间降序':'Last active','按用户创建时间降序':'Newest accounts',
    '没有匹配到用户':'No matching users','请调整搜索关键词或筛选条件。':'Change the search or filter.','正在加载所有用户使用记录...':'Loading usage…','暂无用户数据':'No user data','当前没有可展示的用户数据。':'No user data to show.',
    '暂无待审核申请':'No pending requests','正在加载待审核申请...':'Loading pending requests…','当前没有待审核申请。':'No requests are awaiting review.',
    '已通过申请。':'Request approved.','已驳回申请。':'Request rejected.','请从用户列表进入详情页。':'Open a user from the user list.','没有找到该用户。':'User not found.'
  });
  let language;
  try { language = localStorage.getItem('texta_language') === 'en' ? 'en' : 'zh'; } catch { language = 'zh'; }
  const textNodes = new WeakMap();
  const attributeSources = new WeakMap();
  const excluded = 'script,style,textarea,#articleTitle,#articleBlocks,#previewPaper,.fav-main,.glossary-word,.sense-line,.extra-value,.speak-ipa,.context-sentence,.context-translation,.definition-summary,.collocation-row,.export-preview-inner';
  function translate(text) {
    if (language !== 'en') return text;
    const trimmed = text.trim();
    let result = dictionary[trimmed];
    if (result === undefined) {
      for (const [pattern, render] of patterns) { const match = trimmed.match(pattern); if (match) { result = render(...match.slice(1)); break; } }
    }
    return result === undefined ? text : text.replace(trimmed, result);
  }
  function translateNode(node) {
    if (!node.parentElement || node.parentElement.closest(excluded)) return;
    const previous = textNodes.get(node);
    const original = previous && node.nodeValue === previous.rendered ? previous.original : node.nodeValue;
    const rendered = translate(original);
    textNodes.set(node, {original, rendered});
    if (node.nodeValue !== rendered) node.nodeValue = rendered;
  }
  function apply(root = document.body) {
    if (root.nodeType === Node.TEXT_NODE) { translateNode(root); return; }
    if (!(root instanceof Element) || root.closest(excluded)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) translateNode(walker.currentNode);
    for (const el of [root, ...root.querySelectorAll('[placeholder],[aria-label],[title]')]) {
      if (el.closest('#articleBlocks,#previewPaper')) continue;
      const sources = attributeSources.get(el) || {};
      for (const key of ['placeholder','aria-label','title']) {
        if (!el.hasAttribute(key)) continue;
        const current = el.getAttribute(key), previous = sources[key];
        const original = previous && current === previous.rendered ? previous.original : current;
        const rendered = translate(original); sources[key] = {original,rendered};
        if (current !== rendered) el.setAttribute(key,rendered);
      }
      attributeSources.set(el,sources);
    }
  }
  function setLanguage(next) {
    language = next === 'en' ? 'en' : 'zh';
    try { localStorage.setItem('texta_language',language); } catch { /* Storage may be unavailable. */ }
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    document.querySelectorAll('.language-toggle').forEach(button => { button.textContent = language === 'zh' ? '中文 / EN' : 'EN / 中文'; button.setAttribute('aria-label', language === 'zh' ? 'Switch to English' : '切换为中文'); });
    apply();
    const pageTitle = document.body.classList.contains('payment-page') ? ['升级 VIP','Upgrade to VIP'] : document.body.classList.contains('admin-page') ? ['管理','Administration'] : document.body.classList.contains('auth-page') ? ['登录','Sign in'] : ['词汇学习','Vocabulary study'];
    document.title = `Texta · ${pageTitle[language === 'zh' ? 0 : 1]}`;
    document.dispatchEvent(new CustomEvent('texta:language',{detail:language}));
  }
  window.TextaI18n = { text: translate, apply, get language() { return language; }, setLanguage };
  document.querySelectorAll('.language-toggle').forEach(button => button.addEventListener('click',()=>setLanguage(language === 'zh' ? 'en' : 'zh')));
  setLanguage(language);
  const pending = new Set(); let frame = 0;
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') pending.add(record.target);
      else { for (const node of record.addedNodes) pending.add(node); }
    }
    if (frame || !pending.size) return;
    frame = requestAnimationFrame(() => { frame = 0; for (const node of pending) if (node.isConnected) apply(node); pending.clear(); });
  });
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
})();
