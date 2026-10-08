// Text-only Codex samples. No .env, Texta API, provider key or DeepSeek requests.
const fs=require('node:fs'),path=require('node:path');
const {invoke}=require('../bilingual-2026-10-06/run.cjs');
const {buildMixedPrompt,parseMixedResponse,limitsFor}=require('../../generation/mixed.cjs');
const cases=[
  {id:'anatomy-11',words:['stature','flesh','skull','eyelash','gorge','palm','abdomen','rib','liver','womb','kidney'],shortMode:false},
  {id:'random-12-short',words:['budget','relax','process','standard','attitude','motivation','derive','sterility','plume','bristle','cricket','expenses'],shortMode:true}
];
Promise.all(cases.map(async sample=>{
  const prompt=buildMixedPrompt(sample.words,sample.shortMode);
  const call=await invoke('mixed-story-'+sample.id,prompt);
  const parsed=parseMixedResponse(call.text,sample.words,sample.shortMode);
  fs.writeFileSync(path.join(__dirname,sample.id+'.prompt.txt'),prompt);
  const result={...sample,limits:limitsFor(sample.words,sample.shortMode),call,parsed};
  fs.writeFileSync(path.join(__dirname,sample.id+'.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({id:sample.id,seconds:call.seconds,chineseChars:parsed.chineseChars,issues:parsed.issues,article:parsed.article}));
  return result;
})).then(results=>fs.writeFileSync(path.join(__dirname,'results.json'),JSON.stringify({date:'2026-10-06',model:'gpt-6.1-sol',effort:'high',notes:'Two text-only Codex samples. No Texta or DeepSeek API calls. CLI elapsed time is not website generation latency.',results},null,2)))
.catch(error=>{console.error(error.stack);process.exitCode=1;});
