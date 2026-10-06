const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {createVocabularyDetails,parseVocabularyResponse}=require('../generation/vocabulary.cjs');
const card=word=>({word,pos:'n.',usIpa:'/test/',ukIpa:'/test/',meanings:['常用词义'],collocations:['common phrase · 常用搭配'],wordFormation:'整体词，无明显可拆分的构词部分',synonyms:[],antonyms:[]});
function database() {
  const store=new Map();
  return {store,vocabularyDetail:{
    findMany:async({where})=>where.wordKey.in.map(key=>store.get(key)).filter(Boolean),
    upsert:async({where,create,update})=>{const row=store.has(where.wordKey)?{...store.get(where.wordKey),...update}:structuredClone(create);store.set(where.wordKey,row);return row;}
  }};
}
const wordsFromPrompt=prompt=>JSON.parse(prompt.split('\n').find(line=>line.startsWith('[')));

test('completed cards tolerate genuinely unavailable IPA/antonyms without triggering regeneration',()=>{
  const item=card('take care of');item.usIpa='';item.ukIpa='';
  const parsed=parseVocabularyResponse(JSON.stringify([item]),['take care of']);
  assert.deepEqual(parsed.issues,[]);assert.equal(parsed.entries[0].detailsReady,true);
  for(const bad of ['{}','not JSON',JSON.stringify([{...card('wrong')}]),JSON.stringify([{...card('budget'),meanings:['词义待补充']}]),
    JSON.stringify([{...card('budget'),usIpa:'拼读'}]),JSON.stringify([{...card('budget'),collocations:[]}])]) {
    assert.ok(parseVocabularyResponse(bad,['budget']).issues.length);
  }
});

test('database cards survive a new service instance, model changes, casing and mixed cached/new input',async()=>{
  const db=database();let calls=0,requested=[];
  const callText=async(prompt,options)=>{calls++;requested.push(wordsFromPrompt(prompt));assert.equal(options.retryCount,0);return JSON.stringify(requested.at(-1).map(card));};
  const first=createVocabularyDetails({db,callText});
  const initial=await first.getMany(['Budget','process'],'model-1');
  assert.equal(calls,1);assert.equal(db.store.size,2);assert.equal(initial[0].word,'Budget');
  const restarted=createVocabularyDetails({db,callText});
  const repeated=await restarted.getMany(['budget','PROCESS','cover'],'model-2');
  assert.equal(calls,2);assert.deepEqual(requested[1],['cover']);assert.equal(repeated[1].word,'PROCESS');
  assert.deepEqual(repeated[0].senses,initial[0].senses);
  await restarted.getMany(['budget','cover','budget'],'model-3');assert.equal(calls,2);
});

test('overlapping concurrent preparations generate each uncached word once',async()=>{
  const db=database(),requested=[];let release;
  const barrier=new Promise(resolve=>release=resolve);
  const service=createVocabularyDetails({db,callText:async prompt=>{const words=wordsFromPrompt(prompt);requested.push(...words);await barrier;return JSON.stringify(words.map(card));}});
  const a=service.getMany(['budget','process'],'mock'),b=service.getMany(['process','cover'],'mock');
  await new Promise(resolve=>setImmediate(resolve));release();
  const [left,right]=await Promise.all([a,b]);
  assert.deepEqual(requested.sort(),['budget','cover','process']);
  assert.deepEqual(left[1],right[0]);assert.equal(db.store.size,3);
});

test('bad responses are never saved, errors release pending words, and persistence failure propagates',async()=>{
  const db=database();let valid=false,calls=0;
  const service=createVocabularyDetails({db,callText:async prompt=>{calls++;return valid?JSON.stringify(wordsFromPrompt(prompt).map(card)):'{}';}});
  await assert.rejects(service.getMany(['budget'],'mock'),/未通过检查/);assert.equal(calls,2);assert.equal(db.store.size,0);
  valid=true;await service.getMany(['budget'],'mock');assert.equal(calls,3);
  db.vocabularyDetail.upsert=async()=>{throw Error('database unavailable');};
  await assert.rejects(service.getMany(['new-word'],'mock'),/database unavailable/);
  assert.equal(db.store.size,1);
});

test('large preparations use at most two twelve-word batches concurrently and preserve order',async()=>{
  const db=database(),batches=[];let active=0,peak=0;
  const service=createVocabularyDetails({db,callText:async prompt=>{
    const words=wordsFromPrompt(prompt);batches.push(words);peak=Math.max(peak,++active);
    await new Promise(resolve=>setImmediate(resolve));active--;return JSON.stringify(words.map(card));
  }});
  const words=Array.from({length:25},(_,index)=>'word'+index),result=await service.getMany(words,'mock');
  assert.deepEqual(batches.map(batch=>batch.length),[12,12,1]);assert.equal(peak,2);
  assert.deepEqual(result.map(entry=>entry.word),words);assert.equal(db.store.size,25);
  db.store.get('word0').version=0;await service.getMany(['word0','word1'],'mock');
  assert.deepEqual(batches.at(-1),['word0']);assert.equal(db.store.get('word0').version,1);
});

test('generation starts story and uncached vocabulary concurrently and returns only when both are ready',async()=>{
  const source=fs.readFileSync('server.js','utf8');
  const start=source.indexOf('    const generateContent = async () => {',source.indexOf('app.post("/api/generate",'));
  const end=source.indexOf('    const generated = isAdmin',start);
  let resolveStory,resolveCards,storyStarted=false,cardsStarted=false,finished=false;
  const story=new Promise(resolve=>resolveStory=resolve),cards=new Promise(resolve=>resolveCards=resolve);
  const context=vm.createContext({words:['budget'],selectedModel:'mock',generateStory:()=>{storyStarted=true;return story;},
    vocabularyDetails:{getMany:()=>{cardsStarted=true;return cards;}}});
  const work=vm.runInContext(source.slice(start,end)+'generateContent();',context).then(result=>{finished=true;return result;});
  assert.ok(storyStarted && cardsStarted);resolveStory({contextGlosses:[{pos:'v.',contextMeaning:'安排预算'}]});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(finished,false);
  resolveCards([{word:'budget',pos:'n.',senses:[{meaning:'预算'}],detailsReady:true}]);
  const result=await work;assert.equal(result.lexicon[0].pos,'v.');assert.equal(result.lexicon[0].senses[0].meaning,'安排预算');
  assert.equal(result.baseLexicon[0].pos,'n.');assert.equal(result.lexicon[0].detailsReady,true);
});

test('article clicks select saved cards without fetching; ready cards do not hydrate empty optional fields',()=>{
  const source=fs.readFileSync('public/app.js','utf8');let selected;
  const context=vm.createContext({readingMode:true,updateGlossaryFollow:keys=>selected=keys[0],document:{dispatchEvent:()=>{}},CustomEvent:class{},
    ensureVocabDetailForKey:()=>{throw Error('Clicked card must not generate');},needsDetailHydration:()=>true,needsPronunciationHydration:()=>true});
  for(const name of ['jumpToGlossaryKey','needsVocabHydration']){
    const start=source.indexOf('function '+name+'('),next=source.indexOf('\nfunction ',start+1);
    vm.runInContext(source.slice(start,next),context);
  }
  context.jumpToGlossaryKey('budget');assert.equal(selected,'budget');assert.equal(context.needsVocabHydration({detailsReady:true}),false);
  assert.equal(context.needsVocabHydration({}),true);
});

test('legacy batch preparation requires authentication, validates input and returns ready cached entries',async()=>{
  const source=fs.readFileSync('server.js','utf8'),start=source.indexOf('app.post("/api/vocab/details",'),end=source.indexOf('app.post("/api/generate",',start);
  let handler,called=0,allowed=true;
  const context=vm.createContext({app:{post:(_,fn)=>handler=fn},requireAuth:async()=>allowed?{id:'learner'}:null,
    normalizeInputWordToken:word=>String(word).trim().match(/^[A-Za-z ]+$/)?String(word).trim():'',OPENAI_MODEL_NORMAL:'mock',
    vocabularyDetails:{getMany:async words=>{called++;return words.map(word=>({word,detailsReady:true}));}}});
  vm.runInContext(source.slice(start,end),context);
  const call=async words=>{let status=200,body;const res={status:s=>{status=s;return res;},json:b=>body=b};await handler({body:{words}},res);return {status,body};};
  allowed=false;await call(['budget']);assert.equal(called,0);allowed=true;
  for(const words of [[],null,['<bad>'],[123],Array(121).fill('word')])assert.equal((await call(words)).status,400);
  assert.equal(called,0);const valid=await call(['budget','process']);assert.equal(valid.status,200);
  assert.equal(called,1);assert.equal(valid.body.entries[1].detailsReady,true);
});

test('frontend notebook normalization preserves full-card readiness, meanings and optional empty antonyms',()=>{
  const source=fs.readFileSync('public/app.js','utf8'),start=source.indexOf('function normalizeNotebookEntry('),end=source.indexOf('\nfunction ',start+1);
  const context=vm.createContext({keyifyWord:word=>word.toLowerCase(),sanitizeGlossTextForUi:value=>value,normalizePosTagLabel:value=>value,
    resolveIpaFromItem:(item,accent)=>item[accent+'Ipa']||'',sanitizeSenseRowsForUi:rows=>rows,sanitizeTextListForUi:rows=>rows||[],normalizeIsoDate:value=>value});
  vm.runInContext(source.slice(start,end),context);
  const ready=parseVocabularyResponse(JSON.stringify([card('budget')]),['budget']).entries[0];
  const restored=context.normalizeNotebookEntry(ready);
  assert.equal(restored.detailsReady,true);assert.equal(restored.usIpa,ready.usIpa);
  assert.deepEqual(restored.baseMeanings,ready.baseMeanings);assert.deepEqual(restored.antonyms,[]);
});
