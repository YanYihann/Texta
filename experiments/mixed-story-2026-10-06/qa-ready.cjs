const fs=require('node:fs'),{spawnSync}=require('node:child_process');
const cli='C:/Users/19633/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/@playwright/cli/playwright-cli.js';
const code=async page=>{
  await page.request.post('http://127.0.0.1:3013/api/library/sync',{data:{favorites:[],notebookEntries:[],vocabPrefs:{},libraryFolders:[]}});
  await page.evaluate(()=>{localStorage.clear();localStorage.setItem('texta_auth_token','local-only');localStorage.setItem('texta_guide_seen_bilingual-qa','1');});
  await page.reload();
  await page.getByRole('button',{name:'清空',exact:true}).click();
  await page.getByRole('textbox',{name:'输入词汇'}).fill('sustainable, resilient, adapt, perspective, thrive, balance');
  await page.getByRole('button',{name:'中英混合',exact:true}).click();
  await page.getByRole('button',{name:'生成文章',exact:true}).click();
  await page.getByRole('button',{name:'词汇解析: sustainable',exact:true}).waitFor();
  const before=await (await page.request.get('http://127.0.0.1:3013/__qa')).json();
  const keys=['sustainable','resilient','adapt','perspective','thrive','balance'];
  const clickMs=[];
  for(const key of keys){
    await page.getByRole('button',{name:'词汇解析: '+key,exact:true}).click();
    const card=page.locator('#glossary .glossary-item.active');
    if(!await card.locator('.glossary-word').filter({hasText:key}).count())throw Error('Wrong card '+key);
    if(!await card.locator('.sense-line').filter({hasText:'词典的其他义项'}).count())throw Error('Missing full saved meanings');
    if(!await card.locator('.speak-ipa').filter({hasText:'/test/'}).count())throw Error('Missing preloaded pronunciation');
    clickMs.push(await page.evaluate(word=>{
      const mark=document.querySelector('.article-blocks mark[data-word-key="'+word+'"]')||document.querySelector('mark.vocab-en[data-word-key="'+word+'"]');
      const start=performance.now();mark.click();return performance.now()-start;
    },key));
  }
  await page.getByRole('button',{name:'收藏文章',exact:true}).click();
  const saved=page.waitForResponse(response=>response.url().endsWith('/api/library/sync')&&response.request().postDataJSON().notebookEntries.length===6);
  await page.getByRole('button',{name:'将陌生词添加到生词本（6）',exact:true}).click();
  await saved;
  const after=await (await page.request.get('http://127.0.0.1:3013/__qa')).json();
  if(after.library.notebookEntries.length!==6||after.library.favorites.length!==1)throw Error('Library did not persist six ready cards');
  if(after.dictionaryBatches!==before.dictionaryBatches)throw Error('Click/favorite regenerated vocabulary');
  if(after.requests.some(r=>r.path.includes('/vocab/')||r.path.includes('/context/translation')))throw Error('Unexpected click model request');
  for(const card of [...after.library.favorites[0].lexicon,...after.library.favorites[0].baseLexicon,...after.library.notebookEntries]){
    if(!card.detailsReady||card.usIpa!=='/test/'||!card.collocations.length)throw Error('Ready metadata not saved');
  }
  await page.reload();
  await page.getByRole('button',{name:'收藏夹',exact:true}).click();
  return {beforeBatches:before.dictionaryBatches,afterBatches:after.dictionaryBatches,dictionaryEntries:after.dictionaryEntries,clickMs,favoriteCards:after.library.favorites[0].baseLexicon.length,notebookCards:after.library.notebookEntries.length};
};
const result=spawnSync(process.execPath,[cli,'--session=vocab-ready','run-code',code.toString()],{encoding:'utf8'});
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');process.exitCode=result.status||0;
