const fs=require('fs'),path=require('path');
const dir=__dirname;
const r=JSON.parse(fs.readFileSync(path.join(dir,'results.json'),'utf8'));
const rows=r.results;
const out=[];
out.push('# Texta 两种中英混合生成方法的初步对照实验','',`日期：${r.date}。模型：\`${r.model}\`。推理档位：\`${r.effort}\`。`,'',
'本次从当前 Codex 聊天的本地 turn_context 核对模型及推理档位，再用 Codex CLI 的独立临时调用执行实验。没有使用项目中的 DeepSeek API，没有修改生产代码。',
'',
'正式实验所有调用都使用同一临时 HTTPS provider 配置，认证及后端仍是原 ChatGPT/Codex 账号和 https://chatgpt.com/backend-api/codex，模型与推理档位保持不变。配置只通过实验进程命令参数传入，没有改用户全局配置。此前出现 WebSocket 超时后回退 HTTPS 的预检保存在 raw/preflight-*，不纳入下表。配置依据：[OpenAI 官方配置参考](https://learn.chatgpt.com/docs/config-file/config-reference)。',
'',
'A：一次直接生成带占位符的中文混合故事，代码替换为英文目标词。',
'',
'B：先生成带词语标签的英文微型故事，再独立调用模型翻译成保留标签的中文，代码替换为英文目标词。',
'',
'两种方法共享覆盖全部目标词、同一可信场景、首句使用目标词、每句至少一个目标词、尽量减少背景和感悟等要求。两者都没有固定句数、固定词数，不包含词库生成、独立用法规划、语义复审、内容修复或词典详情预取。因此 A 是精简的直接生成，不是现有网站整条管线。',
'',
'每组每种方法仅首次生成一次；不重试、不手工修改正文。测试顺序为第一组 A→B、第二组 B→A、第三组 A→B。未固定随机种子；本次只能说明样例表现，不能估计稳定成功率。',
'',
'测试中发现两个目标标记紧邻时，简单替换会把英文词粘连（例如 sterilitystandard）。下表与最终正文对 A/B 统一应用一个纯代码边界保护：相邻目标标记之间插入一个空格，随后还原英文。原始粘连正文和修复前指标都保存在 results.json 的 textRaw/metricsRaw 中；未调用模型修复，也没有改写任何语义内容。',
'',
'## 数值结果','',
'| 词表 | 方法 | 原始覆盖 | 边界保护后覆盖 | 中文汉字 | 句数 | 最大两词间中文 | 开头中文 | 无目标词句子 | 墙钟秒数 | 输入 tokens | 缓存输入 tokens | 输出 tokens | 其中推理 tokens | 输入+输出 tokens |',
'|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for(const row of rows)for(const method of ['A','B']){
 const x=row[method],m=x.metrics,u=x.usage;
 out.push(`| ${row.dataset.id} | ${method} | ${x.metricsRaw?.coverage||m.coverage} | ${m.coverage} | ${m.chineseChars} | ${m.sentences} | ${m.maxGapChineseChars} | ${m.leadChineseChars} | ${m.chineseOnlySentences} | ${x.seconds.toFixed(2)} | ${u.input_tokens??'未提供'} | ${u.cached_input_tokens??'未提供'} | ${u.output_tokens??'未提供'} | ${u.reasoning_output_tokens??'未提供'} | ${(u.input_tokens||0)+(u.output_tokens||0)} |`);
}
out.push('',
'中文汉字、句数和覆盖只统计最终正文，不统计标题。覆盖按项目同样的“不区分大小写、字母边界”规则检查；中文译文不算覆盖。中文汉字数不等同于无关信息数量，也不等同于 token 数。',
'',
'耗时包括 CLI 进程启动、请求、服务端等待和生成；B 为两个串行进程的耗时之和，不是纯模型解码耗时。token 数取 turn.completed 的 usage，包含 Codex 基础上下文，输出量可能包含推理开销；缓存输入是输入 tokens 的子集，不另外相加。这些数值不能直接代入项目 API 账单或承诺线上性能。',
'',
'## 原始内容对照');
for(const row of rows){
 out.push('',`### ${row.dataset.name}`,'','输入词：','',`\`${row.dataset.words.join(', ')}\``,
 '', '**A：直接混合生成，代码替换后的正文**','',row.A.text,
 '', '**B：英文先行，代码替换后的正文**','',row.B.text,
 '', '**B 的英文中间稿**','', '```text',row.B.english,'```',
 '', '**B 的带标签中文译稿**','', '```text',row.B.translated,'```',
 '', '**自动检查**','',
 `- A 缺词：${row.A.metrics.missing.join(', ')||'无'}；重复：${JSON.stringify(row.A.metrics.repeats)}；额外英文：${row.A.metrics.unexpectedEnglish.join(', ')||'无'}。`,
 `- B 缺词：${row.B.metrics.missing.join(', ')||'无'}；重复：${JSON.stringify(row.B.metrics.repeats)}；额外英文：${row.B.metrics.unexpectedEnglish.join(', ')||'无'}。`,
 `- B 英文标签编号：${row.B.idsEnglish.join(', ')}；中文标签编号：${row.B.idsChinese.join(', ')}。`
 );
 if(row.A.textRaw&&row.A.textRaw!==row.A.text)out.push('', '**A 边界保护前的原始替换结果**','',row.A.textRaw);
 if(row.B.textRaw&&row.B.textRaw!==row.B.text)out.push('', '**B 边界保护前的原始替换结果**','',row.B.textRaw);
}
out.push('', '## 完整提示词与复现','',
'每次实际提示词保存为 raw/*.prompt.txt；完整 CLI 事件为 raw/*.events.jsonl；逐次耗时、usage 和最终输出为 raw/*.result.json。datasets.json 保存三组词表，results.json 保存结构化对照结果。',
'',
'```powershell',
'node experiments/mixed-generation-2026-10-06/run.cjs',
'node experiments/mixed-generation-2026-10-06/finalize.cjs',
'node experiments/mixed-generation-2026-10-06/verify.cjs',
'node experiments/mixed-generation-2026-10-06/report.cjs',
'```',
'',
'run.cjs 会重新进行9次 Codex 调用并覆盖本目录结果，消耗当前账号额度。报告脚本只读取已有结果，不调用模型。',
'',
'## 结论边界','',
'中文更短不代表故事更自然；英文中间稿也不必然提高最终中文故事质量。词义与语法应结合上面的原始文本人工判断。本次没有测长期记忆效果，也不能把 GPT 模型的结果外推到项目中的 DeepSeek 模型。');
fs.writeFileSync(path.join(dir,'REPORT.md'),out.join('\n')+'\n');
console.log(JSON.stringify(rows.map(row=>({id:row.dataset.id,A:row.A,B:row.B})),null,2));
