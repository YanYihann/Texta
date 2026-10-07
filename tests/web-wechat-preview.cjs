// Local-only API fixtures for visual/interaction checks. Never proxies real accounts.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../public');
const modes = new Set(['bound', 'unbound', 'offline', 'paused', 'expired']);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost'), parts = url.pathname.split('/').filter(Boolean);
  const mode = parts.shift(); if (!modes.has(mode)) { res.writeHead(404); res.end(); return; }
  const relative = parts.join('/');
  res.setHeader('Cache-Control', 'no-store');
  if (relative.startsWith('api/')) {
    let data = {}, status = 200;
    const user = { id: 'web-preview-fixture', email: 'preview@example.invalid', name: '界面测试账号', role: 'user', plan: 'free' };
    if (relative === 'api/auth/me') data = { ok: true, user };
    else if (relative === 'api/usage') data = { user, plan: 'free', usage: { remaining: 10, used: 0, limit: 10 } };
    else if (relative === 'api/library') data = { libraryVersion: 3, favorites: [], notebookEntries: [], libraryFolders: [], vocabPrefs: {} };
    else if (relative === 'api/auth/wechat/connection') {
      status = mode === 'offline' ? 503 : mode === 'expired' ? 401 : 200;
      data = status === 200 ? { ok: true, bound: mode === 'bound' || mode === 'paused', loginAvailable: mode !== 'paused' } : { error: 'Fixture unavailable' };
    } else if (relative === 'api/health') data = { ok: true, libraryVersion: 3 };
    else status = 404;
    res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); return;
  }
  const file = path.resolve(root, relative || 'app.html');
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  let body = fs.readFileSync(file);
  // apiUrl appends /api/...; use a local prefix without changing production sources.
  if (relative === 'site-config.js') body = Buffer.from('window.TEXTA_API_BASE = "/' + mode + '";');
  if (relative === 'app.html') body = Buffer.from(body.toString().replace('<body class="workspace-page">', '<body class="workspace-page"><script>localStorage.setItem("texta_auth_token","preview-fixture-token");</script>'));
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(body);
}).listen(4188, '127.0.0.1', () => console.log('Local WeChat state fixtures: http://127.0.0.1:4188/bound/app.html'));
