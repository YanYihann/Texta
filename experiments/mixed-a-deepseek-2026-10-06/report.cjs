const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {parseMixedResponse,buildMixedPrompt}=require('../../generation/mixed.cjs');
const root=path.resolve(__dirname,'../..');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'results.json'),'utf8'));
const rows=data.results;
for(const row of rows){
 const response=fs.readFileSync(path.join(__dirname,'raw',`${row.id}-${row.calls.length}.response.txt`),'utf8');
 const current=parseMixedResponse(response,row.words,row.quickMode);
 if(current.issues.length||current.article!==row.result.article||row.missing.length)throw new Error(`Current code verification failed: ${row.id}`);
}
const snapshot=Object.fromEntries(['generation/mixed.cjs','server.js','public/app.js','tests/mixed-generation.cjs'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
fs.writeFileSync(path.join(__dirname,'code-snapshot.json'),JSON.stringify(snapshot,null,2));
const lines=[
 '# 修改后的 A 方案：DeepSeek V3.2 实测与替换候选', '',
 '日期：2026-10-06。请求模型：deepseek-v3.2。通过项目原有 302.ai Chat Completions 适配器实测，temperature=0.4。', '',
 '**发布状态：本地候选代码已实现，未提交、推送或部署。功能与格式检查通过；随机难词组的故事语义质量仍未达到用户要求，不能认定“完全没问题”。**', '',
 '## 当前实现', '',
 '一次模型调用返回简短 storyPlan、选定词义 vocabulary、标题、带词义标记的中文故事。原词、词性、中文词义共同出现在标记中，例如 ⟦budget|n.|预算⟧。代码将整个标记还原为输入原词，同时提取语境词义。没有英文草稿、翻译流程，也没有独立词库、用法规划、逐块生成或语义复审请求。', '',
 '目标词优先一次，最多两次且词义一致。检查全词覆盖、合法词性、标记词义与已选义项一致、额外英文、篇幅及中文连接长度。可明确判定的闭合符号缺失和紧邻释义重复由代码修复；相邻英文词之间补空格。不猜测替换正文中的中文，不追加补词句。不合格时最多重新生成一次，仍失败则报错并退还积分。', '',
 '混合请求关闭传输层自动重试，每次请求超时上限为30秒（超过48词为60秒），并受原OPENAI_TIMEOUT_MS更短配置约束。两次内容请求的上限分别约60秒或120秒；正常耗时见实测。', '',
 '取消高级生成档位，前后端均将旧 advanced 请求归为 normal，每次生成扣1积分。保留初级/中级/高级难度与双语文章模式。混合文章不再自动预取所有词的详细词典，也不再向模型请求例句中文译文；例句通过语境词义本地还原，详细词典在点击词汇时加载并保留原语境词义。', '',
 '## 最终版本的真实 API 测试', '',
 '| 词表 | 输入数 | 生成请求数 | 最终覆盖 | 最终中文汉字 | 耗时秒 | 输入tokens | 输出tokens | 合计tokens |',
 '|---|---:|---:|---:|---:|---:|---:|---:|---:|'
];
for(const row of rows){const d=row.diagnostics;lines.push(`| ${row.id} | ${row.words.length} | ${row.calls.length} | ${row.words.length-row.missing.length}/${row.words.length} | ${row.result.chineseChars} | ${row.seconds.toFixed(2)} | ${d.totalInputTokens} | ${d.totalOutputTokens} | ${d.totalTokens} |`);}
lines.push('',`${rows.length}组均最终通过机械检查，${rows.filter(row=>row.calls.length===1).length}组首次通过。覆盖使用项目findMissingWords检查，最终所有文本又由当前版本解析器复核。`, '',
 '耗时包含本机网络与服务端等待，tokens取真实API usage，包含同一次响应里的词义及简短事件计划。与此前Codex测试不同，这次没有Codex基础上下文开销；不能跨模型或跨运行方式直接计算提速倍数。每组只做一次完整尝试（最多含一次自动重生成），不代表长期成功率或线上SLA。', '',
 '本机直连302.ai失败，测试进程通过Windows已有127.0.0.1:7890代理连接；没有改用户全局配置。直连失败保存在network-direct-results.json；提示词迭代样例与失败结果保存在initial及revision-*，不混入最终版本表格。', '',
 '## 内容验收的实际问题', '',
 '覆盖、词义字段一致与篇幅可用代码验证，但无法证明语义合理。12词样例把实验室、羽毛、刚毛、蟋蟀与省钱强行联系，未说明清楚因果；12词复测把这些难词塞进板球赛装饰，场景选择同样牵强。其他组也有中文介词位置或搭配生硬之处。120词虽然全部覆盖且未截断，但出现名词及动作串列，不能视为自然短故事的合格证明。', '',
 '另外独立试了3组单次内容编辑，结果保存在review-results.json。12词编辑仍未解决问题，因此未把额外审稿调用加入候选流程，以免增加耗时与tokens而缺乏明确收益。', '',
 '当前结论：速度、覆盖、篇幅及后台调用数量有明确改善方向；随机难词组合的故事质量验收未通过。按照用户“完善并确认没问题后替换”的要求，不发布当前候选到线上。', '',
 '## 程序与浏览器检查', '',
 '- npm run test:mixed：9项通过，包含实际生成路由的混合/双语分支、普通计费、失败退款、短语/大小写/词边界、120词预算、有限重生成、闭合符修复、语境词义保留及关闭传输层重试。',
 '- test:library、test:context通过；test:billing的8项执行检查通过，1项真实数据库检查未开启。',
 '- Node语法检查与git diff --check通过。',
 '- Playwright实际浏览器使用本地API夹具（真实DeepSeek正文、模拟登录/词典/云库），核对生成、6个高亮词及中文提示、本地例句译文、收藏、点击词汇后才请求详细释义。生成后详细词典请求为0、例句翻译请求为0；点击一个词后详细词典请求为1，语境释义未被模拟词典的不同释义覆盖，收藏写入本地夹具成功。未操作真实账号、积分或数据库。', '',
 '浏览器请求记录：browser-qa.json；截图：../../output/playwright/mixed-a-desktop.png。代码文件SHA-256见code-snapshot.json。', '',
 '## 完整正文与具体 Prompt', '');
for(const row of rows){
 lines.push(`### ${row.id}（${row.words.length}词）`, '', `输入：${row.words.join(', ')}`, '', row.result.article, '',
  `语境词义：${row.words.map((word,i)=>`${word}（${row.result.glosses[i].pos} ${row.result.glosses[i].meaning}）`).join('；')}`, '',
  `实际提示词和响应：raw/${row.id}-1.prompt.txt、raw/${row.id}-1.response.txt${row.calls.length>1?`；raw/${row.id}-2.prompt.txt、raw/${row.id}-2.response.txt`:''}。`, '');
}
lines.push('### 当前基础 Prompt（6词，中级，普通长度）','','```text',buildMixedPrompt(rows[0].words,'中级',false),'```','');
fs.writeFileSync(path.join(__dirname,'REPORT.md'),lines.join('\n'));
console.log(JSON.stringify({verified:rows.length,firstPass:rows.filter(row=>row.calls.length===1).length,report:path.join(__dirname,'REPORT.md'),semanticAcceptance:'not passed'}));
