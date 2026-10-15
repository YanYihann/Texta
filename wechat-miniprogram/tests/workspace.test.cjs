const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers.cjs');
const fixture = require('./fixture.cjs');
const { documentModel, richWrap, layoutPdf } = require('../miniprogram/utils/export-layout');
const exporter = require('../miniprogram/utils/export');
const event = index => ({ currentTarget: { dataset: { index } } });

test('chip input keeps phrases and unfinished drafts, deduplicates and survives reopening', () => {
  const env = setup(), page = env.page('index/index.js');
  page.onDraftInput({ detail: { value: 'take part in, journey, JOURNEY,' } });
  assert.deepEqual(page.data.chips.map(row => row.word), ['take part in','journey']);
  page.onDraftInput({ detail: { value: 'curi' } });
  assert.equal(page.data.completion, 'curious');
  page.acceptCompletion(); assert.equal(page.data.draftInput, 'curious');
  const reopened = env.page('index/index.js'); reopened.onLoad();
  assert.equal(reopened.data.count, 3); assert.equal(reopened.data.draftInput, 'curious');
  reopened.editWord(event(0));
  assert.equal(reopened.data.draftInput, 'take part in');
  assert.deepEqual(reopened.data.chips.map(row => row.word), ['journey','curious']);
  reopened.commitDraft(); reopened.removeWord(event(0));
  assert.deepEqual(reopened.data.chips.map(row => row.word), ['curious','take part in']);
});

test('spelling assistance is local, conservative and corrects words inside phrases only on tap', () => {
  const env = setup(), page = env.page('index/index.js');
  page.onInput({ detail: { value: 'a beuatiful journey, curious' } });
  assert.equal(page.data.input, 'a beuatiful journey\ncurious');
  assert.equal(page.data.suggestions[0].suggestion, 'beautiful');
  page.replaceSuggestion(event(0)); assert.equal(page.data.input, 'a beautiful journey\ncurious');
  assert.equal(env.requests.length, 0); assert.equal(env.navigation.length, 0);
  const assist = require('../miniprogram/utils/word-assist');
  for (const word of ['curious','journey','granite','meteorology','curio','jrrzzzz']) assert.equal(assist.mistake(word), null);
});

test('generation includes the last uncommitted phrase once and retains draft on failure', async () => {
  const env = setup(); env.login(); const page = env.page('index/index.js');
  page.onDraftInput({ detail: { value: 'journey,' } }); page.onDraftInput({ detail: { value: 'take part in' } });
  env.handle(o => o.url.endsWith('/api/generate') ? o.fail({ errMsg: 'request:fail timeout' }) : o.success({ statusCode: 200, data: { usage: { remaining: 3 } } }));
  await page.generate();
  assert.equal(env.requests.find(row => row.url.endsWith('/api/generate')).data.words, 'journey\ntake part in');
  assert.deepEqual(page.data.chips.map(row => row.word), ['journey','take part in']);
});

test('all pages load the saved palette and changing theme updates the page stack and native chrome', () => {
  const env = setup(), calls = [];
  wx.setNavigationBarColor = value => calls.push(value); wx.setBackgroundColor = () => {}; wx.setTabBarStyle = value => calls.push(value);
  const pages = ['index/index.js','library/library.js','profile/profile.js','auth/auth.js','result/result.js','legal/legal.js'].map(path => env.page(path));
  global.getCurrentPages = () => pages;
  const theme = require('../miniprogram/utils/theme'); theme.set('dark');
  assert.ok(pages.every(page => page.data.themeId === 'dark' && page.data.themeStyle.includes('--bg:#1c221e')));
  assert.equal(calls[0].frontColor, '#ffffff');
  theme.set('ocean'); assert.ok(pages.every(page => page.data.themeId === 'ocean'));
  const reopened = env.page('auth/auth.js'); reopened.onShow(); assert.equal(reopened.data.themeId, 'ocean');
  assert.equal(theme.palettes.length, 6);
});

test('export options change title and translation but keep vocabulary and exact highlighted ranges', () => {
  const model = documentModel(fixture, { title: '我的学习文章', includeChinese: false, margin: 16 });
  assert.equal(model.title, '我的学习文章'); assert.equal(model.settings.margin, 16);
  assert.ok(model.paragraphs.every(row => !row.hasZh && row.zh.length === 0));
  assert.deepEqual(model.paragraphs[0].en.filter(row => row.word).map(row => row.text), ['curious','journey']);
  assert.equal(model.glossary[0].meaning, '旅行；旅程');
  const docx = Buffer.from(exporter.docx(fixture, { title: '我的 <文章>', includeChinese: false })).toString('utf8');
  assert.match(docx, /我的 &lt;文章&gt;/); assert.match(docx, /<w:tblHeader\/>/); assert.match(docx, /w:fill="E4EDDD"/);
  assert.match(docx, /旅行；旅程/); assert.doesNotMatch(docx, /一个好奇的学生/); assert.match(docx, /footer1.xml/);
});

test('PDF layout paginates long bilingual articles and tall glossary rows with repeated headers', () => {
  const context = { font: '', measureText(text) { return { width: [...text].reduce((n,char) => n + (char.charCodeAt(0) > 127 ? 28 : 16), 0) * (this.font.startsWith('bold') ? 1.08 : 1) }; } };
  const long = Object.assign({}, fixture, { paragraphsEn: Array(16).fill(fixture.paragraphsEn[0].repeat(4)), paragraphsZh: Array(16).fill(fixture.paragraphsZh[0].repeat(8)),
    alignment: [], baseLexicon: [{ word: 'curious', pos: 'adj.', baseMeanings: ['好奇的'.repeat(1100)] }, ...fixture.baseLexicon] });
  const result = layoutPdf(long, context);
  assert.ok(result.pages.length > 5);
  const ops = result.pages.flat();
  assert.ok(ops.filter(op => op.text === '中文翻译').length > 1);
  const sourceOccurrences = (long.paragraphsZh.join('') + long.baseLexicon.flatMap(row => row.baseMeanings).join('')).match(/好奇的/g).length;
  assert.equal(ops.filter(op => op.type === 'text').map(op => op.text).join('').match(/好奇的/g).length, sourceOccurrences);
  assert.ok(ops.every(op => op.y >= 0 && op.y + (op.height || op.size || 0) <= result.height));
  for (const page of result.pages) assert.ok(page.some(op => op.text === 'Texta · 词汇学习'));
  const wrapped = richWrap([{ text: 'supercalifragilistic 中文', word: 'word' }], context, 80);
  assert.ok(wrapped.every(line => context.measureText(line.map(segment => segment.text).join('')).width <= 80));
});
