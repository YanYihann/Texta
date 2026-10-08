// Local UI fixture only: no .env, provider, production API or database access.
const fs=require('node:fs'),path=require('node:path'),express=require('express');
const {parseBilingualResponse}=require('../../generation/bilingual.cjs');
const {createVocabularyDetails}=require('../../generation/vocabulary.cjs');
const root=path.resolve(__dirname,'../..'),app=express(),requests=[];
const user={id:'bilingual-qa',name:'本地测试',role:'user',plan:'free'},usage={remaining:9,used:1,limit:10,isUnlimited:false};
let library={favorites:[],notebookEntries:[],vocabPrefs:{},libraryFolders:[]};
const dictionaryStore=new Map();let dictionaryBatches=0;
const dictionary=createVocabularyDetails({db:{vocabularyDetail:{
  findMany:async({where})=>where.wordKey.in.map(key=>dictionaryStore.get(key)).filter(Boolean),
  upsert:async({where,create,update})=>{const row=dictionaryStore.has(where.wordKey)?{...dictionaryStore.get(where.wordKey),...update}:create;dictionaryStore.set(where.wordKey,row);return row;}
}},callText:async prompt=>{
  dictionaryBatches++;
  const words=JSON.parse(prompt.split('\n').find(line=>line.startsWith('[')));
  return JSON.stringify(words.map(word=>({word,pos:'n.',usIpa:'/test/',ukIpa:'/test/',meanings:['词典的其他义项'],
    collocations:[word+' phrase · 测试搭配'],wordFormation:'整体词，无明显可拆分构词部分',synonyms:[],antonyms:[]})));
}});
app.use(express.json());
app.get('/site-config.js',(_,res)=>res.type('js').send('window.TEXTA_API_BASE=location.origin;'));
app.get('/__qa',(_,res)=>res.json({requests,library,dictionaryBatches,dictionaryEntries:dictionaryStore.size}));
app.use('/api',(req,res,next)=>{requests.push({method:req.method,path:req.path,body:req.body});next();});
app.get('/api/auth/me',(_,res)=>res.json({user}));
app.get('/api/health',(_,res)=>res.json({ok:true,service:'texta-api',libraryVersion:3}));
app.get('/api/usage',(_,res)=>res.json({user,usage}));
app.get('/api/library',(_,res)=>res.json(library));
app.post('/api/library/sync',(req,res)=>{library=req.body;res.json({ok:true});});
app.post('/api/spellcheck',(_,res)=>res.json({items:[]}));
app.post('/api/generate',async(req,res)=>{
  const mixed=req.body.generationMode==='mixed';let story,words;
  if(mixed){
    const row=JSON.parse(fs.readFileSync(path.join(root,'experiments/mixed-a-deepseek-2026-10-06/results.json'),'utf8')).results.find(row=>row.id==='theme-6');
    words=row.words;story={...row.result,paragraphsEn:[row.result.article],paragraphsZh:[],alignment:[],sentencePairs:[]};
  }else{
    const file=path.join(__dirname,fs.existsSync(path.join(__dirname,'accepted-results.json'))?'accepted-results.json':'results.json');
    const rows=JSON.parse(fs.readFileSync(file,'utf8')).results;
    const target=req.body.words.split(/[,，\n]+/).map(word=>word.trim()).filter(Boolean);
    const row=rows.find(row=>row.words.every((word,index)=>word===target[index])&&row.words.length===target.length&&!!row.shortMode===!!req.body.shortMode)||rows.find(row=>row.id==='theme-6');
    words=row.words;story=parseBilingualResponse(row.calls.at(-1).text,words,!!row.shortMode);
    if(story.issues.length)return res.status(500).json({error:'Invalid local fixture',detail:story.issues.join(';')});
  }
  const baseLexicon=await dictionary.getMany(words,'mock');
  const lexicon=story.glosses.map((g,i)=>({...baseLexicon[i],word:words[i],pos:g.pos,senses:[{marker:'①',meaning:g.meaning}]}));
  const contextGlosses=story.glosses.map((g,i)=>({word:words[i],pos:g.pos,contextMeaning:g.meaning,marker:'①'}));
  const runs=[];
  if(mixed){
    let cursor=0;
    for(const match of story.article.matchAll(/[A-Za-z]+/g)){
      const index=words.findIndex(word=>word.toLowerCase()===match[0].toLowerCase());
      if(index<0)continue;
      if(match.index>cursor)runs.push({type:'text',text:story.article.slice(cursor,match.index)});
      runs.push({type:'word',word:words[index],text:match[0],pos:story.glosses[index].pos,displayMeaning:story.glosses[index].meaning});
      cursor=match.index+match[0].length;
    }
    if(cursor<story.article.length)runs.push({type:'text',text:story.article.slice(cursor)});
  }
  res.json({title:story.title,defaultTitle:story.title,article:story.article,generationMode:mixed?'mixed':'standard',generationQuality:'normal',usageCost:1,model:'local-fixture',words,missing:[],lexicon,baseLexicon,contextGlosses,runs,paragraphsEn:story.paragraphsEn,paragraphsZh:story.paragraphsZh,alignment:story.alignment,sentencePairs:story.sentencePairs,usage});
});
app.post('/api/vocab/detail',(req,res)=>res.json({ok:true,entry:{word:req.body.word,pos:'n.',usIpa:'/test/',ukIpa:'/test/',senses:[{meaning:'词典的其他义项',marker:'①'}],baseMeanings:['词典的其他义项'],collocations:['test · 测试'],wordFormation:'测试词根',synonyms:['test'],antonyms:['test']}}));
app.post('/api/context/translation',(_,res)=>res.status(500).json({error:'New bilingual output must reuse its saved sentence translation'}));
app.use('/api',(_,res)=>res.status(404).json({error:'Local fixture route missing'}));
app.use(express.static(path.join(root,'public')));
app.listen(3013,'127.0.0.1',()=>console.log('Local fixture: http://127.0.0.1:3013/app.html. No user API calls.'));
