// Uses the signed-in Codex session, never .env or Texta's provider/API key.
const fs = require('node:fs'), path = require('node:path'), { spawn } = require('node:child_process');
const { buildBilingualPrompt, parseBilingualResponse, bilingualLimits } = require('../../generation/bilingual.cjs');
const model = 'gpt-6.1-sol', effort = 'high', dir = __dirname;
const datasets = [
  { id: 'theme-6', words: ['sustainable','resilient','adapt','perspective','thrive','balance'] },
  { id: 'random-12', words: ['budget','relax','process','standard','attitude','motivation','derive','sterility','plume','bristle','cricket','expenses'] },
  { id: 'random-12-short', shortMode: true, words: ['budget','relax','process','standard','attitude','motivation','derive','sterility','plume','bristle','cricket','expenses'] },
  { id: 'weather-24', words: ['granite','terrain','arctic','deteriorate','gulf','meteorology','thermal','tropics','arid','humid','hail','thaw','shiver','budget','relax','process','standard','attitude','motivation','cover','reject','derive','contribute','expenses'] },
  { id: 'phrases-6', words: ['take care of',"don't",'well-being','Mother','care','look forward to'] },
  { id: 'single-short', shortMode: true, words: ['cover'] },
  { id: 'overlap-6', words: ['art','article','in','in spite of','record','recording'] },
  { id: 'theme-6-repeat', words: ['sustainable','resilient','adapt','perspective','thrive','balance'] }
];
async function invoke(name, prompt) {
  fs.mkdirSync(path.join(dir, 'raw'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'isolated'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'raw', name + '.prompt.txt'), prompt);
  const preface = '这是文本生成测试。禁止使用工具、读取文件或联网，只按下面的生成要求输出JSON。\n';
  const start = performance.now();
  const child = spawn(process.env.CODEX_CLI_PATH || 'C:\\Users\\19633\\AppData\\Local\\Programs\\OpenAI\\Codex\\bin\\codex.exe', [
    'exec','--ignore-user-config','--ephemeral','--skip-git-repo-check','--json','--color','never','--model',model,
    '-c',`model_reasoning_effort="${effort}"`,'-c','model_provider="experiment_https"',
    '-c','model_providers.experiment_https={name="OpenAI",base_url="https://chatgpt.com/backend-api/codex",wire_api="responses",requires_openai_auth=true,supports_websockets=false}',
    '--cd',path.join(dir,'isolated'),'-'
  ], { stdio: ['pipe','pipe','pipe'], windowsHide: true });
  let stdout = '', stderr = '';
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', s => { stdout += s; }); child.stderr.on('data', s => { stderr += s; });
  child.stdin.end(preface + prompt, 'utf8');
  const timer = setTimeout(() => child.kill(), 240000);
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  clearTimeout(timer);
  fs.writeFileSync(path.join(dir,'raw',name+'.events.jsonl'),stdout);
  fs.writeFileSync(path.join(dir,'raw',name+'.stderr.txt'),stderr);
  const events = stdout.split(/\r?\n/).filter(Boolean).map(s => { try { return JSON.parse(s); } catch { return {}; } });
  const completed = events.findLast(e => e.type === 'turn.completed');
  const text = events.filter(e => e.type === 'item.completed' && e.item?.type === 'agent_message').at(-1)?.item.text || '';
  const tools = events.filter(e => e.type === 'item.completed' && !['agent_message','reasoning'].includes(e.item?.type)).map(e => e.item?.type);
  const result = { model, effort, seconds: +(performance.now() - start).toFixed(0) / 1000, exitCode: code, usage: completed?.usage, tools, text };
  fs.writeFileSync(path.join(dir,'raw',name+'.result.json'),JSON.stringify(result,null,2));
  if (code !== 0 || !completed || !text || tools.length) throw new Error(`${name}: failed or used tools; see raw logs`);
  return result;
}
async function main() {
  const results = [];
  fs.writeFileSync(path.join(dir,'datasets.json'),JSON.stringify(datasets,null,2));
  for (const data of datasets) {
    const calls = []; let parsed;
    for (let attempt = 0; attempt < 2; attempt++) {
      const prompt = buildBilingualPrompt(data.words, !!data.shortMode, parsed?.issues || []);
      const raw = await invoke(`${data.id}-${attempt+1}`, prompt);
      parsed = parseBilingualResponse(raw.text, data.words, !!data.shortMode);
      calls.push({ ...raw, promptChars: prompt.length });
      if (!parsed.issues.length) break;
    }
    results.push({ ...data, limits: bilingualLimits(data.words, !!data.shortMode), calls, parsed });
    fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify({date:'2026-10-06',model,effort,
      notes:'Codex sign-in only; no Texta API/provider calls. CLI token usage includes harness and reasoning. No old-provider timing or token comparison was performed.',results},null,2));
    console.log(JSON.stringify({id:data.id,calls:calls.length,seconds:calls.reduce((n,c)=>n+c.seconds,0),englishWords:parsed.englishWords,issues:parsed.issues}));
  }
}
if (require.main === module) main().catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = { invoke, datasets };
