(() => {
  const draft = document.getElementById('wordDraft');
  const expand = document.getElementById('expandWordsBtn');
  const more = document.querySelector('.generation-more');
  const modeButtons = [...document.querySelectorAll('[data-generation-mode]')];
  let committed = [], serialized = null, signature = '';
  const text = value => window.TextaI18n?.text(value) || value;

  function measure() {
    expand.classList.toggle('hidden', !wordChipsEl.classList.contains('is-expanded') && wordChipsEl.scrollHeight <= wordChipsEl.clientHeight + 2);
    draft.style.height = 'auto';
    draft.style.height = `${Math.min(140, draft.scrollHeight)}px`;
  }
  function render(words, spelling) {
    // Existing imports, drafts and saved articles still use the canonical #words field.
    if (wordsInput.value !== serialized) {
      committed = words;
      draft.value = '';
      serialized = wordsInput.value;
    }
    const nextSignature = JSON.stringify([committed, [...spelling], document.documentElement.lang]);
    if (signature !== nextSignature) {
      signature = nextSignature;
      const active = document.activeElement;
      const hadChipFocus = wordChipsEl.contains(active);
      const focusIndex = active?.dataset.index, focusAction = active?.dataset.action;
      wordChipsEl.replaceChildren(...committed.map((word, index) => {
        const info = spelling.get(word.toLowerCase());
        const chip = document.createElement('span');
        chip.className = info?.ok === false ? 'chip bad' : 'chip';
        const edit = document.createElement('button');
        edit.type = 'button'; edit.className = 'chip-edit'; edit.dataset.index = index; edit.dataset.action = 'edit';
        edit.textContent = word; edit.setAttribute('aria-label', `${text('编辑词汇')} ${word}`);
        if (info?.ok === false && info.suggestion) edit.title = `${text('建议拼写')} ${info.suggestion}`;
        const remove = document.createElement('button');
        remove.type = 'button'; remove.className = 'chip-remove'; remove.dataset.index = index; remove.dataset.action = 'remove';
        remove.setAttribute('aria-label', `${text('删除词汇')} ${word}`);
        remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>';
        chip.append(edit, remove); return chip;
      }));
      if (focusIndex !== undefined && hadChipFocus) {
        wordChipsEl.querySelector(`[data-index="${focusIndex}"][data-action="${focusAction}"]`)?.focus();
      }
    }
    draft.placeholder = text(committed.length ? '继续输入单词或短语…' : '粘贴或输入你想学习的单词与短语…');
    draft.setAttribute('aria-invalid', String(words.length > 120));
    requestAnimationFrame(measure);
  }
  function publish() {
    serialized = [...committed, draft.value].filter(Boolean).join(', ');
    wordsInput.value = serialized;
    wordsInput.dispatchEvent(new Event('input', {bubbles: true}));
  }
  function commit() {
    committed = splitWords([...committed, draft.value].join(', '));
    draft.value = '';
    publish();
  }
  draft.addEventListener('input', event => {
    if (!event.isComposing && /[,，\n]/.test(draft.value)) commit(); else publish();
    measure();
  });
  draft.addEventListener('compositionend', () => {
    if (/[,，\n]/.test(draft.value)) commit(); else publish();
  });
  draft.addEventListener('keydown', event => {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter') { event.preventDefault(); commit(); if (event.ctrlKey || event.metaKey) generateBtn.click(); }
    if (event.key === 'Backspace' && !draft.value && committed.length) {
      event.preventDefault(); draft.value = committed.pop(); publish();
    }
  });
  draft.addEventListener('paste', event => {
    const pasted = event.clipboardData?.getData('text');
    if (!pasted || !/[,，\n]/.test(pasted)) return;
    event.preventDefault();
    draft.setRangeText(pasted, draft.selectionStart, draft.selectionEnd, 'end');
    commit();
  });
  wordChipsEl.addEventListener('click', event => {
    const button = event.target.closest('button[data-index]');
    if (!button) return;
    if (draft.value.trim()) commit();
    const index = Number(button.dataset.index), word = committed[index];
    committed.splice(index, 1);
    if (button.dataset.action === 'edit') { draft.value = word; publish(); draft.focus(); draft.select(); }
    else {
      publish();
      const next = wordChipsEl.querySelector(`[data-index="${Math.min(index, committed.length - 1)}"][data-action="remove"]`);
      (next || draft).focus();
    }
  });
  expand.addEventListener('click', () => {
    const expanded = wordChipsEl.classList.toggle('is-expanded');
    expand.setAttribute('aria-expanded', String(expanded));
    expand.textContent = text(expanded ? '收起词汇' : '展开全部词汇');
    measure();
  });
  function settings() {
    modeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.generationMode === generationModeSelect.value)));
    const quality = generationQualitySelect.value === 'advanced' ? '高级生成 · 5 次' : '普通生成 · 1 次';
    document.getElementById('generationSummary').textContent = text(quality) + (quickModeInput.checked ? ` · ${text('短文章')}` : '');
  }
  modeButtons.forEach(button => button.addEventListener('click', () => {
    generationModeSelect.value = button.dataset.generationMode;
    generationModeSelect.dispatchEvent(new Event('change', {bubbles: true}));
  }));
  [generationModeSelect, generationQualitySelect, quickModeInput].forEach(control => control.addEventListener('change', settings));
  document.addEventListener('click', event => { if (!more.contains(event.target)) more.open = false; });
  more.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); more.open = false; more.querySelector('summary').focus(); } });
  for (const name of ['texta:ready', 'texta:article', 'texta:open-article']) {
    document.addEventListener(name, () => queueMicrotask(() => { renderSpelling(); settings(); }));
  }
  document.addEventListener('texta:language', () => { renderSpelling(); settings(); });
  generateBtn.addEventListener('click', commit, true);
  clearWordsBtn.addEventListener('click', () => {
    committed = []; draft.value = ''; wordChipsEl.classList.remove('is-expanded');
    expand.setAttribute('aria-expanded', 'false'); expand.textContent = text('展开全部词汇'); publish(); draft.focus();
  });
  new ResizeObserver(measure).observe(wordChipsEl);
  window.TextaVocabulary = {render, commit};
  renderSpelling(); settings();
})();
