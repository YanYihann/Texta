const { key } = require('./words');
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function highlight(text, words) {
  const source = String(text || '');
  const targets = words.filter(Boolean).sort((a, b) => b.length - a.length);
  if (!targets.length) return [{ text: source, word: '' }];
  const pattern = new RegExp('(^|[^A-Za-z])(' + targets.map(escapeRegExp).join('|') + ')(?=$|[^A-Za-z])', 'gi');
  const chunks = []; let cursor = 0, match;
  while ((match = pattern.exec(source))) {
    const start = match.index + match[1].length;
    if (start > cursor) chunks.push({ text: source.slice(cursor, start), word: '' });
    chunks.push({ text: match[2], word: key(match[2]) }); cursor = start + match[2].length;
  }
  if (cursor < source.length) chunks.push({ text: source.slice(cursor), word: '' });
  return chunks;
}
function spans(text, ranges) {
  const out = []; let cursor = 0;
  ranges.sort((a, b) => a.start - b.start).forEach(range => {
    if (range.start < cursor || range.start < 0 || range.end <= range.start || range.end > text.length) return;
    if (range.start > cursor) out.push({ text: text.slice(cursor, range.start), word: '' });
    out.push({ text: text.slice(range.start, range.end), word: range.word }); cursor = range.end;
  });
  if (cursor < text.length) out.push({ text: text.slice(cursor), word: '' });
  return out;
}
function paragraphs(article) {
  const en = article.paragraphsEn && article.paragraphsEn.length ? article.paragraphsEn : String(article.article || '').split(/\n\s*\n/);
  return en.map((text, index) => {
    const zh = String((article.paragraphsZh || [])[index] || '');
    const english = [], chinese = [];
    (article.alignment || []).forEach(row => {
      (row.occurrences || []).filter(item => item.paragraph === index).forEach(item => {
        english.push({ start: item.enStart, end: item.enEnd, word: key(row.word) });
        chinese.push({ start: item.zhStart, end: item.zhEnd, word: key(row.word) });
      });
    });
    return { en: english.length ? spans(text, english) : highlight(text, article.words || []), zh: spans(zh, chinese), hasZh: !!zh };
  });
}
function definition(article, word) {
  const id = key(word);
  const base = (article.baseLexicon || []).find(entry => key(entry.word) === id);
  const entry = (article.lexicon || []).find(row => key(row.word) === id);
  const context = (article.contextGlosses || []).find(row => key(row.word) === id);
  return Object.assign({}, entry || {}, base || {}, { word: base ? base.word : entry ? entry.word : word,
    contextMeaning: context ? context.contextMeaning : (entry && entry.senses && entry.senses[0] ? entry.senses[0].meaning : '') });
}
function plainText(article) {
  const lines = [article.title, ''];
  const en = article.paragraphsEn && article.paragraphsEn.length ? article.paragraphsEn : String(article.article || '').split(/\n\s*\n/);
  en.forEach((text, i) => { lines.push(text); if ((article.paragraphsZh || [])[i]) lines.push(article.paragraphsZh[i]); lines.push(''); });
  lines.push('词汇表');
  (article.baseLexicon && article.baseLexicon.length ? article.baseLexicon : article.lexicon || []).forEach(row => lines.push(row.word + ' ' + (row.pos || '') + ' ' +
    (row.baseMeanings && row.baseMeanings.length ? row.baseMeanings : (row.senses || []).map(sense => sense.meaning)).join('；')));
  return lines.join('\n');
}
module.exports = { highlight, spans, paragraphs, definition, plainText };
