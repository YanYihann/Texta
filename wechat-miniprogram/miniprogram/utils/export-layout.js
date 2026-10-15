const reading = require('./reading');
const margins = [8, 12, 16];
function optionsFor(article, options = {}) {
  return { title: String(options.title || article.title || 'Texta').trim() || article.title || 'Texta', includeChinese: options.includeChinese !== false,
    margin: margins.includes(Number(options.margin)) ? Number(options.margin) : 12 };
}
function documentModel(article, options) {
  const settings = optionsFor(article, options);
  return { settings, title: settings.title, mode: article.generationMode === 'mixed' ? '中文嵌词' : '中英对照', count: (article.words || []).length,
    paragraphs: reading.paragraphs(article).map(block => ({ en: block.en, zh: settings.includeChinese ? block.zh : [], hasZh: settings.includeChinese && block.hasZh })),
    glossary: (article.baseLexicon && article.baseLexicon.length ? article.baseLexicon : article.lexicon || []).map(row => ({ word: row.word || '', pos: row.pos || '—',
      meaning: (row.baseMeanings && row.baseMeanings.length ? row.baseMeanings : (row.senses || []).map(sense => sense.meaning)).filter(Boolean).join('；') || '—' })) };
}
function richWrap(segments, context, maxWidth) {
  const lines = []; let line = [], width = 0;
  const originalFont = context.font, defaultBold = String(originalFont || '').startsWith('bold '), baseFont = String(originalFont || '').replace(/^bold /, '');
  function flush() { if (line.length) lines.push(line); line = []; width = 0; }
  function add(text, word) {
    if (!line.length && /^\s+$/.test(text)) return;
    const size = context.measureText(text).width;
    if (line.length && width + size > maxWidth) flush();
    if (!line.length && /^\s+$/.test(text)) return;
    if (size > maxWidth) { for (const char of text) add(char, word); return; }
    const last = line[line.length - 1];
    if (last && last.word === word) last.text += text; else line.push({ text, word });
    width += size;
  }
  segments.forEach(segment => {
    if (baseFont) context.font = (segment.word || defaultBold ? 'bold ' : '') + baseFont;
    for (const token of segment.text.match(/\n|[A-Za-z0-9'’\-]+|[^\S\n]+|./gu) || []) { if (token === '\n') flush(); else add(token, segment.word || ''); }
  });
  flush(); context.font = originalFont; return lines;
}
const WIDTH = 1120, HEIGHT = 1584;
function layoutPdf(article, context, options) {
  const model = documentModel(article, options), margin = Math.round(WIDTH * model.settings.margin / 210);
  const contentWidth = WIDTH - margin * 2, top = Math.max(margin, 80), bottom = HEIGHT - Math.max(margin, 95);
  const pages = [[]]; let ops = pages[0], y = top;
  const text = (value, x, at, size, color = '#202b24', bold = false, serif = false) => ops.push({ type: 'text', text: value, x, y: at, size, color, bold, serif });
  const rect = (x, at, width, height, color) => ops.push({ type: 'rect', x, y: at, width, height, color });
  function next() { ops = []; pages.push(ops); y = top; }
  function ensure(height) { if (y + height > bottom && ops.length) next(); }
  function paragraph(segments, size, color, lineHeight, serif, gap = 0, bold = false) {
    context.font = (bold ? 'bold ' : '') + size + 'px ' + (serif ? 'serif' : 'sans-serif');
    const lines = richWrap(segments, context, contentWidth);
    if (lines.length * lineHeight + gap <= bottom - top) ensure(lines.length * lineHeight + gap);
    lines.forEach(line => {
      ensure(lineHeight); let x = margin;
      line.forEach(segment => {
        context.font = (segment.word || bold ? 'bold ' : '') + size + 'px ' + (serif ? 'serif' : 'sans-serif');
        const width = context.measureText(segment.text).width;
        if (segment.word) rect(x, y + 2, width, size + 9, '#e4eddd');
        text(segment.text, x, y, size, color, !!segment.word || bold, serif); x += width;
      }); y += lineHeight;
    }); y += gap;
  }
  paragraph([{ text: model.title }], 46, '#202b24', 62, true, 8, true);
  text(model.mode + ' · ' + model.count + ' 个目标词', margin, y, 22, '#606963'); y += 56;
  model.paragraphs.forEach(block => {
    paragraph(block.en, 32, '#202b24', 53, true, block.hasZh ? 13 : 0);
    if (block.hasZh) paragraph(block.zh, 27, '#4d5e52', 48, false);
    y += 32;
  });
  if (model.glossary.length) {
    ensure(160); text('词汇表', margin, y, 34, '#202b24', true); y += 58;
    const widths = [contentWidth * .29, contentWidth * .15, contentWidth * .56];
    function header() {
      rect(margin, y, contentWidth, 58, '#edf2eb');
      let x = margin; ['英文', '词性', '中文翻译'].forEach((value,i) => { text(value, x + 18, y + 15, 25, '#386548', true); x += widths[i]; }); y += 58;
    }
    header();
    model.glossary.forEach((row,index) => {
      const cells = [row.word, row.pos, row.meaning].map((value,i) => {
        context.font = (i === 0 ? 'bold ' : '') + '26px ' + (i === 0 ? 'serif' : 'sans-serif');
        return richWrap([{ text: value }], context, widths[i] - 36).map(line => line.map(segment => segment.text).join(''));
      });
      let offset = 0, remaining = Math.max(...cells.map(cell => cell.length));
      const totalHeight = remaining * 40 + 28;
      if (totalHeight <= bottom - top - 58 && y + totalHeight > bottom) { next(); header(); }
      while (remaining > 0) {
        if (bottom - y < 68) { next(); header(); }
        const take = Math.min(remaining, Math.floor((bottom - y - 28) / 40)), rowHeight = take * 40 + 28;
        if (index % 2 === 1) rect(margin, y, contentWidth, rowHeight, '#f7f9f5');
        let x = margin;
        cells.forEach((cell,i) => { cell.slice(offset,offset + take).forEach((line,j) => text(line, x + 18, y + 14 + j * 40, 26, i === 0 ? '#386548' : '#202b24', i === 0, i === 0)); x += widths[i]; });
        rect(margin, y + rowHeight - 1, contentWidth, 1, '#dce3da'); y += rowHeight; offset += take; remaining -= take;
        if (remaining) { next(); header(); }
      }
    });
  }
  pages.forEach((page,index) => {
    page.unshift({ type: 'text', text: 'Texta', x: margin, y: 28, size: 23, color: '#386548', bold: true, serif: true });
    page.push({ type: 'rect', x: margin, y: HEIGHT - 68, width: contentWidth, height: 1, color: '#dce3da' },
      { type: 'text', text: 'Texta · 词汇学习', x: margin, y: HEIGHT - 48, size: 20, color: '#606963' },
      { type: 'text', text: (index + 1) + ' / ' + pages.length, x: WIDTH - margin - 90, y: HEIGHT - 48, size: 20, color: '#606963' });
  });
  return { pages, width: WIDTH, height: HEIGHT, model };
}
module.exports = { optionsFor, documentModel, richWrap, layoutPdf };
