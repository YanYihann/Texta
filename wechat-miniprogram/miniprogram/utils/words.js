function key(word) { return String(word || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function splitWords(value) {
  const seen = new Set();
  return String(value || '').split(/[,，;；\r\n\t]+/)
    .map(word => word.trim().replace(/^[-*•\d.、\s]+/, '').replace(/\s+/g, ' '))
    .filter(word => { const id = key(word); if (!id || seen.has(id)) return false; seen.add(id); return true; });
}
function validate(words) {
  if (!words.length) return '先输入一些英文单词或短语。';
  if (words.length > 120) return '一次最多生成 120 个词，请减少一些。';
  if (words.some(word => word.length > 80 || !/^[A-Za-z][A-Za-z\s'’\-]*$/.test(word)))
    return '请只填写英文单词或短语，用逗号或换行分隔。';
  return '';
}
function importWords(content, extension) {
  if (extension === 'json') {
    const data = JSON.parse(content);
    const rows = Array.isArray(data) ? data : data.words;
    if (!Array.isArray(rows)) throw new Error('JSON 需要是单词数组，或包含 words 数组。');
    return rows.map(row => typeof row === 'string' ? row : row && row.word).filter(Boolean).join('\n');
  }
  if (extension === 'csv') {
    return content.split(/\r?\n/).map(line => line.split(/[,，]/)[0].trim().replace(/^"|"$/g, ''))
      .filter(word => word && !/^(word|words|单词)$/i.test(word)).join('\n');
  }
  return content.replace(/^\uFEFF/, '').split(/\r?\n/)
    .filter(line => !/^\s*#/.test(line)).join('\n');
}
module.exports = { key, splitWords, validate, importWords };
