const DETAIL_VERSION = 1;
const keyOf = word => String(word).trim().toLowerCase().replace(/\s+/g, ' ');
const POS = new Set(['n.','v.','adj.','adv.','prep.','pron.','conj.','num.','det.','int.','phr.']);
const clean = (value, max) => typeof value === 'string' && value.length <= max && !/[<>⟦⟧`]/.test(value) ? value.trim() : '';

function buildVocabularyPrompt(words, issues = []) {
  return [
    '为英语学习生成可长期复用的通用词典卡，不引用任何文章、用户或故事。只输出JSON数组，每个输入词恰好一项。',
    '格式：[{"word":"输入原词","pos":"n.","usIpa":"/美式IPA/","ukIpa":"/英式IPA/","meanings":["常用中文义一","常用中文义二"],"collocations":["常用英文搭配 · 中文","另一搭配 · 中文"],"wordFormation":"简短中文构词说明","synonyms":["近义词 · 中文"],"antonyms":["反义词 · 中文"]}]',
    '词性用n./v./adj./adv./prep./pron./conj./num./det./int./phr.。保留输入原词及顺序；释义1–3项，优先现代英语常用义，不为特定主题选择古义。搭配1–2项，词根说明不超过60字，近义词/反义词各0–2项。',
    '音标必须为真实IPA，不用普通字母拼读。若是短语或无法可靠给出某个音标，写空字符串；不编造音标、词源或反义词。构词无可分析部分时明确说明；不适用的近反义词用空数组，不使用“待补充”“生成失败”等占位内容。',
    JSON.stringify(words), issues.length ? '上次检查失败，请重新输出完整数组：'+issues.slice(0,6).join('；') : ''
  ].filter(Boolean).join('\n');
}

function parseVocabularyResponse(text, words) {
  let rows;
  try { rows = JSON.parse(String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')); }
  catch { return {issues:['词典输出须为完整JSON数组']}; }
  if (!Array.isArray(rows) || rows.length !== words.length) return {issues:['每个输入词须有且仅有一张词典卡']};
  const issues = [], entries = [];
  for (const [index, row] of rows.entries()) {
    const word = words[index];
    const list = (field, maxItems, required = false) => {
      const values = Array.isArray(row?.[field]) ? row[field] : null;
      if (!values || values.length > maxItems || (required && !values.length) || values.some(value => !clean(value,220) || /待补充|待完善|生成失败/.test(value))) {
        issues.push(`${word}的${field}字段不完整`); return [];
      }
      return values.map(value => value.trim());
    };
    if (keyOf(row?.word || '') !== keyOf(word) || !POS.has(row?.pos)) issues.push(`${word}的原词或词性不正确`);
    const meanings = list('meanings',3,true), collocations = list('collocations',2,true);
    if (meanings.some(value => !/[\u4e00-\u9fff]/.test(value))) issues.push(`${word}需要中文释义`);
    const ipa = field => {
      const value = row?.[field];
      if (typeof value !== 'string' || value.length > 160 || (value && (!/^\/[^/]+\/$/.test(value) || /[\u4e00-\u9fff<>`]/.test(value)))) issues.push(`${word}的${field}格式不正确`);
      return typeof value === 'string' ? value.trim() : '';
    };
    const formation = clean(row?.wordFormation,220);
    if (!formation || /待补充|待完善|生成失败/.test(formation)) issues.push(`${word}的构词说明不完整`);
    entries.push({word,pos:row?.pos,usIpa:ipa('usIpa'),ukIpa:ipa('ukIpa'),
      senses:meanings.map((meaning,i)=>({marker:['①','②','③'][i],meaning})),baseMeanings:meanings,
      collocations,wordFormation:formation,synonyms:list('synonyms',2),antonyms:list('antonyms',2),detailsReady:true});
  }
  return {issues:[...new Set(issues)],entries};
}

function validSavedEntry(row, word) {
  if (row?.version !== DETAIL_VERSION || !row.entry?.detailsReady) return null;
  const entry = row.entry;
  const checked = parseVocabularyResponse(JSON.stringify([{...entry,meanings:entry.baseMeanings}]),[word]);
  return checked.issues.length ? null : checked.entries[0];
}

function createVocabularyDetails({db,callText}) {
  const inFlight = new Map();
  async function generateChunk(words, model) {
    let issues = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await callText(buildVocabularyPrompt(words,issues),{model,temperature:0.2,
        maxTokens:250+words.length*360,retryCount:0,timeoutMs:30000,step:attempt?'vocabulary_batch_retry':'vocabulary_batch'});
      const parsed = parseVocabularyResponse(text,words);
      if (!parsed.issues.length) return parsed.entries;
      issues = parsed.issues;
    }
    throw Error('词汇解析未通过检查：'+issues.slice(0,6).join('；'));
  }
  async function getMany(inputWords, model) {
    const words = [...new Map(inputWords.map(word=>[keyOf(word),String(word).trim()])).values()];
    if (!words.length) return [];
    const rows = await db.vocabularyDetail.findMany({where:{wordKey:{in:words.map(keyOf)}}});
    const found = new Map();
    for (const row of rows) {
      const word = words.find(word=>keyOf(word)===row.wordKey), entry = word && validSavedEntry(row,word);
      if (entry) found.set(row.wordKey,entry);
    }
    const owned = [], pending = new Map();
    for (const word of words) {
      const key = keyOf(word);
      if (found.has(key)) continue;
      let task = inFlight.get(key);
      if (!task) {
        let resolve,reject;
        task = new Promise((ok,fail)=>{resolve=ok;reject=fail;});
        task.catch(()=>{}); inFlight.set(key,task);
        owned.push({word,key,resolve,reject});
      }
      pending.set(key,task);
    }
    if (owned.length) {
      const chunks = [];
      for (let offset=0;offset<owned.length;offset+=12) chunks.push(owned.slice(offset,offset+12));
      let next = 0;
      async function worker() {
        while(next<chunks.length) {
          const chunk = chunks[next++];
          try {
            const entries = await generateChunk(chunk.map(item=>item.word),model);
            // Resolve only after successful persistence; malformed/fallback results never enter the database.
            for (const [index,item] of chunk.entries()) {
              const entry=entries[index];
              await db.vocabularyDetail.upsert({where:{wordKey:item.key},
                create:{wordKey:item.key,word:item.word,entry,version:DETAIL_VERSION,model},
                update:{word:item.word,entry,version:DETAIL_VERSION,model}});
            }
            chunk.forEach((item,index)=>item.resolve(entries[index]));
          } catch(error) { chunk.forEach(item=>item.reject(error)); }
          finally { chunk.forEach(item=>inFlight.delete(item.key)); }
        }
      }
      // Two small batches can run concurrently, shared overlapping words reuse the same promise.
      void Promise.all(Array.from({length:Math.min(2,chunks.length)},worker));
    }
    const results = await Promise.all(words.map(async word=>{
      const entry = found.get(keyOf(word)) || await pending.get(keyOf(word));
      return {...entry,word};
    }));
    const byKey = new Map(results.map(entry=>[keyOf(entry.word),entry]));
    return inputWords.map(word=>({...byKey.get(keyOf(word)),word}));
  }
  return {getMany};
}

module.exports = {createVocabularyDetails,buildVocabularyPrompt,parseVocabularyResponse,DETAIL_VERSION};
