const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {invoke,datasets}=require('./run.cjs');
const {buildBilingualPrompt,parseBilingualResponse,bilingualLimits}=require('../../generation/bilingual.cjs');
const results=Array(datasets.length).fill(null);
const pass=process.env.TEXTA_EXPERIMENT_PASS||'final';
const engineSha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../../generation/bilingual.cjs'))).digest('hex');
let next=0;
async function worker(){
  while(next<datasets.length){
    const index=next++,data=datasets[index],calls=[];let parsed;
    for(let attempt=0;attempt<2;attempt++){
      const prompt=buildBilingualPrompt(data.words,!!data.shortMode,parsed?.issues||[]);
      const raw=await invoke(`${pass}-${data.id}-${attempt+1}`,prompt);
      parsed=parseBilingualResponse(raw.text,data.words,!!data.shortMode);
      calls.push({...raw,promptChars:prompt.length});if(!parsed.issues.length)break;
    }
    results[index]={...data,limits:bilingualLimits(data.words,!!data.shortMode),calls,parsed};
    fs.writeFileSync(path.join(__dirname,`${pass}-results.json`),JSON.stringify({date:'2026-10-06',model:'gpt-6.1-sol',effort:'high',engineSha256,
      notes:'Signed-in Codex only; no Texta API requests or .env keys. Two independent sample requests run concurrently. CLI tokens/time include harness, reasoning and service latency; do not represent production DeepSeek performance. Initial prompt trials are retained separately.',results:results.filter(Boolean)},null,2));
    console.log(JSON.stringify({id:data.id,calls:calls.length,seconds:calls.reduce((n,c)=>n+c.seconds,0),words:parsed.englishWords,issues:parsed.issues}));
  }
}
Promise.all([worker(),worker()]).catch(error=>{console.error(error.stack);process.exitCode=1;});
