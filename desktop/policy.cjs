const HOME_URL = 'https://texta.yanyihan.top/';
const HOME_ORIGIN = new URL(HOME_URL).origin;

function isInternal(value) {
  try { return new URL(value).origin === HOME_ORIGIN; } catch { return false; }
}

function isExternal(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

module.exports = { HOME_URL, isInternal, isExternal };
