const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {buildBilingualPrompt,parseBilingualResponse}=require('../../generation/bilingual.cjs');
const file=path.join(__dirname,'accepted-results.json'),data=JSON.parse(fs.readFileSync(file,'utf8'));
const digest=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../../generation/bilingual.cjs'))).digest('hex');
if(digest!==data.engineSha256)throw Error('Engine changed after final model test');
if(data.results.length!==8)throw Error('Final dataset incomplete');
for(const row of data.results){row.parsed=parseBilingualResponse(row.calls.at(-1).text,row.words,!!row.shortMode);if(row.parsed.issues.length)throw Error(row.id+': '+row.parsed.issues.join(';'));}
const sum=(row,key)=>row.calls.reduce((n,c)=>n+(c.usage?.[key]||0),0);
const lines=['# 双语文章重构：Codex模型实验','',
  '2026-10-06。最终使用当前对话配置的gpt-6.1-sol，high推理强度。所有生成样例通过Codex登录执行，未读取Texta的.env或API key，未调用用户的API/DeepSeek服务。网页检查使用127.0.0.1本地模拟服务。未部署到线上。','',
  '## 结果与边界','',
  '下表是最终固定版本的8组测试，包含一组同词表的独立重复样例。词汇覆盖、句对编号、原词边界、词性格式、标记完整性和长度检查均通过。覆盖通过不等于语义一定正确；本轮同时人工阅读故事和译文。样本数不足以估计稳定成功率。初始版本及中间修订输出完整保留在results.json、final-results.json和raw目录，未混入最终统计。','',
  '| 样例 | 输入词 | 模式 | 模型调用 | 英文词数 | CLI总耗时秒 | 输入tokens | 输出tokens | 其中推理tokens |',
  '|---|---:|---|---:|---:|---:|---:|---:|---:|'];
for(const row of data.results)lines.push(`| ${row.id} | ${row.words.length}/${row.words.length} | ${row.shortMode?'短文':'普通'} | ${row.calls.length} | ${row.parsed.englishWords} | ${row.calls.reduce((n,c)=>n+c.seconds,0).toFixed(1)} | ${sum(row,'input_tokens')} | ${sum(row,'output_tokens')} | ${sum(row,'reasoning_output_tokens')} |`);
lines.push('',
  'CLI耗时包括进程启动、服务排队和high推理；输入token包含Codex系统环境，输出token包含推理。以上不是网站的API耗时或纯应用token预算，不能用于宣称DeepSeek提速/节省的百分比。新代码从词典→英文→翻译→对齐至少4个串行内容步骤，改为正常1次请求；仅检查失败时追加1次完整生成。完整词典不在生成阶段请求，例句译文直接复用。减少耗时和token的理由来自这些结构变化，实际改善需要后续真实服务验证。','',
  '## 内容检查','',
  '重点检查随机词表是否形成可以理解的任务，而不是词汇罗列；是否选用真实常用义项；是否有不自然的译义片段。早期模型把plume标成“缕”或“股”，已补充名词核心含义要求、通用名词短语示例和孤立量词校验后重新测试。未手工修改最终样例正文。短语及相似单词通过精确标记位置高亮，避免把art命中到article，或者把中文重复词语全部误高亮。','',
  '## 最终应用prompt（12词，普通模式）','','```text',buildBilingualPrompt(data.results.find(row=>row.id==='random-12').words,false),'```','',
  '实验额外在应用prompt前加了“这是文本生成测试。禁止使用工具、读取文件或联网，只按下面的生成要求输出JSON。”。这段不是网站prompt；Codex内部系统上下文也不属于网站生成输入。官方执行方式见[Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)。','',
  '## 所有最终样例','');
for(const row of data.results){lines.push('### '+row.id,'',`词表：${row.words.join(', ')}`,'',`标题：${row.parsed.title}`,'',row.parsed.article,'',row.parsed.paragraphsZh.join('\n\n'),'','语境释义：'+row.words.map((word,i)=>`${word}（${row.parsed.glosses[i].pos} ${row.parsed.glosses[i].meaning}）`).join('；'),'');}
lines.push('## 代码与验证','',`生成模块SHA256：${digest}`,'',
  'npm run test:bilingual：6项通过。npm run test:mixed：9项通过（包括两种模式的真实路由契约、失败退款与旧字段兼容）。test:context与test:library通过。test:billing：8项通过，真实数据库集成1项因未配置测试数据库跳过。浏览器结果记录在browser-qa.json，截图在output/playwright。','');
fs.writeFileSync(path.join(__dirname,'REPORT.md'),lines.join('\n'));
console.log(JSON.stringify({datasets:data.results.length,calls:data.results.reduce((n,r)=>n+r.calls.length,0),coverage:'all',engineSha256:digest}));
