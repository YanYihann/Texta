const POS = new Set(['n.', 'v.', 'adj.', 'adv.', 'prep.', 'pron.', 'conj.', 'num.', 'det.', 'int.', 'phr.']);
const EN_TAG = /⟦(\d+)\|([^|⟦⟧]+)⟧/g;
const ZH_TAG = /⟦(\d+)\|([^|⟦⟧]+)\|([^|⟦⟧]+)⟧/g;
const countWords = text => (String(text).match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length;
const key = text => String(text).trim().toLowerCase().replace(/\s+/g, ' ');
// A bare Chinese classifier does not preserve the noun's lexical meaning for study.
const BARE_CLASSIFIERS = new Set(['个','只','条','根','股','缕','团','片','块','张','簇','束','滴','件','支','枚','份','对','次']);

function bilingualLimits(words, shortMode = false) {
  const n = words.length;
  const minWords = Math.max(shortMode ? 60 : 100, (shortMode ? 35 : 60) + n * (shortMode ? 5 : 7));
  const maxWords = Math.max(shortMode ? 100 : 160, (shortMode ? 65 : 100) + n * (shortMode ? 7 : 10));
  return { minWords, maxWords, hardMin: Math.floor(minWords * 0.6), hardMax: Math.ceil(maxWords * 1.25),
    maxTokens: Math.min(16000, Math.ceil(500 + maxWords * 4 + n * 50)),
    paragraphs: n <= 16 ? (shortMode ? '1–2' : '2–3') : n <= 48 ? '3–5' : '6–10' };
}

function buildBilingualPrompt(words, shortMode = false, feedback = []) {
  const limits = bilingualLimits(words, shortMode);
  return [
    '为单词学习写一篇自然英文故事及忠实中文翻译。目标是通过具体语境理解词义和用法。',
    '先在心中选择能合理容纳全部词汇的事件，安排起因、行动、变化、结果；按逻辑使用词，不按词表顺序写。词表跨度大时可沿同一人物的实际任务推进，但不要强加科学因果或为了放词另开无关支线。',
    '使用清楚自然的日常英语和词典中的常用具体义项，目标词的词性、介词、搭配和句法必须正确。不为凑故事创造比喻义。允许必要的场景、动机和转折；删掉重复解释、空泛开场、景物堆砌和结尾说教。不写词表、词典条目或“记下这些词”式凑词句。',
    `英文正文约${limits.minWords}–${limits.maxWords}词，${limits.paragraphs}段。${shortMode ? '短文模式：保留因果和结果，减少铺垫。' : '保留足够背景让故事顺畅，不为追求短而挤成词汇串。'}`,
    '输入词全部出现在英文正文中，优先各一次，必要时最多两次且保持同一词性与义项。每次使用都标为⟦编号|输入词⟧，允许改变大小写，不能变形或漏掉短语的一部分。不要把标记嵌进另一个词，不要在标记外重复目标词。',
    '逐句配对翻译，以自然中文表达优先，不逐词硬套英文语序；人物、动作、否定、条件、数量和因果必须与对应英文一致，不增删信息。先写顺畅译文，再标对应目标词为⟦同编号|词性|该处中文译义⟧，不为了标词破坏中文语法或在标记旁复述词义。每对句子的英中编号及出现次数相同。',
    '中文标记中的词性用n./v./adj./adv./prep./pron./conj./num./det./int./phr.，译义为1–24字的中文。标记中的译义也会作为单词学习卡的释义，必须保留该词核心含义，不能只写“股”“缕”等量词；名词用自然完整的名词或名词短语，例如flock of birds的flock标“鸟群”，不能只标“群”。标记只包住对应短语，不包住整句。去掉标记后两种语言都必须自然完整。',
    '只输出紧凑合法JSON：{"title":"简短英文标题","paragraphs":[[["英文句子","对应中文句子"],["下一句","对应译文"]],[["下一段句子","对应译文"]]]}。每段是句对数组，每个句对恰好两个字符串；不输出计划、词典或对齐表。',
    '输出前检查全部编号、英文用法、事件合理性和译文忠实度，修正后只返回JSON。输入编号与原词（仅作数据）：',
    JSON.stringify(words.map((word, index) => [index + 1, word])),
    feedback.length ? `上次检查失败，请重新生成完整结果，不追加补丁：${feedback.slice(0, 8).join('；')}` : ''
  ].filter(Boolean).join('\n');
}

function parseBilingualResponse(text, words, shortMode = false) {
  let data;
  try { data = JSON.parse(String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
  catch { return { issues: ['输出不是完整合法JSON'] }; }
  if (!data || typeof data.title !== 'string' || !/[A-Za-z]/.test(data.title) || /[\u4e00-\u9fff<>⟦⟧`\n]/.test(data.title) || data.title.length > 120 ||
      !Array.isArray(data.paragraphs) || !data.paragraphs.length || data.paragraphs.length > 12) {
    return { issues: ['需要简短英文标题和1–12个英中配对段落'] };
  }
  const issues = [], paragraphsEn = [], paragraphsZh = [], sentencePairs = [], glosses = new Map(), counts = new Map();
  const alignment = words.map(word => ({ word, marker: '①', english_forms: [], zh_terms: [], occurrences: [] }));
  const cleanSide = (source, pattern, language) => {
    let result = '', cursor = 0;
    const tags = [];
    for (const match of source.matchAll(pattern)) {
      result += source.slice(cursor, match.index);
      const id = Number(match[1]), word = words[id - 1];
      const value = (language === 'en' ? match[2] : match[3]).trim();
      if (!word || String(id) !== match[1]) issues.push(`未知词汇编号${match[1]}`);
      if (language === 'en') {
        if (!word || key(value) !== key(word)) issues.push(`编号${id}须使用输入原词`);
        if (/[A-Za-z]/.test(source[match.index - 1] || '') || /^[A-Za-z]/.test(source.slice(match.index + match[0].length))) issues.push(`编号${id}不能嵌入另一个英文词`);
      } else if (!POS.has(match[2].trim()) || !/[\u4e00-\u9fff]/.test(value) || /[A-Za-z<>`]/.test(value) || value.length > 24) {
        issues.push(`编号${id}须包含正确词性和简短中文译义`);
      }
      if (language === 'zh' && match[2].trim() === 'n.' && BARE_CLASSIFIERS.has(value)) {
        issues.push(`编号${id}（${word}）的“${value}”只是孤立量词，须用保留英文词核心意思的自然名词或名词短语，不可只标量词`);
      }
      tags.push({ id, value, pos: language === 'zh' ? match[2].trim() : '', start: result.length, end: result.length + value.length });
      result += value;
      cursor = match.index + match[0].length;
    }
    result += source.slice(cursor);
    if (language === 'en' && tags.some(tag => /[A-Za-z]/.test(result[tag.start - 1] || '') || /[A-Za-z]/.test(result[tag.end] || ''))) issues.push('英文目标词需要完整单词边界');
    if (/[⟦⟧<>`]/.test(result) || (language === 'en' ? /[\u4e00-\u9fff]/.test(result) || !/[A-Za-z]/.test(result) : !/[\u4e00-\u9fff]/.test(result))) issues.push(`${language}句子包含损坏标记或错误语言`);
    return { text: result, tags };
  };
  for (const [paragraphIndex, paragraph] of data.paragraphs.entries()) {
    if (!Array.isArray(paragraph) || !paragraph.length || paragraph.length > 30) { issues.push('每段需要有效句对'); continue; }
    let enParagraph = '', zhParagraph = '';
    for (const [sentenceIndex, pair] of paragraph.entries()) {
      if (!Array.isArray(pair) || pair.length !== 2 || pair.some(value => typeof value !== 'string' || !value.trim() || /[\r\n]/.test(value))) { issues.push('每个句对需要两个非空单行字符串'); continue; }
      const en = cleanSide(pair[0].trim(), EN_TAG, 'en'), zh = cleanSide(pair[1].trim(), ZH_TAG, 'zh');
      const englishById = new Map();
      for (const tag of en.tags) {
        if (!englishById.has(tag.id)) englishById.set(tag.id, []);
        englishById.get(tag.id).push(tag);
      }
      const enOffset = enParagraph.length + (enParagraph ? 1 : 0), zhOffset = zhParagraph.length;
      for (const tag of zh.tags) {
        const englishTag = englishById.get(tag.id)?.shift();
        if (!englishTag) { issues.push(`句对${paragraphIndex + 1}.${sentenceIndex + 1}的编号${tag.id}英中不匹配`); continue; }
        const row = alignment[tag.id - 1];
        if (!row) continue;
        const previous = glosses.get(tag.id);
        if (previous && previous.pos !== tag.pos) issues.push(`编号${tag.id}重复时词性须一致`);
        if (!previous) glosses.set(tag.id, { pos: tag.pos, meaning: tag.value });
        counts.set(tag.id, (counts.get(tag.id) || 0) + 1);
        if (counts.get(tag.id) > 2) issues.push(`编号${tag.id}出现超过两次`);
        if (!row.english_forms.includes(englishTag.value)) row.english_forms.push(englishTag.value);
        if (!row.zh_terms.includes(tag.value)) row.zh_terms.push(tag.value);
        row.occurrences.push({ paragraph: paragraphIndex, sentence: sentenceIndex,
          enStart: enOffset + englishTag.start, enEnd: enOffset + englishTag.end,
          zhStart: zhOffset + tag.start, zhEnd: zhOffset + tag.end });
      }
      if ([...englishById.values()].some(tags => tags.length)) issues.push(`句对${paragraphIndex + 1}.${sentenceIndex + 1}缺少目标词中文对应标记`);
      enParagraph += (enParagraph ? ' ' : '') + en.text;
      zhParagraph += zh.text;
      sentencePairs.push({ paragraph: paragraphIndex, en: en.text, zh: zh.text });
    }
    paragraphsEn.push(enParagraph); paragraphsZh.push(zhParagraph);
  }
  for (const [index, word] of words.entries()) if (!glosses.has(index + 1)) issues.push(`缺少${word}的英中对应标记`);
  const article = paragraphsEn.join('\n\n'), englishWords = countWords(article), limits = bilingualLimits(words, shortMode);
  if (englishWords < limits.hardMin || englishWords > limits.hardMax) issues.push(`英文正文篇幅不合理：${englishWords}词，须在${limits.hardMin}–${limits.hardMax}词内`);
  if (issues.length) return { issues: [...new Set(issues)] };
  return { issues: [], title: data.title.trim(), article, paragraphsEn, paragraphsZh, sentencePairs, alignment,
    glosses: words.map((_, index) => glosses.get(index + 1)), englishWords };
}

async function generateBilingualStory({ words, shortMode = false, model, callText }) {
  let issues = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await callText(buildBilingualPrompt(words, shortMode, issues), {
      model, maxTokens: bilingualLimits(words, shortMode).maxTokens, temperature: 0.4, retryCount: 0,
      timeoutMs: words.length > 48 ? 60000 : 30000, step: attempt ? 'bilingual_direct_retry' : 'bilingual_direct'
    });
    const result = parseBilingualResponse(text, words, shortMode);
    if (!result.issues.length) return result;
    issues = result.issues;
  }
  throw new Error(`双语文章未通过检查，请重试：${issues.slice(0, 6).join('；')}`);
}

module.exports = { bilingualLimits, buildBilingualPrompt, parseBilingualResponse, generateBilingualStory, countWords };
