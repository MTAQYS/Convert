/* Keep the storage keys in sync with src/app/shell.ts (convert.theme) and src/i18n/index.ts (convert.lang). */
/* Theme colors match --dg-bg in src/style.css (light #F5F3EE, dark #0E0F11). */
(function () {
  var LIGHT = '#F5F3EE';
  var DARK = '#0E0F11';

  function themeColor(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', theme === 'light' ? LIGHT : DARK);
  }

  try {
    var theme = localStorage.getItem('convert.theme');
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
      themeColor(theme);
    }
    var lang = localStorage.getItem('convert.lang');
    if (lang === 'fr' || lang === 'en') {
      document.documentElement.lang = lang;
    }
  } catch (error) {
    /* Storage can throw in private mode. */
    void error;
  }
})();
