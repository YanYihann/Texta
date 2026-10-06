const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const source=fs.readFileSync('server.js','utf8');
const routes=new Map();let db={favoriteArticle:[],notebookEntry:[],userVocabPref:[],libraryFolder:[]},failInsert=false;
function models(state){return Object.fromEntries(Object.keys(state).map(name=>[name,{
 findMany:async({where})=>state[name].filter(row=>row.userId===where.userId),
 deleteMany:async({where})=>{state[name]=state[name].filter(row=>row.userId!==where.userId)},
 createMany:async({data})=>{if(failInsert&&name==='libraryFolder')throw new Error('simulated insert failure');state[name].push(...data)}
}]))}
const prisma={...models(db),$transaction:async work=>{const copy=structuredClone(db);await work(models(copy));for(const name of Object.keys(db))db[name]=copy[name];}};
const context=vm.createContext({crypto,console:{error:()=>{}},prisma,requireAuth:async req=>({id:req.userId}),app:{get:(path,handler)=>routes.set('GET '+path,handler),post:(path,handler)=>routes.set('POST '+path,handler)}});
const names=['cloneJsonSafe','normalizeText','normalizeIso','normalizeStringArray','sanitizeSentencePairs','parseAlignmentPayload','buildAlignmentPayload','sanitizeFavoritesPayload','sanitizeNotebookSource','sanitizeNotebookPayload','sanitizeVocabPrefsPayload','encodeFavoriteId','decodeFavoriteId','normalizeGenerationMode','normalizeGenerationQuality'];
for(const name of names){const start=source.indexOf('function '+name+'(');assert(start>=0,name);let end=source.indexOf('\nfunction ',start+1);const asyncEnd=source.indexOf('\nasync function ',start+1);if(asyncEnd>=0&&(end<0||asyncEnd<end))end=asyncEnd;vm.runInContext(source.slice(start,end),context)}
vm.runInContext(source.slice(source.indexOf('app.get("/api/library",'),source.indexOf('app.post("/api/upgrade/request",')),context);
async function call(method,userId,body){let result,status=200;const res={json:value=>{result=value},status:value=>{status=value;return res}};await routes.get(method+' /api/library'+(method==='POST'?'/sync':''))({userId,body},res);return {status,result}}
(async()=>{
 const first='2026-10-01T04:00:00.000Z',later='2026-10-04T04:00:00.000Z';
 const sourceArticle={id:'source',title:'Original reading',article:'An apple a day.',words:['apple'],paragraphsEn:['An apple a day.'],paragraphsZh:['一天一个苹果。'],sentencePairs:[{paragraph:0,en:'An apple a day.',zh:'一天一个苹果。'}],lexicon:[{word:'apple',senses:[{meaning:'苹果'}]}],alignment:[{word:'apple',zh_terms:['苹果'],english_forms:['apple'],occurrences:[{paragraph:0,sentence:0,enStart:3,enEnd:8,zhStart:4,zhEnd:6}]}],generationMode:'standard',createdAt:first,updatedAt:first};
 const snapshot={favorites:[{id:'article',title:'My article',words:['apple'],article:'apple',folderId:'folder',createdAt:first,updatedAt:later}],notebookEntries:[{id:'word_a',key:'apple',word:'apple',senses:[{meaning:'苹果'}],sourceArticle,createdAt:first,updatedAt:later,deletedAt:later}],vocabPrefs:{apple:{word:'apple',mastery:'mastered',createdAt:first,updatedAt:later}},libraryFolders:[{id:'folder',name:'阅读',createdAt:first,updatedAt:later}]};
 const readyCard={word:'apple',pos:'n.',usIpa:'/ˈæpəl/',ukIpa:'/ˈæpəl/',senses:[{meaning:'苹果',marker:'①'}],baseMeanings:['苹果'],collocations:['an apple a day · 每天一个苹果'],wordFormation:'整体词',synonyms:[],antonyms:[],detailsReady:true};
 Object.assign(sourceArticle,{lexicon:[readyCard],baseLexicon:[readyCard]});
 Object.assign(snapshot.favorites[0],{lexicon:[readyCard],baseLexicon:[readyCard]});
 Object.assign(snapshot.notebookEntries[0],readyCard);
 assert.equal((await call('POST','alice',snapshot)).status,200);
 let result=(await call('GET','alice')).result;
 assert.equal(result.favorites[0].folderId,'folder');assert.equal(result.libraryFolders[0].id,'folder');assert.equal(result.notebookEntries[0].createdAt,first);assert.equal(result.notebookEntries[0].deletedAt,later);assert.equal(result.vocabPrefs.apple.mastery,'mastered');
 assert.equal(result.notebookEntries[0].sourceArticle.article,sourceArticle.article);
 assert.equal(result.notebookEntries[0].sourceArticle.alignment[0].zh_terms[0],'苹果');
 assert.equal(result.notebookEntries[0].sourceArticle.generationMode,'standard');
 assert.deepEqual(JSON.parse(JSON.stringify(result.notebookEntries[0].sourceArticle.sentencePairs)),sourceArticle.sentencePairs);
 assert.deepEqual(JSON.parse(JSON.stringify(result.notebookEntries[0].sourceArticle.alignment[0].occurrences)),sourceArticle.alignment[0].occurrences);
 await call('POST','pair-test',{favorites:[sourceArticle],notebookEntries:[],vocabPrefs:{}});
 const restored=(await call('GET','pair-test')).result.favorites[0];
 assert.deepEqual(JSON.parse(JSON.stringify(restored.sentencePairs)),sourceArticle.sentencePairs);
 assert.deepEqual(JSON.parse(JSON.stringify(restored.alignment[0].occurrences)),sourceArticle.alignment[0].occurrences);
 for(const entry of [result.favorites[0].baseLexicon[0],result.favorites[0].lexicon[0],result.notebookEntries[0],restored.baseLexicon[0]]){
  assert.equal(entry.detailsReady,true);assert.deepEqual(JSON.parse(JSON.stringify(entry.collocations)),readyCard.collocations);
  assert.equal(entry.usIpa,readyCard.usIpa);assert.deepEqual(JSON.parse(JSON.stringify(entry.antonyms)),[]);
 }
 const bob={favorites:[{...snapshot.favorites[0],title:'Bob'}],notebookEntries:[],vocabPrefs:{},libraryFolders:snapshot.libraryFolders};
 await call('POST','bob',bob);assert.equal((await call('GET','alice')).result.favorites[0].title,'My article');assert.equal((await call('GET','bob')).result.favorites[0].title,'Bob');
 const before=JSON.stringify(db);failInsert=true;assert.equal((await call('POST','alice',{...snapshot,favorites:[]})).status,500);assert.equal(JSON.stringify(db),before,'Partial snapshot persisted');failInsert=false;
 const legacy={...snapshot};delete legacy.libraryFolders;await call('POST','alice',legacy);assert.equal((await call('GET','alice')).result.libraryFolders.length,1,'Legacy client erased folder records');
 console.log('PASS: API roundtrip, first date/deletions/mastery/folders, user isolation, atomic rollback, legacy folder preservation');
})().catch(error=>{console.error(error);process.exitCode=1});
