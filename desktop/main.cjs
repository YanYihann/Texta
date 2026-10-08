const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('node:path');
const { HOME_URL, isInternal, isExternal } = require('./policy.cjs');

const webPreferences = {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true,
  webviewTag: false,
  partition: 'persist:texta',
};

function openExternal(url) {
  if (isExternal(url)) void shell.openExternal(url).catch(() => {});
}

function protectWindow(win, blankCheckout = false) {
  const contents = win.webContents;
  const navigate = (event, url) => {
    if (isInternal(url) || (blankCheckout && url === 'about:blank')) return;
    event.preventDefault();
    openExternal(url);
    if (blankCheckout) setImmediate(() => { if (!win.isDestroyed()) win.close(); });
  };
  contents.on('will-navigate', navigate);
  contents.on('will-redirect', navigate);
  contents.on('will-attach-webview', event => event.preventDefault());
  contents.setWindowOpenHandler(({ url }) => {
    // Checkout first opens about:blank, then assigns the provider URL asynchronously.
    // Preserve its WindowProxy; intercept the later navigation in the child window.
    if (isInternal(contents.getURL()) && (isInternal(url) || url === 'about:blank')) {
      return { action: 'allow', overrideBrowserWindowOptions: {
        width: 1000, height: 780, autoHideMenuBar: true,
        show: url !== 'about:blank', webPreferences,
      } };
    }
    openExternal(url);
    return { action: 'deny' };
  });
  contents.on('did-create-window', (child, { url }) => {
    protectWindow(child, url === 'about:blank');
    if (url === 'about:blank') {
      child.webContents.on('did-finish-load', () => {
        if (isInternal(child.webContents.getURL())) child.show();
      });
    }
    win.once('closed', () => { if (!child.isDestroyed()) child.close(); });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    title: 'Texta', width: 1360, height: 900, minWidth: 900, minHeight: 640,
    backgroundColor: '#f8fafc', show: false,
    icon: path.join(__dirname, 'assets/icon.png'), webPreferences,
  });
  protectWindow(win);
  const loadHome = () => win.loadURL(HOME_URL).catch(() => {});
  win.webContents.on('did-fail-load', (_event, code, _description, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && isInternal(url)) {
      void win.loadFile(path.join(__dirname, 'offline.html')).catch(() => {});
    }
  });
  win.webContents.on('page-title-updated', event => { event.preventDefault(); win.setTitle('Texta'); });
  win.once('ready-to-show', () => win.show());
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Texta', submenu: [
      { label: '返回首页', click: loadHome },
      { label: '在浏览器打开', click: () => openExternal(HOME_URL) },
      { type: 'separator' }, { role: 'quit', label: '退出' },
    ] },
    { label: '编辑', submenu: [
      { role: 'undo', label: '撤销' }, { role: 'redo', label: '重做' },
      { type: 'separator' }, { role: 'cut', label: '剪切' },
      { role: 'copy', label: '复制' }, { role: 'paste', label: '粘贴' },
      { role: 'selectAll', label: '全选' },
    ] },
    { label: '视图', submenu: [
      { label: '重新加载', accelerator: 'CmdOrCtrl+R', click: () => {
        if (isInternal(win.webContents.getURL())) win.webContents.reload(); else loadHome();
      } },
      { role: 'resetZoom', label: '实际大小' }, { role: 'zoomIn', label: '放大' },
      { role: 'zoomOut', label: '缩小' }, { role: 'togglefullscreen', label: '全屏' },
    ] },
  ]));
  // Paint a local screen first so slow network requests cannot hide the app window.
  void win.loadFile(path.join(__dirname, 'loading.html')).then(loadHome).catch(loadHome);
  return win;
}

function configureSession() {
  const clientSession = session.fromPartition(webPreferences.partition);
  clientSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  clientSession.setPermissionCheckHandler(() => false);
  return clientSession;
}

if (require.main === module) {
  if (!app.requestSingleInstanceLock()) app.quit();
  else {
    let mainWindow;
    app.on('second-instance', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show(); mainWindow.focus();
    });
    app.whenReady().then(() => {
      app.setAppUserModelId('top.yanyihan.texta');
      configureSession(); mainWindow = createWindow();
    });
    app.on('window-all-closed', () => app.quit());
  }
}

module.exports = { createWindow, configureSession, protectWindow };
