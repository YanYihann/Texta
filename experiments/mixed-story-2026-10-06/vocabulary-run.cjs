const fs=require('node:fs'),path=require('node:path');
const {invoke}=require('../bilingual-2026-10-06/run.cjs');
const {buildVocabularyPrompt,parseVocabularyResponse}=require('../../generation/vocabulary.cjs');
const words=['stature','flesh','skull','eyelash','gorge','womb'];
(async()=>{
  const prompt=buildVocabularyPrompt(words),call=await invoke('persistent-vocabulary-6',prompt);
  const parsed=parseVocabularyResponse(call.text,words);
  fs.writeFileSync(path.join(__dirname,'vocabulary-sample.json'),JSON.stringify({words,prompt,call,parsed,notes:'Codex text sample only. No Texta or DeepSeek requests.'},null,2));
  console.log(JSON.stringify({issues:parsed.issues,entries:parsed.entries}));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
