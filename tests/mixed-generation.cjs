const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { AsyncLocalStorage } = require('node:async_hooks');
const { parseMixedResponse, generateMixedStory, limitsFor } = require('../generation/mixed.cjs');
const { generateBilingualStory } = require('../generation/bilingual.cjs');
const { bilingualAnswer } = require('./fixtures/bilingual.cjs');
const fullStory = article => '周五，小明答应在读书活动前修好工坊的旧桌子，却发现桌腿比预想中松得更厉害。\n\n' + article + '他先请邻居扶稳桌面，再检查松动的位置；虽然时间不多，但先解决关键问题，才能避免返工。换好零件后，他又放上几本厚书试了一遍，确认桌面不再摇晃。第二天，孩子们围坐着读书，他也放心地把工具收进箱子。';

function answer(article = '我们的<w1>预算</w1>有限，先完成<w2>流程</w2>。') {
  const words=['budget','process'];
  return JSON.stringify({ title: '修好仪器', article: fullStory(article.replace(/<w(\d+)>(.*?)<\/w\1>/g,(_,id,meaning)=>`⟦${words[id-1]||'extra'}|n.|${meaning}⟧`)),
    vocabulary: [{ word: 'budget', pos: 'n.', meaning: '预算' }, { word: 'process', pos: 'n.', meaning: '流程' }] });
}

test('adjacent tags retain exact English boundaries and matching contextual meanings', () => {
  const result = parseMixedResponse(answer('我们的<w1>预算</w1><w2>流程</w2>需要调整。'), ['Budget', 'process']);
  assert.deepEqual(result.issues, []);
  assert.equal(result.article, fullStory('我们的Budget process需要调整。'));
  assert.deepEqual(result.glosses.map(row => row.meaning), ['预算', '流程']);
});

test('malformed, missing, repeated, unknown, extra English, wrong meanings and verbose output are rejected', () => {
  for (const response of ['not JSON', '{"article":4,"glosses":[]}',
    answer('我们的<w1>预算</w1>有限。'),
    answer('我们的<w1>预算</w1>有限，<w1>预算</w1><w1>预算</w1><w2>流程</w2>都要改。'),
    answer('我们的<w1>预算</w1>有限，<w2>流程</w2><w3>标准</w3>都要改。'),
    answer('我们的<w1>预算</w1>limited，先完成<w2>流程</w2>。'),
    answer('我们的<w1>budget</w1>有限，先完成<w2>流程</w2>。'),
    answer('背'.repeat(300) + '<w1>预算</w1><w2>流程</w2>要调整。')]) {
    assert.ok(parseMixedResponse(response, ['budget', 'process']).issues.length, response);
  }
  const duplicateGloss = JSON.parse(answer()); duplicateGloss.vocabulary.push(duplicateGloss.vocabulary[0]);
  assert.ok(parseMixedResponse(JSON.stringify(duplicateGloss), ['budget', 'process']).issues.length);
  const repeatedMeaning = parseMixedResponse(answer('我们的<w1>预算</w1>预算有限，先完成<w2>流程</w2>。'), ['budget','process']);
  assert.equal(repeatedMeaning.article,fullStory('我们的budget有限，先完成process。'));
  assert.equal(repeatedMeaning.boundaryNormalizations,1);
});

test('phrases, capitalization, apostrophes and hyphens are restored verbatim', () => {
  const words = ['take care of', "don't", 'well-being'];
  const response = JSON.stringify({title:'照顾家人',article:fullStory("我⟦take care of|phr.|照顾⟧母亲，她说⟦don't|phr.|不要⟧忽视自己的⟦well-being|n.|身心健康⟧。"),
    vocabulary: [{word:words[0],pos:'phr.',meaning:'照顾'},{word:words[1],pos:'phr.',meaning:'不要'},{word:words[2],pos:'n.',meaning:'身心健康'}]});
  assert.equal(parseMixedResponse(response, words).article, fullStory("我take care of母亲，她说don't忽视自己的well-being。"));
});

test('a 120-word result is one story request and is not capped by the former fixed token budget', async () => {
  const words = Array.from({ length:120 }, (_, index) => `word-${index}`);
  const response = JSON.stringify({title:'同一任务', article: '小明负责修好工坊的桌子。' + words.map(word => `他先检查⟦${word}|n.|材料⟧，确认后再继续。`).join(''),
    vocabulary: words.map(word => ({word,pos:'n.',meaning:'材料'}))});
  let calls = 0;
  const result = await generateMixedStory({words,model:'mock',callText:async (_,options) => {
    calls++; assert.ok(options.maxTokens >= 12000); return response;
  }});
  assert.equal(calls,1); assert.equal(result.glosses.length,120); assert.equal(result.issues.length,0);
  assert.ok(limitsFor(words, true).maxChinese < limitsFor(words, false).maxChinese);
});

test('one bounded regeneration includes diagnostics, never appends filler; transport failure is propagated', async () => {
  let calls = 0;
  const result = await generateMixedStory({words:['budget','process'],model:'mock',callText:async prompt => {
    calls++; if (calls === 1) return answer('我们的<w1>预算</w1>有限。');
    assert.match(prompt, /缺少process/); return answer();
  }});
  assert.equal(calls,2); assert.equal(result.article,fullStory('我们的budget有限，先完成process。'));
  calls=0;
  await assert.rejects(() => generateMixedStory({words:['budget','process'],callText:async()=>{calls++;return '{}';}}), /未通过检查/);
  assert.equal(calls,2);
  calls=0;
  await assert.rejects(() => generateMixedStory({words:['budget'],callText:async()=>{calls++;throw new Error('network');}}), /network/);
  assert.equal(calls,1);
});

test('production API uses only direct A for mixed mode, preserves runs and refunds failed generations', async () => {
  const source = fs.readFileSync('server.js','utf8');
  let handler, modelCalls = 0, reservationCost, refunds = 0, response = answer(), dictionaryFailed = false;
  const scope = vm.createContext({ console:{error:()=>{}}, OPENAI_API_KEY:'test', OPENAI_MODEL_NORMAL:'deepseek-v3.2',
    modelTraceStorage:new AsyncLocalStorage(), prisma:{},
    app:{post:(path,fn)=>{handler=fn;}},
    requireAuth:async(req,res)=>{if(req.authed)return{id:'qa',role:'admin'};res.status(401).json({error:'Unauthorized'});return null;},
    readAuthStore:async()=>({}), getUsageSnapshot:()=>({remaining:10,isUnlimited:false}), getShanghaiDateKey:()=> '2026-10-06',
    reserveCredits:async(_,user,date,cost)=>{reservationCost=cost;return{id:'reservation'};},
    refundCredits:async(_,reservation)=>{if(reservation)refunds++;}, logUsageEvent:async()=>{},
    generateMixedStory, generateBilingualStory, callOpenAIText:async(_,options)=>{modelCalls++;assert.equal(options.model,'deepseek-v3.2');return response;},
    vocabularyDetails:{getMany:async words=>{
      if(dictionaryFailed)throw Error('Dictionary preparation failed');
      return words.map(word=>({word,pos:'n.',usIpa:'/test/',ukIpa:'/test/',senses:[{marker:'①',meaning:'通用词义'}],
        baseMeanings:['通用词义'],collocations:['common phrase · 常用搭配'],wordFormation:'简短构词说明',synonyms:[],antonyms:[],detailsReady:true}));
    }},
    generateLexicon:async()=>{throw new Error('Mixed mode must not call lexicon');},
    buildBaseLexiconForResponse:lexicon=>lexicon, defaultTitleByDate:()=> '学习短文',
    normalizeLexicon:(words,rows)=>words.map((word,i)=>({word,pos:rows[i].pos,senses:[{marker:'①',meaning:rows[i].meanings[0]}]})),
    buildAdminModelDiagnostics:()=>({}) });
  for(const name of ['normalizeGenerationQuality','getGenerationProfile','normalizeInputWordToken','splitWords',
    'looksLikeWordListOnlyInput','buildWordPresenceRegex','findMissingWords','splitParagraphs','escapeRegex','buildArticleRuns',
    'hasChineseChars','hasStandardEnglishLanguageIssue','enforceWordMarkers','appendMissingWordsSentence']) {
    const start=source.indexOf('function '+name+'('); assert.ok(start>=0,name);
    const ends=[source.indexOf('\nfunction ',start+1),source.indexOf('\nasync function ',start+1)].filter(n=>n>=0);
    vm.runInContext(source.slice(start, Math.min(...ends)),scope);
  }
  vm.runInContext(source.slice(source.indexOf('app.post("/api/generate",'),source.indexOf('registerBilling(app,',source.indexOf('app.post("/api/generate",'))),scope);
  async function call(body,authed=true) {
    let status=200,result; const res={status:value=>{status=value;return res;},json:value=>{result=value;}};
    await handler({body,authed},res); return {status,result};
  }
  assert.equal((await call({words:'budget,process'},false)).status,401); assert.equal(modelCalls,0);
  assert.equal((await call({words:''})).status,400); assert.equal(modelCalls,0);
  const valid=await call({words:'Budget,budget,process',generationMode:'mixed',generationQuality:'advanced',quickMode:true});
  assert.equal(valid.status,200); assert.equal(modelCalls,1); assert.equal(reservationCost,1);
  assert.equal(valid.result.generationQuality,'normal'); assert.equal(valid.result.usageCost,1);
  assert.equal(valid.result.article,fullStory('我们的Budget有限，先完成process。'));
  assert.deepEqual(Array.from(valid.result.runs.filter(row=>row.type==='word').map(row=>row.displayMeaning)),['预算','流程']);
  assert.equal(valid.result.runs.map(row=>row.text).join(''),valid.result.article);
  assert.equal(valid.result.contextGlosses.length,2); assert.equal(valid.result.baseLexicon.length,2);
  assert.ok(valid.result.baseLexicon.every(entry=>entry.detailsReady && entry.usIpa));
  assert.equal(valid.result.lexicon[0].senses[0].meaning,'预算');
  assert.equal(valid.result.baseLexicon[0].senses[0].meaning,'通用词义');
  assert.equal(valid.result.paragraphsZh.length,0); assert.equal(valid.result.missing.length,0);
  response='{}'; const failed=await call({words:'budget,process',generationMode:'mixed'});
  assert.equal(failed.status,500); assert.equal(refunds,1); assert.equal(modelCalls,3);
  for (const name of ['generateLexicon','generateArticlePackage','generateParagraphTranslations','generateAlignment']) scope[name]=async()=>{throw new Error('Legacy generation must not be called: '+name);};
  response=bilingualAnswer(); const callsBefore=modelCalls;
  const standard=await call({words:'budget,process',generationMode:'standard',generationQuality:'advanced',level:'高级',shortMode:true});
  assert.equal(standard.status,200);assert.equal(standard.result.generationQuality,'normal');
  assert.equal(modelCalls,callsBefore+1);assert.equal(standard.result.contextGlosses.length,2);
  assert.ok(standard.result.sentencePairs.length>1);assert.ok(standard.result.alignment[0].occurrences.length);
  assert.equal(standard.result.runs.length,0);assert.equal(standard.result.paragraphsZh.length,1);
  response='{}';const invalidStandard=await call({words:'budget,process',generationMode:'standard'});
  assert.equal(invalidStandard.status,500);assert.equal(refunds,2);assert.equal(modelCalls,callsBefore+3);
  response=answer();dictionaryFailed=true;
  assert.equal((await call({words:'budget,process',generationMode:'mixed'})).status,500);
  assert.equal(refunds,3);
});

test('known missing closing delimiters are repaired without changing meanings; ambiguous malformed tags still fail',()=>{
  const good=JSON.parse(answer());good.article=fullStory('我们的⟦budget|n.|预算⟦process|n.|流程⟧需要调整。');
  const fixed=parseMixedResponse(JSON.stringify(good),['budget','process']);
  assert.deepEqual(fixed.issues,[]);assert.equal(fixed.article,fullStory('我们的budget process需要调整。'));assert.equal(fixed.formatNormalizations,1);
  good.article=fullStory('我们的⟦budget|n.|未知义项⟦process|n.|流程⟧需要调整。');
  assert.ok(parseMixedResponse(JSON.stringify(good),['budget','process']).issues.length);
  good.article=fullStory('我们从⟦budget|n.|预算⟧控制⟦process|n.|流程⟧。');
  good.vocabulary[0].meaning='预算；预算额';
  assert.deepEqual(parseMixedResponse(JSON.stringify(good),['budget','process']).issues,[]);
});

test('complete mixed stories allow background and transitions but reject tiny output and missing protagonist', () => {
  const valid = JSON.parse(answer());
  const parsed = parseMixedResponse(JSON.stringify(valid), ['budget','process']);
  assert.deepEqual(parsed.issues, []);
  assert.ok(parsed.chineseChars >= limitsFor(['budget','process'], false).hardMin);
  valid.article = '小明检查⟦budget|n.|预算⟧，修改⟦process|n.|流程⟧。';
  assert.ok(parseMixedResponse(JSON.stringify(valid), ['budget','process']).issues.some(issue => issue.includes('至少')));
  valid.article = JSON.parse(answer()).article.replace('小明', '小华');
  assert.ok(parseMixedResponse(JSON.stringify(valid), ['budget','process']).issues.some(issue => issue.includes('主角')));
  const six = ['a','b','c','d','e','f'];
  assert.equal(limitsFor(six, false).minChinese, 180);
  assert.equal(limitsFor(six, false).maxChinese, 280);
  assert.equal(limitsFor(six, true).minChinese, 110);
  assert.equal(limitsFor(six, true).maxChinese, 180);
});

test('mixed sentence translation uses exact contextual meanings locally and detail hydration preserves them',()=>{
  const source=fs.readFileSync('public/app.js','utf8');
  const scope=vm.createContext({console:{log:()=>{}},latestLexicon:[],latestBaseLexicon:[],latestContextLexicon:[],latestGenerationMode:'mixed',
    latestContextGlosses:[{word:'cover',pos:'v.',contextMeaning:'支付',marker:'①'}],vocabDetailErrorTipByKey:new Map(),notebookHydrationLastAttemptByKey:new Map(),notebookHydrationCompletedKeys:new Set(),
    keyifyWord:word=>word.toLowerCase(),sanitizeLexiconItemForUi:entry=>entry,sanitizeTextListForUi:values=>values||[],isWordInNotebook:()=>false,needsVocabHydration:()=>false});
  for(const name of ['escapeRegExp','translateMixedSentence','upsertWordEntryByKey','mergeDetailedEntryIntoState']){
    const start=source.indexOf('function '+name+'(');assert.ok(start>=0,name);
    const ends=[source.indexOf('\nfunction ',start+1),source.indexOf('\nasync function ',start+1)].filter(n=>n>=0);
    vm.runInContext(source.slice(start,Math.min(...ends)),scope);
  }
  assert.equal(scope.translateMixedSentence('预算能cover费用。',scope.latestContextGlosses),'预算能支付费用。');
  const glosses=[{word:'take care of',contextMeaning:'照顾'},{word:'care',contextMeaning:'关心'},{word:"don't",contextMeaning:'不要'},{word:'Mother',contextMeaning:'母亲'}];
  assert.equal(scope.translateMixedSentence("我要take care of Mother，也care她，请don't担心。",glosses),'我要照顾 母亲，也关心她，请不要担心。');
  scope.mergeDetailedEntryIntoState({word:'cover',pos:'n.',senses:[{meaning:'封面'}],baseMeanings:['封面']});
  assert.equal(scope.latestContextLexicon[0].senses[0].meaning,'支付');assert.equal(scope.latestContextLexicon[0].pos,'v.');
  assert.equal(scope.latestBaseLexicon[0].senses[0].meaning,'封面');
  scope.latestGenerationMode='standard';
  scope.mergeDetailedEntryIntoState({word:'cover',pos:'n.',senses:[{meaning:'封面'}],baseMeanings:['封面']});
  assert.equal(scope.latestLexicon[0].senses[0].meaning,'支付');
});

test('mixed provider requests do not multiply transport retries or change models',async()=>{
  const source=fs.readFileSync('server.js','utf8');let requests=0;
  const scope=vm.createContext({OPENAI_BASE_URL:'https://test.invalid/v1',OPENAI_API_MODE:'chat',OPENAI_MODEL_NORMAL:'deepseek-v3.2',OPENAI_API_KEY:'test',OPENAI_TIMEOUT_MS:60000,OPENAI_RETRY_COUNT:2,
    AbortController,setTimeout,clearTimeout,recordModelTrace:()=>{},isRetryableNetworkError:()=>true,sleep:async()=>{},
    fetch:async()=>{requests++;throw new Error('network');}});
  vm.runInContext(source.slice(source.indexOf('async function callOpenAIText('),source.indexOf('// Vocabulary output grows')),scope);
  await assert.rejects(()=>scope.callOpenAIText('test',{model:'deepseek-v3.2',retryCount:0,timeoutMs:30000}),/after 1 attempts/);
  assert.equal(requests,1);
});
