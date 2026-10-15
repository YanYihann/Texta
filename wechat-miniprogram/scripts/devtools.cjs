const { execFileSync } = require('child_process');
const path = require('path');
const cli = process.env.WECHAT_DEVTOOLS_CLI || 'D:\\微信web开发者工具\\cli.bat';
execFileSync('powershell.exe', ['-NoProfile', '-Command', "& '" + cli.replace(/'/g, "''") + "' open --project '" + path.resolve(__dirname, '..').replace(/'/g, "''") + "' --lang zh"], { stdio: 'inherit' });
