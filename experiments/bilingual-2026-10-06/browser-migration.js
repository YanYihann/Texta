async page => {
  const restored = await page.evaluate(() => ({ title: document.getElementById('articleTitle').textContent,
    pairs: latestSentencePairs.length, enMarks: document.querySelectorAll('#articleBlocks .vocab-en').length,
    zhMarks: document.querySelectorAll('#articleBlocks .vocab-zh').length }));
  if (restored.pairs !== 8 || restored.enMarks !== 12 || restored.zhMarks !== 12) throw Error('Favorite restore failed');
  await page.goto('http://127.0.0.1:3013/__qa');
  await page.evaluate(() => localStorage.setItem('texta_draft_bilingual-qa', JSON.stringify({words:'budget, process',level:'高级',mode:'standard',quality:'advanced',quick:true})));
  await page.goto('http://127.0.0.1:3013/app.html');
  await page.waitForFunction(() => document.getElementById('shortMode')?.checked);
  const migrated = await page.evaluate(() => ({ levelRemoved: !document.getElementById('level'), shortMode: document.getElementById('shortMode').checked,
    mode: document.getElementById('generationMode').value, quality: document.getElementById('generationQuality').value,
    words: document.getElementById('words').value }));
  if (!migrated.levelRemoved || !migrated.shortMode || migrated.mode !== 'standard' || migrated.quality !== 'normal' || migrated.words !== 'budget, process') throw Error('Legacy draft migration failed');
  await page.evaluate(stats => { window.__bilingualMigrationQa = stats; }, { restored, migrated });
  return { restored, migrated };
}
