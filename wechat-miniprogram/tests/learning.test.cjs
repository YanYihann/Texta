const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers.cjs');
const words = require('../miniprogram/utils/words');
const reading = require('../miniprogram/utils/reading');
const exporter = require('../miniprogram/utils/export');
test('input preserves multiword phrases and deduplicates words', () => {
  assert.deepEqual(words.splitWords('journey，Curious\ncurious; take part in'), ['journey', 'Curious', 'take part in']);
  assert.equal(words.validate(['take part in']), ''); assert.ok(words.validate(['<script>']));
  assert.ok(words.validate(Array(121).fill('word')));
});
test('JSON, CSV and Markdown word imports match Texta lists', () => {
  assert.equal(words.importWords('{"words":["journey",{"word":"curious"}]}', 'json'), 'journey\ncurious');
  assert.equal(words.importWords('word,meaning\njourney,旅程\ncurious,好奇', 'csv'), 'journey\ncurious');
  assert.deepEqual(words.splitWords(words.importWords('# 词表\n- journey\n- curious', 'md')), ['journey', 'curious']);
  assert.throws(() => words.importWords('{}', 'json'));
});
test('highlighting respects word boundaries, long phrases, punctuation and mixed Chinese text', () => {
  const chunks = reading.highlight('A curious journey; journeys are different. 我们 take part in 活动。', ['journey', 'curious', 'take part in']);
  assert.deepEqual(chunks.filter(row => row.word).map(row => row.word), ['curious', 'journey', 'take part in']);
  assert.equal(chunks.map(row => row.text).join(''), 'A curious journey; journeys are different. 我们 take part in 活动。');
});
test('bilingual marks use exact server-provided character offsets', () => {
  const blocks = reading.paragraphs({ words: ['journey'], paragraphsEn: ['A journey begins.'], paragraphsZh: ['旅程开始了。'],
    alignment: [{ word: 'journey', occurrences: [{ paragraph: 0, enStart: 2, enEnd: 9, zhStart: 0, zhEnd: 2 }] }] });
  assert.equal(blocks[0].en.find(row => row.word).text, 'journey'); assert.equal(blocks[0].zh.find(row => row.word).text, '旅程');
});
test('dictionary meanings and article context remain separate', () => {
  const result = reading.definition({ baseLexicon: [{ word: 'journey', baseMeanings: ['旅行', '旅程'], detailsReady: true }],
    lexicon: [{ word: 'journey', senses: [{ meaning: '此次旅程' }] }], contextGlosses: [{ word: 'journey', contextMeaning: '此次旅程' }] }, 'Journey');
  assert.deepEqual(result.baseMeanings, ['旅行', '旅程']); assert.equal(result.contextMeaning, '此次旅程');
});
test('Word export is a real ZIP document with Unicode preserved and XML escaped', () => {
  const binary = exporter.docx({ title: 'A & B', article: 'A journey.', paragraphsZh: ['一次旅程。'], baseLexicon: [] });
  assert.equal(Buffer.from(binary).readUInt32LE(0), 0x04034b50);
  assert.match(Buffer.from(binary).toString('utf8'), /A &amp; B/); assert.match(Buffer.from(binary).toString('utf8'), /一次旅程/);
  assert.equal(Buffer.from(exporter.utf8('中文 🧠')).toString('utf8'), '中文 🧠');
});
test('PDF object offsets point at actual objects', () => {
  const pdf = Buffer.from(exporter.pdfFromImages([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 1120, 1584));
  const text = pdf.toString('latin1'), start = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(pdf.subarray(start, start + 4).toString(), 'xref');
  const rows = text.slice(start).split('\n').slice(3, 8);
  rows.forEach((row, i) => assert.equal(pdf.subarray(Number(row.slice(0, 10)), Number(row.slice(0, 10)) + 7).toString(), (i + 1) + ' 0 obj'));
});
test('PDF wrapping handles unbroken words and Chinese without clipping', () => {
  const context = { measureText: text => ({ width: [...text].length * 10 }) };
  const lines = exporter.wrap('unbrokenlongword 中文排版测试', context, 60);
  assert.ok(lines.every(line => context.measureText(line).width <= 60));
  assert.equal(lines.join('').replace(/ /g, ''), 'unbrokenlongword中文排版测试');
});
test('generation sends one authenticated request and stores a readable result', async () => {
  const env = setup(); env.login(); const page = env.page('index/index.js');
  page.onInput({ detail: { value: 'journey, curious' } });
  env.handle(options => options.success({ statusCode: 200, data: options.url.endsWith('/api/generate')
    ? { title: 'A journey', article: 'A curious journey.', paragraphsEn: ['A curious journey.'], generationMode: 'standard' }
    : { usage: { remaining: 3, isUnlimited: false } } }));
  await page.generate();
  const requests = env.requests.filter(row => row.url.endsWith('/api/generate'));
  assert.equal(requests.length, 1); assert.equal(requests[0].data.generationMode, 'standard');
  assert.equal(requests[0].data.words, 'journey\ncurious'); assert.equal(requests[0].header.Authorization, 'Bearer token-user-a');
  assert.equal(env.library.history()[0].article, 'A curious journey.'); assert.equal(page.data.loading, false);
});
test('generation timeout preserves input and never retries a billable request', async () => {
  const env = setup(); env.login(); const page = env.page('index/index.js'); page.onInput({ detail: { value: 'journey' } });
  env.handle(options => options.url.endsWith('/api/generate') ? options.fail({ errMsg: 'request:fail timeout' }) : options.success({ statusCode: 200, data: { usage: { remaining: 3 } } }));
  await page.generate(); assert.equal(page.data.input, 'journey'); assert.match(page.data.error, /服务端可能仍在处理/);
  assert.equal(env.requests.filter(row => row.url.endsWith('/api/generate')).length, 1); assert.equal(page.data.loading, false);
});
test('expired sessions redirect to login without submitting generation', async () => {
  const env = setup(); env.login(); const session = env.api.session(); session.expiresAt = 1; env.api.saveSession(session);
  const page = env.page('index/index.js'); page.onInput({ detail: { value: 'journey' } }); await page.generate();
  assert.equal(env.requests.length, 0); assert.deepEqual(env.navigation, ['/pages/auth/auth']);
});
test('review action reloads the existing tab input', () => {
  const env = setup(); const page = env.page('index/index.js');
  wx.setStorageSync('texta_draft', { input: 'journey\ncurious', mode: 'standard', shortMode: true }); env.app.globalData.reviewDraft = true;
  page.onShow(); assert.equal(page.data.count, 2); assert.equal(page.data.shortMode, true); assert.equal(env.app.globalData.reviewDraft, false);
});
test('incorrect login does not invalidate another session', async () => {
  const env = setup(); env.login(); env.handle(options => options.success({ statusCode: 401, data: { error: 'Invalid email or password.' } }));
  await assert.rejects(env.api.request('/api/auth/login', { method: 'POST', auth: false }), /邮箱或密码/);
  assert.equal(env.api.session().user.id, 'user-a');
});
test('expired old request does not clear a newly signed-in session', async () => {
  const env = setup(); env.login('a'); let pending; env.handle(options => { pending = options; });
  const task = env.api.request('/api/usage'); env.login('b'); pending.success({ statusCode: 401, data: { error: 'Unauthorized.' } });
  await assert.rejects(task); assert.equal(env.api.session().user.id, 'b');
});
