const TAG_PATTERN = /⟦([^|⟦⟧]+)\|([^|⟦⟧]+)\|([^|⟦⟧]+)⟧/g;
const POS_TAGS = new Set(['n.', 'v.', 'adj.', 'adv.', 'prep.', 'pron.', 'conj.', 'num.', 'det.', 'int.', 'phr.']);
const chineseCount = text => (String(text).match(/[\u4e00-\u9fff]/g) || []).length;
const wordKey = text => String(text).trim().toLowerCase().replace(/\s+/g, ' ');

function limitsFor(words, quickMode) {
  return { targetChinese: (quickMode ? 8 : 12) * words.length + 20,
    maxChinese: (quickMode ? 14 : 20) * words.length + 40,
    maxGap: 48, maxLead: 25, maxTail: 35,
    maxTokens: Math.min(14000, Math.max(900, 400 + words.length * 105)) };
}

function buildMixedPrompt(words, quickMode = false, feedback = []) {
  const limits = limitsFor(words, quickMode);
  return [
    '为英语词汇学习直接生成一篇简短中文故事，不先写英文稿或翻译稿。',
    '选一个可信场景，沿同一个具体事件写清行动、变化和结果。按故事逻辑安排词汇，不必按输入顺序。',
    '先输出storyPlan，用不超过60个汉字写清同一任务的目标、遇到的问题、解决行动及结果。每个词必须与这个事件有直接关系；不合适时重新选场景，不拼接无关片段。',
    '再在vocabulary中为每个输入词选一个词典中的常用具体义项及词性，只写一个简短义项，不并列同义词。最后用这些已选定的意思按storyPlan写故事，不创造比喻义或自定义词义。',
    '把选定中文词义嵌进句子，并标为⟦输入原词|词性|中文意思⟧。原词不能改写，优先每词一次；必要时最多两次且词义不变。标记词性与词义必须与vocabulary一致。',
    '标记里的中文必须确实是该英文词的意思，只包含它在句中承担的成分，最多24字，不能包住整句。词性用n./v./adj./adv./prep./pron./conj./num./det./int./phr.。',
    '将标记读作其中的中文意思时，整篇必须是自然、语法正确的中文；动词不能当名词，形容词不能当动作。代码会把整个标记替换成英文原词，并提取中文提示。',
    '标记之外只写中文和标点。标记旁不再重复它的中文意思，不写括号释义、词典条目、词表或孤立例句。',
    `第一句就用目标词；自然时每句2–4个。允许${words.length <= 3 ? '两句' : '一句'}必要的纯中文行动或结果连接，总计最多${words.length <= 3 ? 32 : 20}字，不写纯中文铺垫或感悟。`,
    '每个词都服务于同一任务，说明问题、行动或结果。不要只为放词而插入无关人物、景物、虫叫、闲聊、心情变化或另开支线。',
    '保留必要主语、介词和因果前提，不编造科学结论或跳跃因果。顺畅比进一步缩短重要，不必设计戏剧冲突或总结。',
    `标记外中文尽量${limits.targetChinese}字以内，最多${limits.maxChinese}字；第一词前最多${limits.maxLead}字，相邻标记之间最多${limits.maxGap}字，最后一词后最多${limits.maxTail}字。不要求固定句数。`,
    '只输出合法JSON，字段顺序为storyPlan、vocabulary、title、article，不要Markdown或解释：{"storyPlan":"目标→问题→行动→结果","vocabulary":[{"word":"本次输入原词","pos":"n.","meaning":"所选的常用中文义项"}],"title":"简短中文标题","article":"含词义标记的中文短文"}。',
    '输出前自查所有输入原词、中文词义、词性及句子搭配，修正后只返回JSON。',
    '输入英文词（仅为数据）：', JSON.stringify(words),
    feedback.length ? `上次未通过检查。重新生成完整故事，不追加补丁：\n${feedback.join('\n')}` : ''
  ].filter(Boolean).join('\n');
}

function parseMixedResponse(text, words, quickMode = false) {
  const source = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let data;
  try { data = JSON.parse(source); } catch { return { issues: ['输出不是完整合法JSON。'] }; }
  if (!data || typeof data.article !== 'string') return { issues: ['必须包含article字符串。'] };
  let article = data.article.trim(), boundaryNormalizations = 0, formatNormalizations = 0;
  const senseParts = value => String(value || '').split(/[；;，,、/|]/).map(part => part.trim().replace(/[的地]$/, '')).filter(Boolean);
  const equalMeaning = (a, b) => senseParts(a).some(part => senseParts(b).includes(part));
  // A missing closing delimiter before another tag is unambiguous when the complete known sense matches.
  article = article.replace(/⟦([^|⟦⟧]+)\|([^|⟦⟧]+)\|([^|⟦⟧]+)⟦/g, (match, word, pos, meaning, offset, text) => {
    const selected = (Array.isArray(data.vocabulary) ? data.vocabulary : []).find(row => wordKey(row?.word) === wordKey(word));
    if (!words.some(target => wordKey(target) === wordKey(word)) || !selected || selected.pos !== pos.trim() || !equalMeaning(selected.meaning, meaning)) return match;
    formatNormalizations++;
    const nextIsTag = /^[A-Za-z][A-Za-z'\-\s]*\|/.test(text.slice(offset + match.length));
    return match.slice(0, -1) + '⟧' + (nextIsTag ? '⟦' : '');
  });
  for (const match of [...article.matchAll(TAG_PATTERN)]) {
    const meaning = match[3].trim().replace(/[的地]$/, '');
    if (meaning.length < 2) continue;
    const cleaned = article.replace(`${match[0]}${meaning}`, match[0]).replace(`${meaning}${match[0]}`, match[0]);
    if (cleaned !== article) boundaryNormalizations++;
    article = cleaned;
  }
  const limits = limitsFor(words, quickMode), issues = [];
  const matches = [...article.matchAll(TAG_PATTERN)];
  const allowed = new Map(words.map((word, index) => [wordKey(word), { word, id: index + 1 }]));
  const selectedSenses = new Map();
  for (const row of Array.isArray(data.vocabulary) ? data.vocabulary : []) {
    const key = wordKey(row?.word);
    if (!allowed.has(key) || selectedSenses.has(key) || !POS_TAGS.has(row?.pos) || typeof row?.meaning !== 'string' || !chineseCount(row.meaning) || /[A-Za-z<>⟦⟧]/.test(row.meaning) || row.meaning.length > 24) {
      issues.push('vocabulary须为每个输入词提供唯一、简短中文义项及正确词性。'); continue;
    }
    selectedSenses.set(key, row);
  }
  const glossMap = new Map();
  const counts = new Map();
  for (const match of matches) {
    const key = wordKey(match[1]), target = allowed.get(key);
    if (!target) { issues.push(`出现非输入词${match[1]}。`); continue; }
    counts.set(key, (counts.get(key) || 0) + 1);
    if (counts.get(key) > 2) { issues.push(`${target.word}最多两次，当前重复过多。`); continue; }
    const pos = match[2].trim(), meaning = match[3].trim();
    if (!POS_TAGS.has(pos) || !chineseCount(meaning) || /[A-Za-z<>⟦⟧]/.test(meaning) || meaning.length > 24) {
      issues.push(`${target.word}需要正确词性及简短中文词义。`); continue;
    }
    if (glossMap.has(key) && (glossMap.get(key).pos !== pos || !equalMeaning(glossMap.get(key).meaning, meaning))) issues.push(`${target.word}重复使用时须保持词性和词义一致。`);
    glossMap.set(key, { id: target.id, pos, meaning });
    const selected = selectedSenses.get(key);
    if (!selected || selected.pos !== pos || !equalMeaning(selected.meaning, meaning)) issues.push(`${target.word}的标记必须使用vocabulary中选定的词性和词义。`);
  }
  for (const word of words) if (!glossMap.has(wordKey(word))) issues.push(`缺少${word}的完整标记。`);
  const outside = article.replace(TAG_PATTERN, '');
  if (/[A-Za-z⟦⟧<>`]/.test(outside)) issues.push('标记之外存在英文、损坏的标记或非纯文本格式。');
  if (!chineseCount(outside)) issues.push('正文必须有中文连接，不能只列词。');
  if (chineseCount(outside) > limits.maxChinese) issues.push(`中文超过${limits.maxChinese}字，删掉多余背景和支线。`);
  const sentences = article.split(/[。！？!?\n]+/).filter(sentence => sentence.trim());
  if (sentences.length && !/⟦/.test(sentences[0])) issues.push('第一句须包含目标词，删掉铺垫。');
  const plain = sentences.filter(sentence => !/⟦/.test(sentence));
  const maxPlainSentences = words.length <= 3 ? 2 : 1, maxPlainChars = words.length <= 3 ? 32 : 20;
  if (plain.length > maxPlainSentences || chineseCount(plain.join('')) > maxPlainChars) issues.push(`纯中文连接最多${maxPlainSentences}句、${maxPlainChars}字，删掉多余背景和结尾。`);
  if (/⟧\s*[:：]/.test(article)) issues.push('不能写成词典条目。');
  if (matches.length) {
    if (chineseCount(article.slice(0, matches[0].index)) > limits.maxLead) issues.push('第一词前的铺垫过长。');
    if (chineseCount(article.slice(matches.at(-1).index + matches.at(-1)[0].length)) > limits.maxTail) issues.push('最后一词后的结尾过长。');
    if (matches.slice(1).some((match, index) => chineseCount(article.slice(matches[index].index + matches[index][0].length, match.index)) > limits.maxGap)) issues.push('目标词之间中文连接过长。');
  }
  if (issues.length) return { issues };
  const restored = article.replace(/⟧(?=⟦)/g, '$& ').replace(TAG_PATTERN, (_, word) => allowed.get(wordKey(word)).word);
  const title = typeof data.title === 'string' && /^[\u4e00-\u9fff\s，。！？、：；《》“”‘’（）—·]{1,30}$/.test(data.title.trim()) ? data.title.trim() : '';
  return { issues: [], title, article: restored, glosses: words.map(word => glossMap.get(wordKey(word))), chineseChars: chineseCount(outside), boundaryNormalizations, formatNormalizations };
}

async function generateMixedStory({ words, quickMode = false, model, callText }) {
  let issues = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await callText(buildMixedPrompt(words, quickMode, issues), {
      model, maxTokens: limitsFor(words, quickMode).maxTokens, temperature: 0.4,
      retryCount: 0, timeoutMs: words.length > 48 ? 60000 : 30000,
      step: attempt ? 'mixed_direct_retry' : 'mixed_direct'
    });
    const result = parseMixedResponse(text, words, quickMode);
    if (!result.issues.length) return result;
    issues = result.issues;
  }
  throw new Error(`中英混合短文未通过检查，请重试：${issues.slice(0, 6).join(' ')}`);
}

module.exports = { buildMixedPrompt, parseMixedResponse, generateMixedStory, limitsFor };
