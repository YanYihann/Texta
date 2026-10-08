const fs = require('fs');
const path = require('path');
const {spawn} = require('child_process');
const dir = __dirname;
const codex = 'C:\\Users\\19633\\AppData\\Local\\Programs\\OpenAI\\Codex\\bin\\codex.exe';
const model = 'gpt-6.1-sol';
const effort = 'high';
const datasets = [
  {id:'theme-6',name:'主题词表 · 6词',words:['sustainable','resilient','adapt','perspective','thrive','balance']},
  {id:'mixed-12',name:'混合难词 · 12词',words:['budget','relax','process','standard','attitude','motivation','derive','sterility','plume','bristle','cricket','expenses']},
  {id:'long-24',name:'地理天气与行动 · 24词',words:['granite','terrain','arctic','deteriorate','gulf','meteorology','thermal','tropics','arid','humid','hail','thaw','shiver','budget','relax','process','standard','attitude','motivation','cover','reject','derive','contribute','expenses']}
];
fs.mkdirSync(path.join(dir,'raw'),{recursive:true});
fs.mkdirSync(path.join(dir,'isolated'),{recursive:true});
fs.writeFileSync(path.join(dir,'datasets.json'),JSON.stringify(datasets,null,2));
const common = `你正在执行 Texta 的词汇短文生成实验。只生成文本，不使用工具，不读取文件，不查询外部信息，不解释过程。\n目标：所有输入词最终嵌入一篇自然中文小短文；事件链顺畅，中文只承担必要连接作用。难度：中级。\n必须覆盖全部目标词，各词优先使用一次，不列词表、不写词典解释、不用“记录了这些词”式句子凑覆盖。\n第一句就使用目标词。每句话至少使用一个目标词；能自然容纳时优先每句2–4个词。\n选择一个可信的场景，词表随机时仍让事件存在合理联系。只保留理解行动和因果所必需的信息。\n不添加风景铺垫、无关人物介绍、闲聊、重复信息、结尾感悟或总结。尽可能短，但不得为压缩而删除目标词或破坏语义。\n`;
function directPrompt(data){
 const mapping=data.words.map((w,i)=>`⟦T${i+1}⟧ = ${w}`).join('\n');
 return common+`\n方法A：直接写中文记忆故事，在每个目标词的自然位置使用对应占位符。所有占位符之外的正文必须是中文。不得直接写出英文目标词。不得在占位符旁重复对应中文释义。\n必须完整保留每个占位符，最终由代码替换为输入原词。\n只输出JSON：{"title":"中文标题","article":"带占位符的中文短文"}\n映射：\n${mapping}`;
}
function englishPrompt(data){
 const mapping=data.words.map((w,i)=>`<w${i+1}>${w}</w${i+1}>`).join('\n');
 return common+`\n方法B第一步：先写一个紧凑的英文微型故事。此步正文全部使用英文，目标词必须位于各自的标签内，标签内容使用下方给出的原词。英文句子语法应正确，尽量自然，不要求固定句数，不扩写为雅思长文章。\n每个目标词及其标签至少出现一次；标签编号不得变化。\n只输出JSON：{"title":"English title","article":"英文微型故事"}\n目标词及标签：\n${mapping}`;
}
function translatePrompt(data,english){
 return `你正在执行 Texta 的词汇短文生成实验。只生成文本，不使用工具，不读取文件，不查询外部信息，不解释过程。\n方法B第二步：把给定带标签的英文微型故事翻译成紧凑自然的中文。\n要求：\n1. 必须保留所有<wN>...</wN>标签及编号，不新增、不删除、不合并标签。\n2. 标签内的英文也翻译成其在故事中的中文意思；标签内只放对应目标词的中文译义。\n3. 可以调整中文语序，使标签所在位置自然，并适合随后由代码替换回英文原词。\n4. 保留事件和因果关系，不扩写，不添加背景、闲聊、描写或感悟。\n5. 只保留必要中文连接文字，避免在标签外重复标签内已有的意思。\n6. 第一篇幅单位就含目标词，每句话至少包含一个标签。\n7. 在保持语义完整和标签齐全的前提下尽可能短。\n只输出JSON：{"title":"中文标题","article":"带标签的中文短文"}\n目标词总数：${data.words.length}\n英文故事JSON：\n${JSON.stringify(english)}`;
}
function parseJSON(text){
 let cleaned=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 try{return JSON.parse(cleaned)}catch{}
 const a=cleaned.indexOf('{'),b=cleaned.lastIndexOf('}');
 if(a>=0&&b>a)return JSON.parse(cleaned.slice(a,b+1));
 throw new Error('Invalid JSON');
}
async function invoke(name,prompt){
 fs.writeFileSync(path.join(dir,'raw',`${name}.prompt.txt`),prompt);
 const start=performance.now();
 const child=spawn(codex,['exec','--ignore-user-config','--ephemeral','--skip-git-repo-check','--json','--color','never','--model',model,'-c',`model_reasoning_effort="${effort}"`,'-c','model_provider="experiment_https"','-c','model_providers.experiment_https={name="OpenAI",base_url="https://chatgpt.com/backend-api/codex",wire_api="responses",requires_openai_auth=true,supports_websockets=false}','--cd',path.join(dir,'isolated'),'-'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
 let stdout='',stderr='';
 child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
 fs.writeFileSync(path.join(dir,'raw',`${name}.events.jsonl`),'');
 fs.writeFileSync(path.join(dir,'raw',`${name}.stderr.txt`),'');
 child.stdout.on('data',s=>{stdout+=s;fs.appendFileSync(path.join(dir,'raw',`${name}.events.jsonl`),s)});
 child.stderr.on('data',s=>{stderr+=s;fs.appendFileSync(path.join(dir,'raw',`${name}.stderr.txt`),s)});
 child.stdin.end(prompt,'utf8');
 const timer=setTimeout(()=>child.kill(),180000);
 const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve)});
 clearTimeout(timer);
 const seconds=+(performance.now()-start).toFixed(0)/1000;
 fs.writeFileSync(path.join(dir,'raw',`${name}.events.jsonl`),stdout);
 fs.writeFileSync(path.join(dir,'raw',`${name}.stderr.txt`),stderr);
 const events=stdout.split(/\r?\n/).filter(Boolean).map(line=>{try{return JSON.parse(line)}catch{return {raw:line}}});
 const messages=events.filter(e=>e.type==='item.completed'&&e.item?.type==='agent_message').map(e=>e.item.text);
 const text=messages.at(-1)||'';
 const completed=events.findLast(e=>e.type==='turn.completed');
 const error=events.findLast(e=>e.type==='error'||e.type==='turn.failed');
 const result={name,model,effort,seconds,exitCode:code,usage:completed?.usage||null,toolItems:events.filter(e=>e.item&&e.item.type!=='agent_message'&&e.item.type!=='reasoning').map(e=>e.item.type),text,error:error||null};
 fs.writeFileSync(path.join(dir,'raw',`${name}.result.json`),JSON.stringify(result,null,2));
 if(code!==0||!completed||!text)throw new Error(`${name} failed: ${JSON.stringify(error)||stderr.slice(-1000)}`);
 result.parsed=parseJSON(text);
 console.log(JSON.stringify({finished:name,seconds,usage:result.usage}));
 return result;
}
function restoreA(text,words){return text.replace(/⟧(?=⟦T\d+⟧)/g,'$& ').replace(/⟦T(\d+)⟧/g,(m,n)=>words[Number(n)-1]||m)}
function restoreB(text,words){return text.replace(/<\/w\d+>(?=<w\d+>)/g,'$& ').replace(/<w(\d+)>([\s\S]*?)<\/w\1>/g,(m,n)=>words[Number(n)-1]||m)}
function metrics(text,words){
 const cn=s=>(s.match(/[\u4e00-\u9fff]/g)||[]).length;
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const hits=words.map(word=>({word,count:[...text.matchAll(new RegExp(`(?<![A-Za-z])${escape(word)}(?![A-Za-z])`,'gi'))].length}));
 const all=[...text.matchAll(new RegExp(words.slice().sort((a,b)=>b.length-a.length).map(w=>`(?<![A-Za-z])${escape(w)}(?![A-Za-z])`).join('|'),'gi'))];
 const gaps=all.slice(1).map((x,i)=>cn(text.slice(all[i].index+all[i][0].length,x.index)));
 const sentences=text.split(/[。！？!?]+/).map(s=>s.trim()).filter(Boolean);
 const englishTokens=text.match(/[A-Za-z][A-Za-z'-]*/g)||[];
 const allowed=new Set(words.map(w=>w.toLowerCase()));
 return {coverage:`${hits.filter(x=>x.count>0).length}/${words.length}`,missing:hits.filter(x=>!x.count).map(x=>x.word),repeats:hits.filter(x=>x.count>1),chineseChars:cn(text),totalChars:[...text].length,sentences:sentences.length,leadChineseChars:all.length?cn(text.slice(0,all[0].index)):cn(text),tailChineseChars:all.length?cn(text.slice(all.at(-1).index+all.at(-1)[0].length)):0,maxGapChineseChars:gaps.length?Math.max(...gaps):0,chineseOnlySentences:sentences.filter(s=>!words.some(w=>new RegExp(`(?<![A-Za-z])${escape(w)}(?![A-Za-z])`,'i').test(s))).length,unexpectedEnglish:[...new Set(englishTokens.filter(w=>!allowed.has(w.toLowerCase())))]};
}
function sumUsage(runs){const out={};for(const run of runs)for(const [k,v]of Object.entries(run.usage||{}))if(typeof v==='number')out[k]=(out[k]||0)+v;return out}
async function main(){
 const results=[];
 for(const [i,data]of datasets.entries()){
  let a,b1,b2;
  if(i%2===0){a=await invoke(`${data.id}-A`,directPrompt(data));b1=await invoke(`${data.id}-B1`,englishPrompt(data));b2=await invoke(`${data.id}-B2`,translatePrompt(data,b1.parsed));}
  else{b1=await invoke(`${data.id}-B1`,englishPrompt(data));b2=await invoke(`${data.id}-B2`,translatePrompt(data,b1.parsed));a=await invoke(`${data.id}-A`,directPrompt(data));}
  const textA=restoreA(a.parsed.article,data.words),textB=restoreB(b2.parsed.article,data.words);
  const idsA=[...a.parsed.article.matchAll(/⟦T(\d+)⟧/g)].map(m=>Number(m[1]));
  const idsB1=[...b1.parsed.article.matchAll(/<w(\d+)>/g)].map(m=>Number(m[1]));
  const idsB2=[...b2.parsed.article.matchAll(/<w(\d+)>/g)].map(m=>Number(m[1]));
  const row={dataset:data,A:{text:textA,metrics:metrics(textA,data.words),seconds:a.seconds,usage:sumUsage([a]),ids:idsA},B:{english:b1.parsed.article,translated:b2.parsed.article,text:textB,metrics:metrics(textB,data.words),seconds:+(b1.seconds+b2.seconds).toFixed(3),usage:sumUsage([b1,b2]),idsEnglish:idsB1,idsChinese:idsB2},calls:[a,b1,b2].map(({text,parsed,...rest})=>rest)};
  results.push(row);
  fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify({date:'2026-10-06',model,effort,notes:'One initial sample per method and dataset. No repairs or manual edits. CLI usage includes harness/context/reasoning overhead. Wall time includes CLI startup and service latency.',results},null,2));
  console.log(JSON.stringify({dataset:data.id,A:row.A.metrics,B:row.B.metrics}));
 }
}
module.exports={restoreA,restoreB,metrics};
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1});
