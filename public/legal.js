(() => {
  const button = document.getElementById('legalLanguageBtn');
  const render = language => {
    document.documentElement.dataset.legalLanguage = language;
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    button.textContent = language === 'en' ? '中文' : 'English';
    button.setAttribute('aria-label', language === 'en' ? '切换为中文' : 'Read in English');
    try { localStorage.setItem('texta_language', language); } catch { /* Reading works without storage. */ }
    document.querySelectorAll('a[href]').forEach(link => {
      const url = new URL(link.getAttribute('href'), location.href);
      if (url.origin === location.origin && /\/(terms|privacy|refund)\.html$/.test(url.pathname)) {
        url.searchParams.set('lang', language);
        link.setAttribute('href', url.pathname + url.search + url.hash);
      }
    });
  };
  const requested = new URLSearchParams(location.search).get('lang');
  let saved = 'zh';
  try { saved = localStorage.getItem('texta_language') === 'en' ? 'en' : 'zh'; } catch { /* Optional preference. */ }
  const language = requested === 'en' || requested === 'zh' ? requested : saved;
  render(language);
  button.addEventListener('click', () => {
    const next = document.documentElement.dataset.legalLanguage === 'en' ? 'zh' : 'en';
    const url = new URL(location.href);
    url.searchParams.set('lang', next);
    history.replaceState(null, '', url);
    render(next);
  });
})();
