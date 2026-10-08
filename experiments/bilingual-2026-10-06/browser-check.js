async page => {
  const before = await page.evaluate(async () => {
    const qa = await (await fetch('/__qa')).json();
    return { enMarks: document.querySelectorAll('#articleBlocks .vocab-en').length,
      zhMarks: document.querySelectorAll('#articleBlocks .vocab-zh').length,
      levelRemoved: !document.getElementById('level'), shortChecked: document.getElementById('shortMode').checked,
      detailCalls: qa.requests.filter(row => row.path === '/vocab/detail').length,
      translationCalls: qa.requests.filter(row => row.path === '/context/translation').length,
      generation: qa.requests.filter(row => row.path === '/generate').at(-1)?.body };
  });
  if (before.enMarks !== 12 || before.zhMarks !== 12 || !before.levelRemoved || !before.shortChecked ||
      before.detailCalls || before.translationCalls || !before.generation.shortMode || 'level' in before.generation || 'quickMode' in before.generation) throw Error('Generation UI contract failed');
  await Promise.all([page.waitForResponse(response => response.url().endsWith('/api/vocab/detail')),
    page.getByRole('button', { name: '词汇解析: plume①', exact: true }).click()]);
  await page.waitForFunction(() => document.querySelector('#glossary .glossary-item.active .definition-summary')?.textContent === '一股蒸汽' && document.querySelector('#glossary .glossary-item.active .speak-ipa')?.textContent.includes('/test/'));
  const after = await page.evaluate(async () => {
    const qa = await (await fetch('/__qa')).json();
    return { detailCalls: qa.requests.filter(row => row.path === '/vocab/detail').length,
      translationCalls: qa.requests.filter(row => row.path === '/context/translation').length,
      summary: document.querySelector('#glossary .glossary-item.active .definition-summary')?.textContent,
      contextTranslation: document.querySelector('#glossary .glossary-item.active .context-translation')?.textContent,
      pairedTranslation: latestSentencePairs.find(pair => /\bplume\b/i.test(pair.en))?.zh };
  });
  if (after.detailCalls !== 1 || after.translationCalls || after.contextTranslation.replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, '') !== after.pairedTranslation) throw Error('Clicked-word context contract failed');
  await page.getByRole('button', { name: '收藏文章', exact: true }).click();
  await page.waitForFunction(async () => (await (await fetch('/__qa')).json()).library.favorites.some(row => row.words.length === 12));
  await page.evaluate(stats => { window.__bilingualQa = stats; }, { before, after });
  console.log(JSON.stringify({ before, after }));
}
