/* Local word lookup. Data provenance and license: vendor/english-words.LICENSE. */
(() => {
  let words = [], known = null, loading = null;
  const cache = new Map();
  const preferred = ('resilient sustainable perspective adapt thrive balance environment experience opportunity education development communicate knowledge achieve benefit challenge community consider create culture describe discover efficient encourage essential evidence improve include increase individual influence information maintain natural necessary organise organize particular possible practice practise prepare process protect provide purpose quality receive reduce relationship require research resource responsible significant solution support technology understand university variety because beautiful different definitely accommodation separate successful').split(' ');
  function startOf(prefix) {
    let lo = 0, hi = words.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (words[mid] < prefix) lo = mid + 1; else hi = mid; }
    return lo;
  }
  function hasPrefix(prefix) { return words[startOf(prefix)]?.startsWith(prefix) || false; }
  async function load() {
    if (!loading) loading = fetch('./vendor/english-words.txt?v=4.1.0').then(response => {
      if (!response.ok) throw new Error('Word list unavailable');
      return response.text();
    }).then(source => {
      words = source.split(/\r?\n/).filter(word => /^[a-z]+$/.test(word)).sort();
      if (words.length < 10000) throw new Error('Incomplete word list');
      known = new Set(words); known.add('a'); known.add('i');
    }).catch(() => { words = []; known = null; loading = null; });
    return loading;
  }
  function completion(raw) {
    if (!known || !/^[a-z]{2,32}$/i.test(raw)) return '';
    const prefix = raw.toLowerCase();
    if (known.has(prefix)) return '';
    let candidate = preferred.find(word => word.startsWith(prefix) && known.has(word));
    if (!candidate) {
      const start = startOf(prefix);
      const candidates = words.slice(start, start + 80).filter(word => word.startsWith(prefix));
      candidate = candidates.sort((a,b) => a.length - b.length || a.localeCompare(b))[0];
    }
    if (!candidate) return '';
    return raw === raw.toUpperCase() ? candidate.toUpperCase() : raw + candidate.slice(raw.length);
  }
  function mistake(raw) {
    // Absence from a finite dictionary is not proof of an error. Require a single
    // unambiguous nearby/common word, and never flag a valid word or unfinished prefix.
    if (!known || !/^[a-z]{4,24}$/.test(raw)) return null;
    if (cache.has(raw)) return cache.get(raw);
    if (known.has(raw) || hasPrefix(raw)) return null;
    const candidates = new Map();
    const add = (word, positions) => { if (known.has(word)) candidates.set(word, positions); };
    for (let i = 0; i < raw.length; i++) {
      add(raw.slice(0,i) + raw.slice(i + 1), [i]);
      if (i + 1 < raw.length) add(raw.slice(0,i) + raw[i + 1] + raw[i] + raw.slice(i + 2), [i, i + 1]);
      for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
        add(raw.slice(0,i) + letter + raw.slice(i + 1), [i]);
        add(raw.slice(0,i) + letter + raw.slice(i), [i]);
      }
    }
    // Missing final letters are unfinished input, not a spelling error.
    const common = preferred.filter(word => candidates.has(word));
    const correction = common.length === 1 ? common[0] : candidates.size === 1 ? [...candidates.keys()][0] : '';
    const result = correction ? {suggestion: correction, positions: candidates.get(correction)} : null;
    if (cache.size > 500) cache.clear();
    cache.set(raw, result);
    return result;
  }
  window.TextaWordAssist = {load, completion, mistake};
})();
