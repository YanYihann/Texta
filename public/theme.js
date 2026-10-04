// Apply the saved palette before paint on every page, including account/admin pages.
(() => {
  const key = 'texta_theme_preference';
  const themes = new Set(['light', 'dark', 'highlighter', 'paper', 'ocean', 'lavender']);
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  function applySavedTheme() {
    let preference = 'light';
    try { preference = localStorage.getItem(key) || 'light'; } catch { /* Default when storage is unavailable. */ }
    const theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = themes.has(theme) ? theme : 'light';
  }
  applySavedTheme();
  // The workspace owns its live selector and system-mode state.
  system.addEventListener('change', () => {
    if (!document.body?.classList.contains('workspace-page')) applySavedTheme();
  });
})();
