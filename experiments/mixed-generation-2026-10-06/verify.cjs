const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const dir=__dirname;
const source=fs.readFileSync(path.join(dir,'../../server.js'),'utf8');
const funcs=[...source.matchAll(/^(?:async )?function (\w+)\(/gm)];
const ctx=vm.createContext({});
for(const name of ['buildWordPresenceRegex','findMissingWords']){
 const i=funcs.findIndex(x=>x[1]===name);
 vm.runInContext(source.slice(funcs[i].index,funcs[i+1].index),ctx);
}
const data=JSON.parse(fs.readFileSync(path.join(dir,'results.json'),'utf8'));
const checks=[];
for(const row of data.results){
 const expected=row.dataset.words.map((_,i)=>i+1).sort((a,b)=>a-b);
 for(const key of ['A','B']){
  const out=row[key];
  assert.deepEqual(Array.from(ctx.findMissingWords(out.text,row.dataset.words)),out.metrics.missing);
  assert.equal(out.text.includes('⟦'),false);
  assert.equal(/<\/?w\d+>/.test(out.text),false);
  assert.equal(out.metrics.chineseChars,(out.text.match(/[\u4e00-\u9fff]/g)||[]).length);
  assert.equal(out.metrics.unexpectedEnglish.length,0);
 }
 assert.deepEqual([...new Set(row.A.ids)].sort((a,b)=>a-b),expected);
 assert.deepEqual([...new Set(row.B.idsEnglish)].sort((a,b)=>a-b),expected);
 assert.deepEqual([...new Set(row.B.idsChinese)].sort((a,b)=>a-b),expected);
 for(const match of row.B.english.matchAll(/<w(\d+)>([\s\S]*?)<\/w\1>/g))assert.equal(match[2],row.dataset.words[Number(match[1])-1]);
 for(const call of row.calls){assert.equal(call.model,data.model);assert.equal(call.effort,data.effort);assert.equal(call.error,null);assert.equal(call.toolItems.length,0);}
 checks.push({dataset:row.dataset.id,coverageA:row.A.metrics.coverage,coverageB:row.B.metrics.coverage,verifiedAgainstProjectFunction:true});
}
console.log(JSON.stringify({checks},null,2));
