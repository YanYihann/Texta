const fs=require('node:fs'),path=require('node:path');
const {invoke,tracing,adminSummary}=require('./run.cjs');
const {parseMixedResponse}=require('../../generation/mixed.cjs');
async function main(){
 const rows=JSON.parse(fs.readFileSync(path.join(__dirname,'results.json'),'utf8')).results.filter(row=>['mixed-12','long-24','new-random-15'].includes(row.id));
 const out=[];
 for(const row of rows){
  const original=JSON.parse(fs.readFileSync(path.join(__dirname,'raw',`${row.id}-${row.calls.length}.response.txt`),'utf8'));
  const prompt=[
   '编辑下面的中文词汇故事，使它变成一个明确、顺畅、可信的短事件。不要输出分析或计划。',
   '先将每个标记读作其中的中文词义，检查语法和因果；消除错误搭配和无关片段。所有人物行动必须围绕同一具体目标。',
   '保持全部输入英文词、词性、义项和标记格式，不能通过删除难词改善文章。每个词都应是问题、操作对象、行动、证据或结果的一部分，不是顺路看到的东西。',
   '必要时重新选择一个能容纳全部词的具体场景。不要用泛泛的工作、心情、做完任务来串词。具体写清问题和解决动作，保持简短。',
   '只输出JSON：{"vocabulary":原vocabulary数组,"title":"中文标题","article":"修正后的含标记中文短文"}。',
   JSON.stringify(original)
  ].join('\n');
  const trace={calls:[]},start=Date.now();
  const text=await tracing.run(trace,()=>invoke(prompt,{model:'deepseek-v3.2',maxTokens:3000,temperature:0.4,step:'experimental_content_edit'}));
  const result=parseMixedResponse(text,row.words,row.quickMode);
  out.push({id:row.id,seconds:(Date.now()-start)/1000,result,diagnostics:adminSummary(trace),text,prompt});
  fs.writeFileSync(path.join(__dirname,'review-results.json'),JSON.stringify(out,null,2));
  console.log(JSON.stringify(out.at(-1)));
 }
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
