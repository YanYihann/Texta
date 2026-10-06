const TAG_PATTERN = /⟦([^|⟦⟧]+)\|([^|⟦⟧]+)\|([^|⟦⟧]+)⟧/g;
const POS_TAGS = new Set(['n.', 'v.', 'adj.', 'adv.', 'prep.', 'pron.', 'conj.', 'num.', 'det.', 'int.', 'phr.']);
const chineseCount = text => (String(text).match(/[\u4e00-\u9fff]/g) || []).length;
const wordKey = text => String(text).trim().toLowerCase().replace(/\s+/g, ' ');

function limitsFor(words, quickMode) {
  const n = words.length;
  const minChinese = Math.max(quickMode ? 110 : 180, (quickMode ? 60 : 90) + n * (quickMode ? 7 : 10));
  const maxChinese = Math.max(quickMode ? 180 : 280, (quickMode ? 100 : 140) + n * (quickMode ? 10 : 15));
  return { minChinese, maxChinese, hardMin: Math.floor(minChinese * 0.7),
    paragraphs: n <= 16 ? (quickMode ? '1–2' : '2–3') : n <= 48 ? '3–5' : '6–10',
    maxTokens: Math.min(16000, Math.max(1200, 300 + maxChinese * 2 + n * 75)) };
}

function buildMixedPrompt(words, quickMode = false, feedback = []) {
  const limits = limitsFor(words, quickMode);
  return [
    '为英语词汇学习直接生成一篇完整、自然的中文故事，不先写英文稿或翻译稿。',
    '固定以“小明”为主角，开头交代他为何要做这件事；围绕同一个具体目标，写清遇到的问题、他的判断和行动、由此产生的变化及明确结果。结果要回应开头，不只写一串操作或“终于完成了”。按故事逻辑安排词汇，不按词表顺序逐个放词。',
    '先在心中安排事件，再在vocabulary中为每个输入词选一个现代英语词典中的常用具体义项及词性，只写一个简短义项。不要为凑同一主题选择生僻古义、创造比喻义或改写词义；不同主题词可以作为同一任务中的实际线索、材料或障碍，不另开无关支线。',
    words.some(word => wordKey(word) === 'gorge') ? '词义提醒：gorge优先使用“峡谷”或动词“狼吞虎咽”等现代常用义，不因其他词是人体部位就把它用作日常的“咽喉”。' : '',
    '长短句自然交错，适当使用原因、条件、转折、时间先后或人物观察形成复句；句间有明确承接。避免连续“他做甲。他做乙。”的主谓宾流水账，也不为句式复杂而堆砌连接词或长定语。可以有一句简短对话，但不要用讲解、清单或背词来收集目标词。',
    '把选定中文词义嵌进句子，并标为⟦输入原词|词性|中文意思⟧。原词不能改写，优先每词一次；必要时最多两次且词义不变。标记词性与词义必须与vocabulary一致。',
    '标记里的中文必须确实是该英文词的意思，只包含它在句中承担的成分，最多24字，不能包住整句。词性用n./v./adj./adv./prep./pron./conj./num./det./int./phr.。',
    '将标记读作其中的中文意思时，整篇必须是自然、语法正确的中文；动词不能当名词，形容词不能当动作。代码会把整个标记替换成英文原词，并提取中文提示。',
    '标记之外只写中文和标点。标记旁不再重复它的中文意思，不写括号释义、词典条目、词表或孤立例句。',
    '允许必要的纯中文开场、过渡、判断和结尾，不要求每句含词或固定每句词数。背景只解释人物动机、问题或后续行动，不堆景物、人物履历、闲聊和空泛感悟；保留必要主语、介词和因果前提，不编造科学结论。',
    `正文约${limits.minChinese}–${limits.maxChinese}个汉字，按标记替换回中文释义后统计；分${limits.paragraphs}段，用两个换行分段。${quickMode ? '短文模式减少铺垫，但仍须有动机、行动、转折和结果。' : '篇幅接近一篇双语文章的中文译文，给故事留出推进空间，不把全文挤成几句凑词。'}`,
    '只输出合法JSON，字段顺序为vocabulary、title、article，不要Markdown、计划或解释：{"vocabulary":[{"word":"本次输入原词","pos":"n.","meaning":"所选的常用中文义项"}],"title":"简短中文标题","article":"含词义标记的中文短文"}。',
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
  const chineseChars = chineseCount(article.replace(TAG_PATTERN, (_, word, pos, meaning) => meaning));
  if (chineseChars < limits.hardMin) issues.push(`正文只有${chineseChars}个汉字，至少${limits.hardMin}字；补全小明的动机、判断、行动及具体结果，不重复解释或堆无关背景。`);
  if (chineseChars > limits.maxChinese) issues.push(`正文超过${limits.maxChinese}个汉字，删掉多余背景和支线，保留完整事件。`);
  if (!outside.includes('小明')) issues.push('故事必须以小明为主角，正文中须出现“小明”。');
  if (/⟧\s*[:：]/.test(article)) issues.push('不能写成词典条目。');
  if (issues.length) return { issues };
  const restored = article.replace(/⟧(?=⟦)/g, '$& ').replace(TAG_PATTERN, (_, word) => allowed.get(wordKey(word)).word);
  const title = typeof data.title === 'string' && /^[\u4e00-\u9fff\s，。！？、：；《》“”‘’（）—·]{1,30}$/.test(data.title.trim()) ? data.title.trim() : '';
  return { issues: [], title, article: restored, glosses: words.map(word => glossMap.get(wordKey(word))), chineseChars, boundaryNormalizations, formatNormalizations };
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
