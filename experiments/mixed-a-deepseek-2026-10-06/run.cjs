const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { generateMixedStory } = require('../../generation/mixed.cjs');
const root = path.resolve(__dirname, '../..');
require('dotenv').config({ path: path.join(root, '.env'), quiet: true });
const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const context = vm.createContext({ require: createRequire(path.join(root, 'server.js')), process, console,
  __dirname: root, fetch, URL, AbortController, setTimeout, clearTimeout, Buffer, structuredClone });
// Load production helpers and provider configuration without bootstrapping or touching the database.
vm.runInContext(source.slice(0, source.lastIndexOf('bootstrap().catch')), context);
const invoke = vm.runInContext('callOpenAIText', context);
const tracing = vm.runInContext('modelTraceStorage', context);
const missingWords = vm.runInContext('findMissingWords', context);
const adminSummary = vm.runInContext('buildAdminModelDiagnostics', context);
const sets = JSON.parse(fs.readFileSync(path.join(root, 'experiments/mixed-generation-2026-10-06/datasets.json'), 'utf8'));
const datasets = [...sets,
  { id: 'mixed-12-repeat', words: sets[1].words },
  { id: 'long-25', words: [...sets[2].words, 'vacation'] },
  { id: 'phrases', words: ['take care of', 'care', "don't", 'well-being', 'Mother', 'motherhood'] },
  { id: 'single', words: ['derive'], quickMode: true },
  { id: 'new-school-12', words: ['deadline','assignment','feedback','improve','confident','hesitate','submit','revise','schedule','focus','clarify','progress'] },
  { id: 'new-random-15', words: ['fragile','negotiate','orchard','invoice','beneath','reluctant','restore','harvest','consequence','borrow','precise','sufficient','transport','evidence','temporary'] },
  { id: 'long-48-quick', words: [...sets[2].words, 'sustainable', 'resilient', 'adapt', 'perspective', 'thrive', 'balance', 'camp', 'equipment', 'resource', 'shelter', 'challenge', 'cooperate', 'supply', 'rescue', 'route', 'safety', 'reliable', 'monitor', 'observe', 'record', 'analyse', 'evidence', 'predict', 'protect'], quickMode: true }
];
const extras = 'team leader station coast mountain valley river forest soil seed plant water garden village farmer worker repair inspect replace connect adjust design build maintain manage organise prepare arrange travel arrive return collect sample measure compare estimate calculate decide confirm explain discuss report publish support assist deliver request refuse accept approve reduce increase conserve prevent recover stable flexible practical efficient responsible curious patient cautious urgent modest clear useful essential annual regional global local public private basic final original separate complex simple accurate rapid gradual'.split(' ');
const largeWords = [...new Set([...datasets.find(data=>data.id==='long-48-quick').words, ...extras])].slice(0,120);
if (largeWords.length !== 120) throw new Error('Expected 120 distinct words');
datasets.push({id:'limit-120',words:largeWords,quickMode:true});

async function main() {
  const results = [];
  fs.mkdirSync(path.join(__dirname, 'raw'), { recursive: true });
  for (const data of datasets) {
    const calls = [], trace = { calls: [] }, start = Date.now();
    let result, error;
    try {
      result = await tracing.run(trace, () => generateMixedStory({ words: data.words, level: '中级',
        quickMode: Boolean(data.quickMode), model: 'deepseek-v3.2',
        callText: async (prompt, options) => {
          const index = calls.length + 1;
          fs.writeFileSync(path.join(__dirname, 'raw', `${data.id}-${index}.prompt.txt`), prompt);
          const response = await invoke(prompt, options);
          fs.writeFileSync(path.join(__dirname, 'raw', `${data.id}-${index}.response.txt`), response);
          calls.push({ step: options.step, maxTokens: options.maxTokens });
          return response;
        }
      }));
    } catch (e) { error = e.message; }
    const row = { id: data.id, words: data.words, quickMode: Boolean(data.quickMode), seconds: (Date.now() - start) / 1000,
      calls, trace: trace.calls, diagnostics: adminSummary(trace), result,
      missing: result ? missingWords(result.article, data.words) : data.words, error };
    results.push(row);
    fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ model: 'deepseek-v3.2', date: '2026-10-06', results }, null, 2));
    console.log(JSON.stringify({ id: row.id, seconds: row.seconds, calls: calls.length, chineseChars: result?.chineseChars,
      missing: row.missing, error, article: result?.article, trace: trace.calls.map(({step,status,durationMs,usage}) => ({step,status,durationMs,usage})) }));
  }
  vm.runInContext('prisma.$disconnect()', context);
  if (results.some(row => row.error || row.missing.length)) process.exitCode = 1;
}
module.exports={invoke,tracing,missingWords,adminSummary,context};
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
