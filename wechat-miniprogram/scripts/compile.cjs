const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const compiler = process.env.WECHAT_COMPILER_ROOT || 'D:\\微信web开发者工具\\code\\package.nw\\node_modules\\wcc-exec';
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]); }
const files = walk(path.join(root, 'miniprogram'));
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
for (const [command, extension] of [['wcc', 'wxml'], ['wcsc', 'wxss']]) {
  const args = ['-o', path.join(root, 'artifacts', 'compiled-' + extension + '.js'), ...files.filter(file => file.endsWith('.' + extension))];
  const result = spawnSync(path.join(compiler, command + '.exe'), args, { encoding: 'utf8', cwd: root });
  // These native compilers sometimes report errors with exit code zero.
  if (result.error || result.status !== 0 || /Bad attr|error|unexpected|illegal|not found/i.test(result.stdout + result.stderr)) {
    console.error(result.error || result.stdout + result.stderr); process.exit(1);
  }
  console.log(extension.toUpperCase() + ': ' + args.slice(2).length + ' files compiled with the installed WeChat compiler.');
}
