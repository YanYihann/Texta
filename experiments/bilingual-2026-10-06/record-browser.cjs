const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const cli='C:\\Users\\19633\\AppData\\Local\\npm-cache\\_npx\\31e32ef8478fbf80\\node_modules\\@playwright\\cli\\playwright-cli.js';
const expression='() => ({...window.__bilingualQa,...window.__bilingualMigrationQa,viewport:{width:innerWidth,contentWidth:document.documentElement.scrollWidth}})';
const result=spawnSync(process.execPath,[cli,'-s=texta-bilingual','eval',expression],{encoding:'utf8',windowsHide:true});
if(result.status!==0)throw Error(result.stderr||result.stdout);
const stats=JSON.parse(result.stdout.split('### Result\n')[1].split('### Ran Playwright code')[0].trim());
(async()=>{
  const qa=await(await fetch('http://127.0.0.1:3013/__qa')).json();
  const previous=fs.existsSync(path.join(__dirname,'browser-qa.json'))?JSON.parse(fs.readFileSync(path.join(__dirname,'browser-qa.json'),'utf8')):{};
  const favorite=qa.library.favorites.find(row=>row.words.length===12);
  if(!favorite?.sentencePairs.length||!favorite.alignment.every(row=>row.occurrences?.length))throw Error('Favorite did not preserve paired output');
  fs.writeFileSync(path.join(__dirname,'browser-qa.json'),JSON.stringify({date:'2026-10-06',origin:'http://127.0.0.1:3013',
    notes:'Local mocked API only. No production API/provider/database access.',stats:{...previous.stats,...stats},
    favorite:{title:favorite.title,words:favorite.words.length,sentencePairs:favorite.sentencePairs.length,alignedWords:favorite.alignment.length},
    requestCounts:qa.requests.reduce((map,row)=>{map[row.path]=(map[row.path]||0)+1;return map;},{}),
    generationRequests:qa.requests.filter(row=>row.path==='/generate').map(row=>row.body)},null,2));
  console.log(JSON.stringify(stats));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
