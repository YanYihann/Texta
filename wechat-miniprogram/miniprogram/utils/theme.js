const palettes = [
  { id: 'light', name: '浅色', swatch: '#386548', bg: '#f6f7f4', panel: '#fcfcfa', field: '#fcfdfb', text: '#222724', muted: '#606963', line: '#d8ded7', primary: '#386548', press: '#294e37', soft: '#e8f0e7', ink: '#ffffff', highlight: '#dae8d4', highlightZh: '#e3ebdc', vocab: '#294e37', warning: '#9b3f29', warningBg: '#f8eee9' },
  { id: 'dark', name: '深色', swatch: '#28312a', bg: '#1c221e', panel: '#232c25', field: '#28312a', text: '#e9eee7', muted: '#b0bbae', line: '#3e4c3f', primary: '#a9cda2', press: '#c0dcb8', soft: '#314334', ink: '#1c281e', highlight: '#d9ef78', highlightZh: '#e8f7a6', vocab: '#202b15', warning: '#ffb5a3', warningBg: '#452c27' },
  { id: 'highlighter', name: '荧光', swatch: '#fff200', bg: '#ffffff', panel: '#ffffff', field: '#ffffff', text: '#202020', muted: '#626262', line: '#dedede', primary: '#202020', press: '#000000', soft: '#f5f5f5', ink: '#ffffff', highlight: '#fff200', highlightZh: '#fff200', vocab: '#202020', warning: '#b4232c', warningBg: '#fff0f0' },
  { id: 'paper', name: '纸张', swatch: '#f4d79f', bg: '#fdfbf6', panel: '#fffdf9', field: '#fffdf9', text: '#352b21', muted: '#75624c', line: '#e9e2d6', primary: '#78522e', press: '#5e3d20', soft: '#f7f1e6', ink: '#ffffff', highlight: '#f4d79f', highlightZh: '#f1e0bc', vocab: '#5e3d20', warning: '#935022', warningBg: '#fbf0df' },
  { id: 'ocean', name: '海洋', swatch: '#c8e8fa', bg: '#f2f7fa', panel: '#fbfdff', field: '#fbfdff', text: '#1f3340', muted: '#526e7e', line: '#ccdde7', primary: '#235f83', press: '#194969', soft: '#e0eef5', ink: '#ffffff', highlight: '#c8e8fa', highlightZh: '#d6edf7', vocab: '#194969', warning: '#9b3f29', warningBg: '#f8eee9' },
  { id: 'lavender', name: '薰衣草', swatch: '#e0cef3', bg: '#f7f4fa', panel: '#fdfbff', field: '#fdfbff', text: '#33283f', muted: '#71617e', line: '#ded4e7', primary: '#70508d', press: '#56366f', soft: '#ede4f4', ink: '#ffffff', highlight: '#e0cef3', highlightZh: '#eadef5', vocab: '#56366f', warning: '#95304e', warningBg: '#faeaf0' }
];
function current() { return palettes.find(p => p.id === wx.getStorageSync('texta_theme_preference')) || palettes[0]; }
function data(palette = current()) {
  return { themeId: palette.id, themeName: palette.name, themeColor: palette.primary, themeMuted: palette.muted,
    themeStyle: Object.keys(palette).filter(key => !['id', 'name', 'swatch'].includes(key)).map(key => '--' + key + ':' + palette[key]).join(';') };
}
function chrome(palette) {
  const dark = palette.id === 'dark';
  if (wx.setNavigationBarColor) wx.setNavigationBarColor({ frontColor: dark ? '#ffffff' : '#000000', backgroundColor: palette.bg });
  if (wx.setBackgroundColor) wx.setBackgroundColor({ backgroundColor: palette.bg, backgroundColorTop: palette.bg, backgroundColorBottom: palette.bg });
  if (wx.setTabBarStyle) wx.setTabBarStyle({ color: palette.muted, selectedColor: palette.primary, backgroundColor: palette.panel, borderStyle: dark ? 'black' : 'white', fail() {} });
}
function set(id) {
  const palette = palettes.find(p => p.id === id) || palettes[0];
  wx.setStorageSync('texta_theme_preference', palette.id);
  getCurrentPages().forEach(page => { if (page.applyTheme) page.applyTheme(); });
  chrome(palette);
}
function themedPage(definition) {
  const show = definition.onShow;
  definition.data = Object.assign({}, data(palettes[0]), definition.data);
  definition.applyTheme = function() { this.setData(data()); };
  definition.onShow = function(...args) { this.applyTheme(); chrome(current()); if (show) return show.apply(this, args); };
  Page(definition);
}
module.exports = { palettes, current, data, set, themedPage };
