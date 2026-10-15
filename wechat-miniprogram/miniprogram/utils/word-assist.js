// Same MIT-licensed dictionary and conservative rules as the PC vocabulary editor.
let words, known;
const cache = new Map();
const preferred = ('journey curious resilient sustainable perspective adapt thrive balance environment experience opportunity education development communicate knowledge achieve benefit challenge community consider create culture describe discover efficient encourage essential evidence improve include increase individual influence information maintain natural necessary organise organize particular possible practice practise prepare process protect provide purpose quality receive reduce relationship require research resource responsible significant solution support technology understand university variety because beautiful different definitely accommodation separate successful').split(' ');
function load() {
  if (known) return;
  let previous = '';
  words = require('../data/english-words').split('\n').map(row => { previous = previous.slice(0, parseInt(row[0], 36)) + row.slice(1); return previous; });
  known = new Set(words); known.add('a'); known.add('i');
}
function startOf(prefix) { let lo = 0, hi = words.length; while (lo < hi) { const mid = (lo + hi) >>> 1; if (words[mid] < prefix) lo = mid + 1; else hi = mid; } return lo; }
function completion(raw) {
  load();
  if (!/^[a-z]{2,32}$/i.test(raw)) return '';
  const prefix = raw.toLowerCase();
  if (known.has(prefix)) return '';
  let candidate = preferred.find(word => word.startsWith(prefix));
  if (!candidate) { const start = startOf(prefix); candidate = words.slice(start, start + 80).filter(word => word.startsWith(prefix)).sort((a,b) => a.length - b.length || a.localeCompare(b))[0]; }
  return candidate ? (raw === raw.toUpperCase() ? candidate.toUpperCase() : raw + candidate.slice(raw.length)) : '';
}
function mistake(raw) {
  load();
  if (!/^[a-z]{4,24}$/.test(raw)) return null;
  if (known.has(raw) || (words[startOf(raw)] || '').startsWith(raw)) return null;
  if (cache.has(raw)) return cache.get(raw);
  const candidates = new Map(), add = (word, positions) => { if (known.has(word)) candidates.set(word, positions); };
  for (let i = 0; i < raw.length; i++) {
    add(raw.slice(0,i) + raw.slice(i + 1), [i]);
    if (i + 1 < raw.length) add(raw.slice(0,i) + raw[i + 1] + raw[i] + raw.slice(i + 2), [i, i + 1]);
    for (const letter of 'abcdefghijklmnopqrstuvwxyz') { add(raw.slice(0,i) + letter + raw.slice(i + 1), [i]); add(raw.slice(0,i) + letter + raw.slice(i), [i]); }
  }
  const common = preferred.filter(word => candidates.has(word));
  const suggestion = common.length === 1 ? common[0] : candidates.size === 1 ? [...candidates.keys()][0] : '';
  const result = suggestion ? { suggestion, positions: candidates.get(suggestion) } : null;
  if (cache.size > 500) cache.clear(); cache.set(raw, result); return result;
}
function inspect(value) {
  return (String(value).match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).map(word => ({ word, issue: mistake(word) })).filter(row => row.issue).map(row => ({ word: row.word, suggestion: row.issue.suggestion }));
}
module.exports = { load, completion, mistake, inspect };
