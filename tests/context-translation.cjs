const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('server.js','utf8');let handler,prompt='',answer='{"translation":"她买了一个苹果。"}',calls=0;
const scope=vm.createContext({console:{error:()=>{}},OPENAI_API_KEY:'test',OPENAI_MODEL_NORMAL:'mock',requireAuth:async(req,res)=>{if(req.authed)return{id:'qa'};res.status(401).json({error:'Unauthorized'});return null},callOpenAIText:async text=>{calls++;prompt=text;return answer},app:{post:(path,fn)=>{handler=fn}}});
for(const name of ['normalizeText','normalizeStringArray','extractJsonObject']){const start=source.indexOf('function '+name+'(');let end=source.indexOf('\nfunction ',start+1);const asyncEnd=source.indexOf('\nasync function ',start+1);if(asyncEnd>=0&&(end<0||asyncEnd<end))end=asyncEnd;vm.runInContext(source.slice(start,end),scope)}
vm.runInContext(source.slice(source.indexOf('app.post("/api/context/translation",'),source.indexOf('app.post("/api/vocab/detail",')),scope);
async function call(body,authed=true){let status=200,result;const res={status:value=>{status=value;return res},json:value=>{result=value}};await handler({body,authed},res);return{status,result}}
(async()=>{
assert.equal((await call({sentence:'She bought an apple.'},false)).status,401);assert.equal(calls,0);
assert.equal((await call({sentence:''})).status,400);assert.equal((await call({sentence:'x'.repeat(4001)})).status,400);assert.equal(calls,0);
const result=await call({sentence:'She bought an apple.',paragraph:'It was sunny. She bought an apple. They went home.',paragraphTranslation:'天气晴朗。她买了一个苹果。他们回家了。',terms:['苹果']});assert.equal(result.status,200);assert.equal(result.result.translation,'她买了一个苹果。');assert(prompt.includes('Translate ONLY the selected sentence'));assert(prompt.includes('"sentence":"She bought an apple."'));assert(prompt.includes('"terms":["苹果"]'));
answer='not JSON';assert.equal((await call({sentence:'She bought an apple.'})).status,502);
answer='{"translation":""}';assert.equal((await call({sentence:'She bought an apple.'})).status,502);
console.log('PASS: sentence-only translation contract, context hints, authentication, bounds and malformed responses');
})().catch(error=>{console.error(error);process.exitCode=1});
