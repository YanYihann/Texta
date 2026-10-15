const { plainText } = require('./reading');
const { documentModel, layoutPdf, optionsFor } = require('./export-layout');

function utf8(text) {
  const bytes = [];
  for (const char of String(text)) {
    const n = char.codePointAt(0);
    if (n < 0x80) bytes.push(n);
    else if (n < 0x800) bytes.push(0xc0 | (n >> 6), 0x80 | (n & 63));
    else if (n < 0x10000) bytes.push(0xe0 | (n >> 12), 0x80 | ((n >> 6) & 63), 0x80 | (n & 63));
    else bytes.push(0xf0 | (n >> 18), 0x80 | ((n >> 12) & 63), 0x80 | ((n >> 6) & 63), 0x80 | (n & 63));
  }
  return new Uint8Array(bytes);
}
function concat(chunks) {
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0), result = new Uint8Array(size);
  let offset = 0; chunks.forEach(chunk => { result.set(chunk, offset); offset += chunk.length; }); return result;
}
function number(value, size) { const bytes = new Uint8Array(size); for (let i = 0; i < size; i++) bytes[i] = (value >>> (i * 8)) & 255; return bytes; }
const crcTable = Array.from({ length: 256 }, (_, i) => {
  let value = i; for (let j = 0; j < 8; j++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1; return value >>> 0;
});
function crc32(data) { let crc = 0xffffffff; for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function zip(files) {
  const local = [], directory = []; let offset = 0;
  files.forEach(file => {
    const name = utf8(file.name), data = utf8(file.content), crc = crc32(data);
    const common = [number(20, 2), number(0x800, 2), number(0, 2), number(0, 2), number(33, 2), number(crc, 4), number(data.length, 4), number(data.length, 4), number(name.length, 2), number(0, 2)];
    const header = concat([number(0x04034b50, 4), ...common, name]);
    local.push(header, data);
    directory.push(concat([number(0x02014b50, 4), number(20, 2), ...common, number(0, 2), number(0, 2), number(0, 2), number(0, 4), number(offset, 4), name]));
    offset += header.length + data.length;
  });
  const central = concat(directory);
  return concat([...local, central, number(0x06054b50, 4), number(0, 2), number(0, 2), number(files.length, 2), number(files.length, 2), number(central.length, 4), number(offset, 4), number(0, 2)]);
}
function xml(text) { return String(text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function docx(article, options) {
  const model = documentModel(article, options);
  const run = (text, marked) => '<w:r>' + (marked ? '<w:rPr><w:b/><w:shd w:val="clear" w:fill="E4EDDD"/></w:rPr>' : '') + '<w:t xml:space="preserve">' + xml(text) + '</w:t></w:r>';
  const paragraph = (segments, style) => '<w:p><w:pPr><w:pStyle w:val="' + style + '"/></w:pPr>' + segments.map(segment => run(segment.text, !!segment.word)).join('') + '</w:p>';
  const widths = [2795, 1446, 5398];
  const cell = (text, index, header, stripe) => '<w:tc><w:tcPr><w:tcW w:w="' + widths[index] + '" w:type="dxa"/>' + (header || stripe ? '<w:shd w:fill="' + (header ? 'EDF2EB' : 'F7F9F5') + '"/>' : '') + '</w:tcPr>' + paragraph([{ text }], header ? 'TableHeader' : index === 0 ? 'TableWord' : 'TableText') + '</w:tc>';
  const table = '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:insideH w:val="single" w:sz="4" w:color="DCE3DA"/><w:bottom w:val="single" w:sz="4" w:color="DCE3DA"/></w:tblBorders><w:tblCellMar><w:top w:w="130" w:type="dxa"/><w:bottom w:w="130" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>' + widths.map(width => '<w:gridCol w:w="' + width + '"/>').join('') + '</w:tblGrid>' +
    '<w:tr><w:trPr><w:tblHeader/></w:trPr>' + ['英文', '词性', '中文翻译'].map((text,index) => cell(text,index,true,false)).join('') + '</w:tr>' +
    model.glossary.map((row,index) => '<w:tr>' + [row.word,row.pos,row.meaning].map((text,column) => cell(text,column,false,index % 2 === 1)).join('') + '</w:tr>').join('') + '</w:tbl>';
  const body = paragraph([{ text: model.title }], 'Title') + paragraph([{ text: 'Texta · ' + model.mode + ' · ' + model.count + ' 个目标词' }], 'Metadata') +
    model.paragraphs.map(block => paragraph(block.en, 'English') + (block.hasZh ? paragraph(block.zh, 'Translation') : '')).join('') +
    (model.glossary.length ? paragraph([{ text: '词汇表' }], 'Heading2') + table : '');
  const style = (id, props, paragraphProps) => '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + id + '"/><w:pPr>' + paragraphProps + '</w:pPr><w:rPr>' + props + '</w:rPr></w:style>';
  const styles = '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="宋体"/><w:sz w:val="24"/><w:color w:val="202B24"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    style('Title','<w:b/><w:sz w:val="40"/>','<w:keepNext/><w:spacing w:after="200"/>') +
    style('Metadata','<w:sz w:val="19"/><w:color w:val="606963"/>','<w:keepNext/><w:spacing w:after="320"/>') +
    style('English','<w:sz w:val="26"/>','<w:widowControl/><w:spacing w:after="160" w:line="400" w:lineRule="auto"/>') +
    style('Translation','<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="微软雅黑"/><w:sz w:val="22"/><w:color w:val="4D5E52"/>','<w:widowControl/><w:spacing w:after="320" w:line="400" w:lineRule="auto"/>') +
    style('Heading2','<w:b/><w:sz w:val="28"/>','<w:keepNext/><w:spacing w:before="320" w:after="180"/>') +
    style('TableHeader','<w:b/><w:sz w:val="21"/><w:color w:val="386548"/>','<w:spacing w:after="0"/>') +
    style('TableWord','<w:b/><w:sz w:val="22"/><w:color w:val="386548"/>','<w:spacing w:after="0"/>') +
    style('TableText','<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="微软雅黑"/><w:sz w:val="21"/>','<w:spacing w:after="0"/>');
  const margin = Math.round(model.settings.margin * 1440 / 25.4);
  return zip([
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>' },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/_rels/document.xml.rels', content: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>' },
    { name: 'word/styles.xml', content: '<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' + styles + '</w:styles>' },
    { name: 'word/footer1.xml', content: '<?xml version="1.0" encoding="UTF-8"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="606963"/></w:rPr><w:t>Texta · </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>' },
    { name: 'word/document.xml', content: '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' + body + '<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="' + margin + '" w:right="' + margin + '" w:bottom="' + Math.max(margin,850) + '" w:left="' + margin + '" w:footer="400"/></w:sectPr></w:body></w:document>' }
  ]);
}
function pdfFromImages(images, width, height) {
  const objects = [utf8('<< /Type /Catalog /Pages 2 0 R >>'), utf8('<< /Type /Pages /Count ' + images.length + ' /Kids [' + images.map((_, i) => (3 + i * 3) + ' 0 R').join(' ') + '] >>')];
  images.forEach((image, i) => {
    const page = 3 + i * 3, content = page + 1, picture = page + 2;
    objects.push(utf8('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ' + picture + ' 0 R >> >> /Contents ' + content + ' 0 R >>'));
    const stream = utf8('q 595 0 0 842 0 0 cm /Im0 Do Q');
    objects.push(concat([utf8('<< /Length ' + stream.length + ' >>\nstream\n'), stream, utf8('\nendstream')]));
    objects.push(concat([utf8('<< /Type /XObject /Subtype /Image /Width ' + width + ' /Height ' + height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + image.length + ' >>\nstream\n'), image, utf8('\nendstream')]));
  });
  const chunks = [utf8('%PDF-1.4\n')], offsets = [0]; let size = chunks[0].length;
  objects.forEach((object, i) => { offsets.push(size); const data = concat([utf8((i + 1) + ' 0 obj\n'), object, utf8('\nendobj\n')]); chunks.push(data); size += data.length; });
  const xref = size;
  chunks.push(utf8('xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n' + offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('') +
    'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF'));
  return concat(chunks);
}
function wrap(text, context, maxWidth) {
  const lines = []; let current = '';
  const tokens = String(text).match(/[A-Za-z0-9'’\-]+|\s+|./gu) || [];
  tokens.forEach(token => {
    if (context.measureText(current + token).width <= maxWidth) { current += token; return; }
    if (current.trim()) lines.push(current.trimEnd()); current = '';
    if (context.measureText(token).width > maxWidth) {
      for (const char of token) {
        if (context.measureText(current + char).width > maxWidth) { lines.push(current); current = ''; }
        current += char;
      }
    } else current = token.trimStart();
  });
  if (current.trim()) lines.push(current.trimEnd()); return lines;
}
async function canvasPdf(page, article, options) {
  const canvas = await new Promise((resolve, reject) => wx.createSelectorQuery().in(page).select('#exportCanvas').fields({ node: true, size: true }).exec(rows => {
    if (rows[0] && rows[0].node) resolve(rows[0].node); else reject(new Error('无法初始化 PDF 画布，请重试。'));
  }));
  const width = 1120, height = 1584;
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d'), pages = layoutPdf(article, context, options).pages;
  const images = [], fs = wx.getFileSystemManager();
  for (let index = 0; index < pages.length; index++) {
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height); context.textBaseline = 'top';
    pages[index].forEach(op => {
      context.fillStyle = op.color;
      if (op.type === 'rect') context.fillRect(op.x, op.y, op.width, op.height);
      else { context.font = (op.bold ? 'bold ' : '') + op.size + 'px ' + (op.serif ? 'serif' : 'sans-serif'); context.fillText(op.text, op.x, op.y); }
    });
    await new Promise(resolve => canvas.requestAnimationFrame(resolve));
    const temp = await new Promise((resolve, reject) => wx.canvasToTempFilePath({ canvas, fileType: 'jpg', quality: 0.93, width, height, destWidth: width, destHeight: height, success: resolve, fail: reject }, page));
    const file = await new Promise((resolve, reject) => fs.readFile({ filePath: temp.tempFilePath, success: resolve, fail: reject }));
    images.push(new Uint8Array(file.data));
  }
  return pdfFromImages(images, width, height);
}
function fileName(article, extension) { return (String(article.title || 'Texta').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').slice(0, 48) || 'Texta') + '.' + extension; }
async function exportArticle(page, article, type, options) {
  const settings = optionsFor(article, options);
  const exported = Object.assign({}, article, { title: settings.title, paragraphsZh: settings.includeChinese ? article.paragraphsZh : [] });
  const data = type === 'pdf' ? await canvasPdf(page, article, settings) : type === 'docx' ? docx(article, settings) : utf8(plainText(exported));
  const fs = wx.getFileSystemManager(), directory = wx.env.USER_DATA_PATH + '/texta-exports';
  try { fs.mkdirSync(directory, true); } catch (_) {}
  // Keep at most eight older exports, inside the dedicated export directory.
  try {
    const old = fs.readdirSync(directory).filter(name => /\.(pdf|docx|txt)$/.test(name)).sort();
    old.slice(0, Math.max(0, old.length - 7)).forEach(name => { if (!/[\\/]/.test(name)) fs.unlinkSync(directory + '/' + name); });
  } catch (_) {}
  const path = directory + '/' + Date.now() + '-' + fileName(exported, type);
  await new Promise((resolve, reject) => fs.writeFile({ filePath: path, data: data.buffer, success: resolve, fail: reject }));
  return path;
}
module.exports = { utf8, zip, docx, pdfFromImages, wrap, fileName, exportArticle };
