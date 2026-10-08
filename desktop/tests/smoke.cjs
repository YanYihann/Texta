const { app, BrowserWindow, shell } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { once } = require('node:events');
const output = path.resolve(__dirname, '../../output/desktop-smoke');
app.setPath('userData', path.join(output, 'profile'));
const external = [];
shell.openExternal = async url => { external.push(url); };
const { createWindow, configureSession } = require('../main.cjs');
const { HOME_URL } = require('../policy.cjs');

async function until(check, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out: ${label}`);
}

app.whenReady().then(async () => {
  await fs.mkdir(output, { recursive: true });
  const clientSession = configureSession();
  let offline = false;
  await clientSession.protocol.handle('https', () => offline ? Response.error() : new Response('<!doctype html><html><title>Smoke</title><body><h1>Texta desktop test</h1></body></html>', { headers: { 'Content-Type': 'text/html' } }));
  const win = createWindow();
  await until(() => !win.webContents.isLoading() && win.webContents.getURL() === HOME_URL, 'initial page');
  const prefs = win.webContents.getLastWebPreferences();
  assert.equal(prefs.nodeIntegration, false);
  assert.equal(prefs.contextIsolation, true);
  assert.equal(prefs.sandbox, true);
  assert.equal(await win.webContents.executeJavaScript('typeof require'), 'undefined');
  console.log('PASS: renderer isolation and sandbox');

  await win.webContents.executeJavaScript("localStorage.setItem('desktop-smoke', 'persisted')");
  const reload = once(win.webContents, 'did-finish-load');
  win.webContents.reload(); await reload;
  assert.equal(await win.webContents.executeJavaScript("localStorage.getItem('desktop-smoke')"), 'persisted');
  await win.webContents.executeJavaScript("localStorage.removeItem('desktop-smoke')");
  console.log('PASS: persistent storage after reload');

  await win.webContents.executeJavaScript("window.open('https://example.com/checkout')");
  await until(() => external.length === 1, 'external browser');
  assert.equal(external.pop(), 'https://example.com/checkout');
  await win.webContents.executeJavaScript("window.open('file:///C:/Windows/'); window.open('powershell:test')");
  assert.equal(external.length, 0);

  await win.webContents.executeJavaScript("window.checkout = window.open('about:blank', 'texta_checkout'); window.checkout.opener = null;");
  await until(() => BrowserWindow.getAllWindows().length === 2, 'blank checkout');
  await win.webContents.executeJavaScript("window.checkout.location.href = 'https://example.com/payment'");
  await until(() => external.length === 1 && BrowserWindow.getAllWindows().length === 1, 'asynchronous checkout navigation');
  assert.equal(external.pop(), 'https://example.com/payment');
  console.log('PASS: external links, blocked OS protocols, asynchronous checkout');

  const downloaded = new Promise((resolve, reject) => {
    clientSession.once('will-download', (_event, item) => {
      item.setSavePath(path.join(output, 'export.doc'));
      item.once('done', (_event, state) => state === 'completed' ? resolve() : reject(new Error(state)));
    });
  });
  await win.webContents.executeJavaScript("(() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['desktop-export'], {type: 'application/msword'})); a.download = 'export.doc'; a.click(); })()");
  await Promise.race([downloaded, new Promise((_, reject) => setTimeout(() => reject(new Error('download timed out')), 15000))]);
  assert.equal(await fs.readFile(path.join(output, 'export.doc'), 'utf8'), 'desktop-export');
  console.log('PASS: Blob document download');

  offline = true;
  await win.loadURL(HOME_URL).catch(() => {});
  await until(() => win.webContents.getURL().endsWith('offline.html') && !win.webContents.isLoading(), 'offline fallback');
  assert.match(await win.webContents.executeJavaScript('document.body.innerText'), /暂时无法连接/);
  offline = false;
  await win.webContents.executeJavaScript("document.querySelector('a').click()");
  await until(() => win.webContents.getURL() === HOME_URL && !win.webContents.isLoading(), 'offline retry');
  console.log('PASS: offline fallback and retry');

  await clientSession.protocol.unhandle('https');
  await win.loadURL(HOME_URL);
  const content = await win.webContents.executeJavaScript('document.body.innerText');
  assert.match(content, /Texta/i);
  assert.equal(win.webContents.getURL(), HOME_URL);
  await fs.writeFile(path.join(output, 'live-desktop.png'), (await win.webContents.capturePage()).toPNG());
  console.log('PASS: live production site renders in desktop; screenshot saved');
  win.destroy(); app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });

setTimeout(() => { console.error('Smoke test exceeded 90 seconds'); app.exit(1); }, 90000).unref();
