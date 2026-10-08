const fs=require('fs'),path=require('path');
const {restoreA,restoreB,metrics}=require('./run.cjs');
const dir=__dirname;
const data=JSON.parse(fs.readFileSync(path.join(dir,'results.json'),'utf8'));
for(const row of data.results){
 const parsedA=JSON.parse(JSON.parse(fs.readFileSync(path.join(dir,'raw',`${row.dataset.id}-A.result.json`),'utf8')).text);
 const rawA=parsedA.article.replace(/⟦T(\d+)⟧/g,(m,n)=>row.dataset.words[Number(n)-1]||m);
 const rawB=row.B.translated.replace(/<w(\d+)>([\s\S]*?)<\/w\1>/g,(m,n)=>row.dataset.words[Number(n)-1]||m);
 row.A.textRaw=rawA;row.A.metricsRaw=metrics(rawA,row.dataset.words);
 row.B.textRaw=rawB;row.B.metricsRaw=metrics(rawB,row.dataset.words);
 row.A.boundarySpacesAdded=(parsedA.article.match(/⟧(?=⟦T\d+⟧)/g)||[]).length;
 row.B.boundarySpacesAdded=(row.B.translated.match(/<\/w\d+>(?=<w\d+>)/g)||[]).length;
 row.A.text=restoreA(parsedA.article,row.dataset.words);row.A.metrics=metrics(row.A.text,row.dataset.words);
 row.B.text=restoreB(row.B.translated,row.dataset.words);row.B.metrics=metrics(row.B.text,row.dataset.words);
}
data.postprocessing='Only a deterministic space between adjacent target markers before restoring words. Raw pre-guard results retained. No model retries or semantic edits.';
fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(data,null,2));
console.log(JSON.stringify(data.results.map(row=>({id:row.dataset.id,Araw:row.A.metricsRaw.coverage,A:row.A.metrics.coverage,Braw:row.B.metricsRaw.coverage,B:row.B.metrics.coverage,spacesA:row.A.boundarySpacesAdded,spacesB:row.B.boundarySpacesAdded})),null,2));
