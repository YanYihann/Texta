const fs = require('fs');
const path = require('path');

const root = process.cwd();
const files = [
  'public/index.html',
  'public/app.html',
  'public/pay.html',
  'public/admin.html',
];

const argVersion = process.argv[2];
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const autoVersion = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}.${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const version = argVersion && argVersion.trim() ? argVersion.trim() : autoVersion;

const targets = ['site-config.js', 'auth.js', 'app.js', 'pay.js', 'admin.js'];

for (const rel of files) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) continue;

  let content = fs.readFileSync(full, 'utf8');

  for (const t of targets) {
    const re = new RegExp(`(${t.replace('.', '\\.')})(\\?v=[^"']+)?`, 'g');
    content = content.replace(re, `$1?v=${version}`);
  }

  fs.writeFileSync(full, content, 'utf8');
  console.log(`Updated: ${rel}`);
}

console.log(`Done. Version=${version}`);
