(() => {
  const byId = id => document.getElementById(id);
  const homeButton = byId('workspaceHomeBtn'), library = byId('libraryPanel'), reading = document.querySelector('.reading-workspace');
  const empty = byId('emptyState'), input = document.querySelector('.input-panel'), wordSelect = byId('glossaryWordSelect');
  const exampleNotice = byId('sampleArticleNotice');
  let view = 'article', selectedWord = '', draftTimer = 0, draftKey = '', sample = false, activeDialog = null, dialogReturnFocus = null;
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const translate = text => window.TextaI18n?.text(text) || text;
  let readingHeightFrame = 0;
  function sizeReadingPanels() {
    cancelAnimationFrame(readingHeightFrame);
    readingHeightFrame = requestAnimationFrame(()=>{
      if (!reading.getClientRects().length) return;
      const style = getComputedStyle(reading);
      const top = reading.getBoundingClientRect().top + window.scrollY + parseFloat(style.paddingTop) + parseFloat(style.borderTopWidth);
      const bottom = readingMode ? 24 : isMobileLayout() ? byId('mobileBottomNav').offsetHeight + 16 : 32;
      const height = Math.max(320, Math.floor(window.innerHeight - top - bottom));
      const value = `${height}px`;
      if (reading.style.getPropertyValue('--reading-panel-height') !== value) reading.style.setProperty('--reading-panel-height',value);
    });
  }
  const readingSizeObserver = new ResizeObserver(sizeReadingPanels);
  [document.querySelector('.site-header'),input,byId('status').parentElement,reading].forEach(el=>readingSizeObserver.observe(el));
  window.addEventListener('resize',sizeReadingPanels);
  window.visualViewport?.addEventListener('resize',sizeReadingPanels);

  function showView(next, {edit = false} = {}) {
    view = next;
    document.body.dataset.workspaceView = next;
    reading.dataset.view = next;
    const isArticle = next === 'article';
    const isEditing = isArticle && (edit || !latestArticle);
    input.classList.toggle('hidden', !isEditing);
    byId('returnToReadingBtn').classList.toggle('hidden', !isEditing || !latestArticle);
    library.classList.toggle('hidden', isArticle || next === 'notebook');
    reading.classList.toggle('hidden', (!isArticle && next !== 'notebook') || (isEditing && Boolean(latestArticle)));
    byId('status').parentElement.classList.toggle('hidden', !isArticle);
    if (!isArticle) document.body.classList.remove('reading-mode');
    if (next === 'notebook') {
      glossaryPanelEl.classList.add('hidden');
      empty.classList.add('hidden');
    } else if (isArticle) {
      setResultMode('article');
      resultSection.classList.toggle('hidden', !latestArticle);
      glossaryPanelEl.classList.toggle('hidden', !latestLexicon.length);
      empty.classList.toggle('hidden', Boolean(latestArticle));
    }
    const ids = {article:'workspaceHomeBtn',favorites:'libraryFavoritesBtn',notebook:'libraryNotebookBtn',history:'libraryHistoryBtn'};
    for (const id of Object.values(ids)) {
      const button = byId(id), active = id === ids[next];
      button.classList.toggle('active',active);
      if (active) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
    }
    byId('libraryHeading').textContent = next === 'history' ? '历史记录' : '收藏夹';
    if (next === 'article') { readingMode = false; applyReadingMode(); currentMobilePage = isEditing ? 'home' : 'article'; }
    if (next === 'notebook' && isMobileLayout()) currentMobilePage = 'article';
    refreshMobileNav();
    window.TextaI18n?.apply();
    sizeReadingPanels();
  }
  function openWordEditor() {
    showView('article', {edit:true});
    window.scrollTo({top:0,behavior:reduceMotion()?'auto':'smooth'});
    wordsInput.focus({preventScroll:true});
  }
  homeButton.addEventListener('click',openWordEditor);
  byId('editWordsBtn').addEventListener('click',openWordEditor);
  byId('returnToReadingBtn').addEventListener('click',()=>{
    showView('article');
    window.scrollTo({top:0,behavior:reduceMotion()?'auto':'smooth'});
    exportAreaEl.focus({preventScroll:true});
  });
  byId('backToArticleBtn').addEventListener('click',()=>showView('article'));
  byId('mobileBottomNav').addEventListener('click',event=>{
    const button = event.target.closest('.mobile-nav-btn');
    if (button) showView('article', {edit:button.dataset.target === 'home'});
  },true);
  document.addEventListener('texta:library', event => showView(event.detail));
  document.addEventListener('texta:article',()=>{
    sample = false;
    exampleNotice.classList.add('hidden');
    showView('article');
    if (isMobileLayout()) { currentMobilePage = 'article'; refreshMobileNav(); }
    exportAreaEl.scrollTop = 0;
    glossaryEl.scrollTop = 0;
    chooseDefinition(selectedWord || latestLexicon[0]?.key || keyifyWord(latestLexicon[0]?.word));
    enhanceArticle();
  });

  document.addEventListener('texta:open-article',()=>{
    showView('article');
    if (isMobileLayout()) { currentMobilePage = 'article'; refreshMobileNav(); }
    requestAnimationFrame(()=>{
      const bounds = articleViewEl.getBoundingClientRect();
      if (bounds.top < 0 || bounds.bottom > window.innerHeight) articleViewEl.scrollIntoView({behavior:reduceMotion()?'auto':'smooth',block:'start'});
    });
  });

  function chooseDefinition(key) {
    const cards = [...glossaryEl.querySelectorAll('.glossary-item')];
    if (!cards.length) return;
    const target = cards.find(card=>card.dataset.wordKey === key) || cards[0];
    if (selectedWord !== target.dataset.wordKey) glossaryEl.scrollTop = 0;
    selectedWord = target.dataset.wordKey;
    cards.forEach(card=>card.classList.toggle('active',card === target));
    loadVisibleContextTranslation(target);
    if (wordSelect.value !== selectedWord) wordSelect.value = selectedWord;
    byId('definitionCount').textContent = `${cards.indexOf(target) + 1} / ${cards.length}`;
    byId('previousWordBtn').disabled = cards.length < 2;
    byId('nextWordBtn').disabled = cards.length < 2;
    target.querySelectorAll('[data-mastery]').forEach(button=>button.setAttribute('aria-pressed',String(button.classList.contains('active'))));
  }
  function refreshDefinitions() {
    const cards = [...glossaryEl.querySelectorAll('.glossary-item')];
    wordSelect.replaceChildren(...cards.map(card=>{
      const option = document.createElement('option'); option.value = card.dataset.wordKey;
      option.textContent = card.querySelector('.glossary-word')?.textContent || card.dataset.wordKey;
      return option;
    }));
    chooseDefinition(selectedWord);
  }
  document.addEventListener('texta:glossary',refreshDefinitions);
  document.addEventListener('texta:word',event=>chooseDefinition(event.detail));
  wordSelect.addEventListener('change',()=>{ chooseDefinition(wordSelect.value); void ensureVocabDetailForKey(wordSelect.value); });
  for (const [id, direction] of [['previousWordBtn',-1],['nextWordBtn',1]]) byId(id).addEventListener('click',()=>{
    const keys = [...wordSelect.options].map(option=>option.value);
    if (!keys.length) return;
    const index = keys.indexOf(selectedWord), next = keys[(index + direction + keys.length) % keys.length];
    chooseDefinition(next); void ensureVocabDetailForKey(next);
  });
  function enhanceArticle() {
    articleBlocksEl.querySelectorAll('mark[data-word-key],mark[data-word-keys]').forEach(mark=>{
      mark.setAttribute('tabindex','0'); mark.setAttribute('role','button');
      mark.setAttribute('aria-label', `${translate('词汇解析')}: ${mark.textContent}`);
    });
  }
  articleBlocksEl.addEventListener('keydown',event=>{
    if (['Enter',' '].includes(event.key) && event.target.matches('mark[role="button"]')) { event.preventDefault(); event.target.click(); }
  });
  document.addEventListener('texta:language',enhanceArticle);
  const toolbar = articleViewEl.querySelector('.reading-toolbar');
  function syncReadingToolbar() {
    const collapsed = exportAreaEl.scrollTop > 24;
    articleViewEl.classList.toggle('toolbar-collapsed', collapsed);
    toolbar.inert = collapsed || readingMode;
    if (collapsed) toolbar.querySelectorAll('details[open]').forEach(detail=>detail.open=false);
  }
  exportAreaEl.addEventListener('scroll',syncReadingToolbar,{passive:true});
  document.addEventListener('texta:article',syncReadingToolbar);

  let focusDefinitionOrigin = null, readingHintTimer = 0;
  function closeFocusDefinition(restoreFocus = true) {
    document.body.classList.remove('focus-definition-open');
    glossaryPanelEl.removeAttribute('role');
    glossaryPanelEl.setAttribute('aria-hidden', String(readingMode));
    if (!readingMode) glossaryPanelEl.removeAttribute('aria-hidden');
    if (restoreFocus && focusDefinitionOrigin?.isConnected) focusDefinitionOrigin.focus({preventScroll:true});
  }
  function exitReadingMode() {
    readingMode = false;
    applyReadingMode();
    refreshMobileNav();
    exportAreaEl.focus({preventScroll:true});
  }
  articleBlocksEl.addEventListener('click',event=>{
    if (readingMode) focusDefinitionOrigin = event.target.closest('mark');
  },true);
  document.addEventListener('texta:focus-definition',event=>{
    if (!readingMode) return;
    clearTimeout(readingHintTimer);
    byId('readingModeHint').classList.add('hidden');
    chooseDefinition(event.detail);
    document.body.classList.add('focus-definition-open');
    glossaryPanelEl.setAttribute('role','dialog');
    glossaryPanelEl.setAttribute('aria-hidden','false');
    byId('closeFocusDefinitionBtn').focus({preventScroll:true});
  });
  byId('closeFocusDefinitionBtn').addEventListener('click',()=>closeFocusDefinition());
  byId('exitReadingModeBtn').addEventListener('click',exitReadingMode);
  document.addEventListener('pointerdown',event=>{
    if (readingMode && document.body.classList.contains('focus-definition-open') && !glossaryPanelEl.contains(event.target) && !event.target.closest('mark')) closeFocusDefinition(false);
  });
  document.addEventListener('texta:reading-mode',event=>{
    clearTimeout(readingHintTimer);
    closeFocusDefinition(false);
    const hint = byId('readingModeHint');
    hint.classList.toggle('hidden',!event.detail);
    document.body.style.overflow = event.detail || activeDialog ? 'hidden' : '';
    syncReadingToolbar();
    sizeReadingPanels();
    if (event.detail) {
      readingHintTimer = setTimeout(()=>hint.classList.add('hidden'),3600);
      exportAreaEl.focus({preventScroll:true});
    }
  });
  const libraryObserver = new MutationObserver(()=>{
    favoritesListEl.querySelectorAll('.fav-item').forEach(item=>{
      item.tabIndex = 0; item.setAttribute('role','button');
      item.setAttribute('aria-label',item.querySelector('.fav-main')?.textContent || 'Article');
    });
  });
  libraryObserver.observe(favoritesListEl,{childList:true});
  favoritesListEl.addEventListener('keydown',event=>{
    if (['Enter',' '].includes(event.key) && event.target.classList.contains('fav-item')) { event.preventDefault(); event.target.click(); }
  });

  function updateWordCount() {
    const count = splitWords(wordsInput.value).length;
    const label = byId('wordCount'); label.textContent = `${count} / 120 个词`;
    label.classList.toggle('is-invalid',count > 120);
    wordsInput.setAttribute('aria-invalid', String(count > 120));
    renderSpelling();
  }
  function saveDraft() {
    if (!draftKey) return;
    const draft = {words:wordsInput.value,level:levelSelect.value,mode:generationModeSelect.value,quality:generationQualitySelect.value,quick:quickModeInput.checked};
    try { localStorage.setItem(draftKey,JSON.stringify(draft)); } catch { /* The input stays available if storage is full. */ }
  }
  wordsInput.addEventListener('input',()=>{ updateWordCount(); clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft,300); });
  [levelSelect,generationModeSelect,generationQualitySelect,quickModeInput].forEach(control=>control.addEventListener('change',saveDraft));
  window.addEventListener('pagehide',saveDraft);
  document.addEventListener('texta:ready',()=>{
    draftKey = `texta_draft_${currentUser?.id || 'guest'}`;
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (draft) {
        wordsInput.value = String(draft.words || '');
        if (['初级','中级','高级'].includes(draft.level)) levelSelect.value = draft.level;
        if (['mixed','standard'].includes(draft.mode)) generationModeSelect.value = draft.mode;
        if (['normal','advanced'].includes(draft.quality)) generationQualitySelect.value = draft.quality;
        quickModeInput.checked = Boolean(draft.quick);
      }
    } catch { /* Ignore a malformed draft. */ }
    updateWordCount(); refreshDefinitions(); showView('article');
  });
  byId('clearWordsBtn').addEventListener('click',()=>{ updateWordCount(); saveDraft(); wordsInput.focus(); });
  byId('wordFileInput').addEventListener('change',()=>setTimeout(()=>{updateWordCount();saveDraft();},0));

  const en = [
    'A greener life is not about giving up comfort, but about making small, thoughtful choices that add up over time. When we choose to live more sustainable lives, we care for the environment and also create a healthier, happier life for ourselves and the people around us.',
    'Living sustainably can take many forms. We might reduce waste, choose local food, or use public transport. These actions may seem small, but they help build a more resilient community and a cleaner, safer planet. As we adapt to new habits, we also gain a fresh perspective on what really matters in life.',
    'A greener way of living helps us thrive — not just today, but in the years to come. When we find a better balance between our needs and the health of the planet, we can all look forward to a brighter, more hopeful future.'
  ];
  const zh = [
    '更绿色的生活并不是放弃舒适，而是通过一些微小而有意识的选择，在时间的积累中带来改变。当我们选择过更可持续的生活时，不仅是在关爱环境，也是在为自己和身边的人创造更健康、更幸福的生活。',
    '践行可持续的生活可以有很多形式。我们可以减少浪费、选择本地食物或使用公共交通。这些行动看似微小，却能帮助打造更具韧性的社区，以及更清洁、更安全的地球。在适应新习惯的过程中，我们也会对生活中真正重要的东西获得新的视角。',
    '更绿色的生活方式有助于我们蓬勃发展——不仅在当下，也在未来的岁月里。当我们能在自身需求与地球健康之间找到更好的平衡时，我们都可以期待一个更加光明、充满希望的未来。'
  ];
  const sampleLexicon = [
    {word:'sustainable',pos:'adj.',ipa:'/səˈsteɪnəbl/',summary:'可持续的；能够长期维持的',senses:[{meaning:'能够在较长时间内维持，而不造成资源浪费或严重损害的；在环境、经济或社会方面可持续发展的。',marker:'①'}],collocations:['sustainable development · 可持续发展','sustainable living · 可持续的生活','sustainable energy · 可持续能源','environmentally sustainable · 环境可持续的','a sustainable future · 可持续的未来'],synonyms:['maintainable','lasting'],antonyms:['unsustainable'],wordFormation:'sustain（维持）+ -able（能够）'},
    {word:'resilient',pos:'adj.',ipa:'/rɪˈzɪliənt/',senses:[{meaning:'有韧性的；能迅速恢复的',marker:'①'}],collocations:['a resilient community · 有韧性的社区'],synonyms:['adaptable','robust'],antonyms:['fragile'],wordFormation:'resilience（韧性）→ resilient'},
    {word:'adapt',pos:'v.',ipa:'/əˈdæpt/',senses:[{meaning:'适应；调整',marker:'①'}],collocations:['adapt to change · 适应变化'],synonyms:['adjust'],antonyms:['resist'],wordFormation:'ad-（朝向）+ apt（合适）'},
    {word:'perspective',pos:'n.',ipa:'/pərˈspektɪv/',senses:[{meaning:'视角；观点',marker:'①'}],collocations:['a fresh perspective · 新的视角'],synonyms:['viewpoint'],antonyms:[],wordFormation:'per-（穿过）+ spect（看）+ -ive'},
    {word:'thrive',pos:'v.',ipa:'/θraɪv/',senses:[{meaning:'茁壮成长；蓬勃发展',marker:'①'}],collocations:['thrive in a community · 在社区中蓬勃发展'],synonyms:['flourish'],antonyms:['decline'],wordFormation:'thrive → thriving'},
    {word:'balance',pos:'n.',ipa:'/ˈbæləns/',senses:[{meaning:'平衡',marker:'①'}],collocations:['find a balance · 找到平衡'],synonyms:['equilibrium'],antonyms:['imbalance'],wordFormation:'balance → balanced'}
  ];
  byId('previewExampleBtn').addEventListener('click',()=>{
    const previousMode = generationModeSelect.value, previousQuality = generationQualitySelect.value;
    if (!wordsInput.value.trim()) { wordsInput.value='resilient, adapt, perspective, sustainable, thrive, balance'; updateWordCount(); }
    selectedWord = 'sustainable';
    applyArticleData({title:'A greener way to live',article:en.join('\n\n'),paragraphsEn:en,paragraphsZh:zh,words:sampleLexicon.map(item=>item.word),lexicon:sampleLexicon.map(item=>({...item,usIpa:item.ipa,ukIpa:item.ipa})),baseLexicon:sampleLexicon.map(item=>({...item,usIpa:item.ipa,ukIpa:item.ipa})),generationMode:'standard',missing:[]});
    generationModeSelect.value = previousMode;
    generationQualitySelect.value = previousQuality;
    sample = true; exampleNotice.classList.remove('hidden');
    statusEl.textContent = '';
    chooseDefinition('sustainable');
  });
  document.addEventListener('texta:generation',event=>{
    byId('generationProgress').classList.toggle('hidden',!event.detail);
    if (event.detail) showView('article', {edit:true});
    else updateWordCount();
  });
  function syncStatusVisibility() {
    const error = /失败|超过|过期|不支持|请先|重试|expired|failed|too many|exceed|not support|please.*first|retry/i.test(statusEl.textContent);
    statusEl.classList.toggle('is-error',error);
    statusEl.parentElement.classList.toggle('quiet-status',!error && byId('generationProgress').classList.contains('hidden'));
  }
  const statusObserver = new MutationObserver(syncStatusVisibility);
  statusObserver.observe(statusEl,{childList:true,characterData:true,subtree:true});
  document.addEventListener('texta:generation',syncStatusVisibility);
  syncStatusVisibility();
  document.addEventListener('keydown',event=>{
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && view === 'article' && !activeDialog && !generateBtn.disabled) { event.preventDefault(); generateBtn.click(); }
    if (event.key === 'Escape') document.querySelectorAll('details[open]').forEach(detail=>detail.open=false);
    if (event.key === 'Escape' && readingMode && !activeDialog) { event.preventDefault(); exitReadingMode(); }
    if (event.key === 'Tab' && activeDialog) {
      const items = [...activeDialog.querySelectorAll('button,input,select,a[href],[tabindex="0"]')].filter(el=>!el.disabled && el.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  [guideModalEl,exportModalEl].forEach(modal=>{
    const heading = modal.querySelector('h3'); heading.id = `${modal.id}Title`; modal.setAttribute('aria-labelledby',heading.id);
    new MutationObserver(()=>{
      if (!modal.classList.contains('hidden') && activeDialog !== modal) {
        dialogReturnFocus = document.activeElement; activeDialog = modal; document.body.style.overflow = 'hidden';
        modal.querySelector('button,input')?.focus();
      } else if (modal.classList.contains('hidden') && activeDialog === modal) {
        activeDialog = null; document.body.style.overflow = readingMode ? 'hidden' : ''; dialogReturnFocus?.focus();
      }
    }).observe(modal,{attributes:true,attributeFilter:['class']});
  });
  document.addEventListener('click',event=>{
    document.querySelectorAll('details[open]').forEach(detail=>{if(!detail.contains(event.target))detail.open=false;});
  });
  let pdfPromise;
  function loadPdfScript(src) {
    return new Promise((resolve,reject)=>{
      const script = document.createElement('script'); script.src=src;
      script.onload=resolve; script.onerror=()=>{script.remove();reject(new Error('PDF library could not load'));}; document.head.appendChild(script);
    });
  }
  window.TextaExports = {ensurePdf:()=>{
    if (typeof window.html2canvas === 'function' && window.jspdf?.jsPDF) return Promise.resolve();
    if (!pdfPromise) pdfPromise = Promise.all([
      typeof window.html2canvas === 'function' ? undefined : loadPdfScript('./vendor/html2canvas-1.4.1.min.js'),
      window.jspdf?.jsPDF ? undefined : loadPdfScript('./vendor/jspdf-4.2.1.umd.min.js')
    ]).catch(error=>{pdfPromise=null;throw error;});
    return pdfPromise;
  }};
  document.addEventListener('texta:imported',()=>{updateWordCount();saveDraft();});
  updateWordCount(); showView('article');
})();
