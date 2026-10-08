const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {parseMixedResponse,buildMixedPrompt}=require('../../generation/mixed.cjs');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'results.json'),'utf8'));
const lines=['# 小明混合故事：较完整篇幅测试','',
  '2026-10-06。只调用登录态 Codex gpt-6.1-sol / high 生成两组文本，没有调用 Texta API、DeepSeek API 或读取项目密钥。CLI耗时包含启动、服务等待和推理，不代表网站速度。',
  '', '引擎 SHA256：'+crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../../generation/mixed.cjs'))).digest('hex'),
  '', '截图11词普通模式：219汉字、3段；随机12词短文模式：162汉字、2段。均一次模型生成，全部词汇命中并通过解析器。人工检查了词义、故事因果、动机及结果，不能据此保证所有输入都成功。',
  '', '程序检查：混合10项、双语6项、句子翻译合同和计费检查通过；真实数据库计费集成检查因未配置测试数据库跳过。',
  '', '本次移除了密集填词限制，增加小明主角和整体篇幅下限，保留一次生成、最多一次重生成、失败退款。'];
for(const row of data.results){
  const prompt=fs.readFileSync(path.join(__dirname,row.id+'.prompt.txt'),'utf8');
  if(prompt!==buildMixedPrompt(row.words,row.shortMode))throw Error('Prompt drift');
  const parsed=parseMixedResponse(row.call.text,row.words,row.shortMode);
  if(parsed.issues.length)throw Error(parsed.issues.join(';'));
  lines.push('', '## '+row.id,'',row.words.join(', '),'',
    `篇幅：${parsed.chineseChars}汉字；目标：${row.limits.minChinese}–${row.limits.maxChinese}；CLI耗时：${row.call.seconds}秒（不是网站速度）。`,
    '', parsed.article, '', '语境词义：'+row.words.map((word,index)=>`${word}：${parsed.glosses[index].pos} ${parsed.glosses[index].meaning}`).join('；'),
    '', '完整应用prompt：','', '```text',prompt,'```');
}
fs.writeFileSync(path.join(__dirname,'REPORT.md'),lines.join('\n'));
console.log('Verified both saved samples and current prompts. REPORT.md written.');
