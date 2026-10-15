const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..', 'miniprogram');
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]); }
const files = walk(root);
for (const file of files) {
  if (file.endsWith('.js')) execFileSync(process.execPath, ['--check', file]);
  if (file.endsWith('.json')) JSON.parse(fs.readFileSync(file, 'utf8'));
}
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json')));
app.pages.forEach(page => ['.js', '.json', '.wxml', '.wxss'].forEach(extension => {
  if (!fs.existsSync(path.join(root, page + extension))) throw Error('Missing ' + page + extension);
}));
app.tabBar.list.forEach(tab => [tab.iconPath, tab.selectedIconPath].forEach(icon => {
  if (!fs.existsSync(path.join(root, icon))) throw Error('Missing tab icon: ' + icon);
}));
for (const file of files.filter(file => file.endsWith('.wxml'))) {
  const content = fs.readFileSync(file, 'utf8');
  const js = fs.readFileSync(file.replace('.wxml', '.js'), 'utf8');
  for (const match of content.matchAll(/(?:bind|catch)(?::)?(?:tap|input|change|confirm|close|source|touchmove)="([A-Za-z]\w*)"/g)) {
    if (!new RegExp('\\b' + match[1] + '\\s*\\(').test(js)) throw Error(file + ': missing event handler ' + match[1]);
  }
}
const config = JSON.parse(fs.readFileSync(path.join(root, '..', 'project.config.json'), 'utf8'));
if (config.appid !== 'wxc1af567af0505b1e') throw Error('Original AppID changed');
console.log('JS, JSON, pages, event handlers, icons and original AppID checked (' + files.length + ' files).');
