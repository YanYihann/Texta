const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const { bilingualLimits, buildBilingualPrompt, parseBilingualResponse, generateBilingualStory } = require('../generation/bilingual.cjs');
const { bilingualAnswer } = require('./fixtures/bilingual.cjs');
const words = ['budget','process'];
test('paired output preserves complete stories and exact aligned word spans', () => {
  const result = parseBilingualResponse(bilingualAnswer(), words);
  assert.deepEqual(result.issues, []); assert.equal(result.paragraphsEn.length, 1);
  assert.equal(result.sentencePairs.length,4); assert.equal(result.glosses[0].meaning,'预算');
  for (const row of result.alignment) for (const hit of row.occurrences) {
    assert.equal(result.paragraphsEn[hit.paragraph].slice(hit.enStart,hit.enEnd),row.english_forms[0]);
    assert.equal(result.paragraphsZh[hit.paragraph].slice(hit.zhStart,hit.zhEnd),row.zh_terms[0]);
  }
  assert.equal(result.article,result.paragraphsEn.join('\n\n'));assert.ok(!/[⟦⟧]/.test(result.article));
});
test('missing, false, broken, wrong language, wrong POS and shifted translations fail', () => {
  const base = bilingualAnswer();
  for (const text of ['{}', 'not JSON',base.replace('⟦1|budget⟧','budget'),base.replace('⟦1|n.|预算⟧','预算'),
    base.replace('⟦1|budget⟧','⟦1|budgets⟧'),base.replace('⟦1|budget⟧','⟦9|budget⟧'),
    base.replace('⟦1|n.|预算⟧','⟦1|wrong|预算⟧'),base.replace('⟦1|n.|预算⟧','⟦1|n.|budget⟧'),
    base.replace('⟦1|n.|预算⟧','⟦1|n.|股⟧'),
    base.replace('⟦1|budget⟧','⟦1|budget'),base.replace('⟦1|budget⟧','pre⟦1|budget⟧'),
    base.replace('community workshop','中文工坊'),base.replace('A Repair Plan','修理计划'),
    base.replace('⟦1|n.|预算⟧','⟦2|n.|预算⟧'),base.replace('⟦2|n.|流程⟧','⟦1|n.|流程⟧')]) {
    assert.ok(parseBilingualResponse(text,words).issues.length,text);
  }
  const shifted=JSON.parse(base);[shifted.paragraphs[0][0][1],shifted.paragraphs[0][1][1]]=[shifted.paragraphs[0][1][1],shifted.paragraphs[0][0][1]];
  assert.ok(parseBilingualResponse(JSON.stringify(shifted),words).issues.length);
  const tooLong=JSON.parse(base);tooLong.paragraphs[0][3][0]+=' Background.'.repeat(180);
  assert.ok(parseBilingualResponse(JSON.stringify(tooLong),words).issues.some(x=>x.includes('篇幅')));
});
test('apostrophes, phrases and capitalization preserve exact content and positions',()=>{
  const text=bilingualAnswer().replaceAll('⟦1|budget⟧',"⟦1|don't⟧").replaceAll('⟦2|process⟧','⟦2|take care of⟧');
  const result=parseBilingualResponse(text,["Don't",'take care of']);
  assert.deepEqual(result.issues,[]);assert.ok(result.article.includes("don't"));
  assert.deepEqual(result.alignment[1].english_forms,['take care of']);
});
test('word-count budgets grow with input; short mode keeps space for a coherent bilingual story',()=>{
  const small=bilingualLimits(Array(12).fill('word')),short=bilingualLimits(Array(12).fill('word'),true),large=bilingualLimits(Array(120).fill('word'));
  assert.ok(short.maxWords<small.maxWords);assert.ok(short.maxWords>100);assert.ok(large.maxTokens>10000);
  assert.equal(bilingualLimits(Array(48).fill('word')).maxTokens>small.maxTokens,true);
  const prompt=buildBilingualPrompt(words,true);
  assert.ok(prompt.includes('短文模式'));assert.ok(!/Level:|难度：|IELTS-style/.test(prompt));
});
test('first valid call returns; at most one whole-story retry; network errors propagate',async()=>{
  let calls=0;
  await generateBilingualStory({words,model:'test',callText:async(prompt,options)=>{
    calls++;assert.equal(options.model,'test');assert.equal(options.retryCount,0);return bilingualAnswer();
  }});assert.equal(calls,1);
  calls=0;await generateBilingualStory({words,callText:async prompt=>{calls++;if(calls===2)assert.ok(prompt.includes('上次检查失败'));return calls===1?'{}':bilingualAnswer();}});assert.equal(calls,2);
  calls=0;await assert.rejects(()=>generateBilingualStory({words,callText:async()=>{calls++;return '{}';}}),/未通过检查/);assert.equal(calls,2);
  calls=0;await assert.rejects(()=>generateBilingualStory({words,callText:async()=>{calls++;throw Error('network');}}),/network/);assert.equal(calls,1);
});
test('precise UI highlights handle overlapping words, apostrophes and repeated Chinese without false matches',()=>{
  const source=fs.readFileSync('public/app.js','utf8'),scope=vm.createContext({keyifyWord:w=>w.toLowerCase()});
  for(const name of ['escapeHtml','highlightAlignedParagraph','sanitizeSentencePairs','validateSentencePairs']) {
    const start=source.indexOf('function '+name+'('),ends=[source.indexOf('\nfunction ',start+1),source.indexOf('\nasync function ',start+1)].filter(n=>n>=0);
    vm.runInContext(source.slice(start,Math.min(...ends)),scope);
  }
  const alignment=[{word:"don't",marker:'①',english_forms:["don't"],zh_terms:['不要'],occurrences:[{paragraph:0,enStart:2,enEnd:7,zhStart:2,zhEnd:4}]}];
  const html=scope.highlightAlignedParagraph("I don't mind.",alignment,0,'en');
  assert.ok(html.includes('don&#39;t'));assert.equal((html.match(/<mark /g)||[]).length,1);
  assert.equal((scope.highlightAlignedParagraph('他说不要。不要重复。',alignment,0,'zh').match(/<mark /g)||[]).length,1);
  assert.equal(scope.highlightAlignedParagraph('unrelated',alignment,1,'en'),'unrelated');
  assert.equal(scope.highlightAlignedParagraph('edited',alignment,0,'en'),null);
  const pairs=[{paragraph:0,en:'A.',zh:'甲。'},{paragraph:0,en:'B.',zh:'乙。'}];
  assert.equal(scope.validateSentencePairs(pairs,['A. B.'],['甲。乙。']).length,2);
  assert.equal(scope.validateSentencePairs(pairs,['changed'],['甲。乙。']).length,0);
});
