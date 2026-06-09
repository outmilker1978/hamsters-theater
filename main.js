const { app, BrowserWindow, session, ipcMain, Menu, clipboard, globalShortcut, desktopCapturer } = require('electron');
const http = require('http');
const os = require('os');
const { Server } = require('socket.io');
const natUpnp = require('nat-upnp');
const { exec, spawn } = require('child_process');

process.title = 'TV Hamsters';
const APP_VERSION = require('./package.json').version;
const CLOUD_SERVER_URL = 'https://tv-hamsters-bot.onrender.com';
let signalingServer = null;
let upnpMapping = null;
let pendingScreenSourceId = null;
let upnpStatus = 'проверка...';

function addUPnPMapping(port) {
  setTimeout(() => {
    if (upnpStatus === 'проверка...') upnpStatus = '❌ UPnP: недоступен';
  }, 8000);
  const client = natUpnp.createClient();
  client.portMapping({
    public: port,
    private: port,
    ttl: 0,
    protocol: 'TCP',
    description: 'TV Hamsters'
  }, (err) => {
    if (err) { upnpStatus = '❌ UPnP: ' + err.message; console.log('UPnP port mapping failed:', err.message); }
    else { upnpStatus = '✅ Порт ' + port + ' открыт (UPnP)'; console.log('UPnP: port', port, 'opened on router'); upnpMapping = { client, port }; }
  });
}

function removeUPnPMapping() {
  if (upnpMapping) {
    upnpMapping.client.portUnmapping({ public: upnpMapping.port, protocol: 'TCP' }, () => {});
    upnpMapping = null;
  }
}

function registerProtocol() {
  // Portable mode: process.execPath may point to temp extraction.
  // electron-builder sets PORTABLE_EXECUTABLE_FILE to the original exe path.
  const exePath = process.env.PORTABLE_EXECUTABLE_FILE || process.argv[0] || process.execPath;
  console.log('[Protocol] exePath:', exePath);
  console.log('[Protocol] execPath:', process.execPath);
  const key = 'HKCU\\Software\\Classes\\hamsters';
  spawn('reg', ['add', key, '/ve', '/d', 'URL:TV Hamsters', '/f']);
  spawn('reg', ['add', key, '/v', 'URL Protocol', '/d', '', '/f']);
  spawn('reg', ['add', key + '\\shell\\open\\command', '/ve', '/d', '"' + exePath + '" "%1"', '/f']);
}

function startSignalingServer() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('TV Hamsters Signaling Server\n');
  });
  const io = new Server(server, { cors: { origin: '*' } });
  const rooms = {};
  io.on('connection', (socket) => {
    socket.on('create-room', () => {
      const roomId = String(Math.floor(1000 + Math.random() * 9000));
      console.log('[Server] create-room: roomId=' + roomId + ' socket=' + socket.id);
      rooms[roomId] = [socket.id];
      socket.join(roomId);
      socket.emit('room-created', roomId);
    });
    socket.on('join-room', (roomId) => {
      console.log('[Server] join-room: roomId=' + roomId + ' rooms=' + JSON.stringify(Object.keys(rooms)));
      socket.emit('server-log', '[Server] join-room: roomId=' + roomId + ' rooms=' + JSON.stringify(Object.keys(rooms)));
      if (!rooms[roomId]) { socket.emit('error-msg', 'Комната не найдена'); return; }
      if (rooms[roomId].length >= 5) { socket.emit('error-msg', 'Комната уже заполнена'); return; }
      rooms[roomId].push(socket.id);
      socket.join(roomId);
      socket.emit('joined', roomId);
      const others = rooms[roomId].filter(id => id !== socket.id);
      socket.emit('room-users', others);
      socket.to(roomId).emit('user-joined', socket.id);
      socket.to(roomId).emit('peer-joined', socket.id);
    });
    socket.on('offer', (data) => {
      socket.to(data.to).emit('offer', { from: socket.id, sdp: data.sdp, type: data.type });
    });
    socket.on('answer', (data) => {
      socket.to(data.to).emit('answer', { from: socket.id, sdp: data.sdp, type: data.type });
    });
    socket.on('ice-candidate', (data) => {
      socket.to(data.to).emit('ice-candidate', { from: socket.id, candidate: data.candidate, type: data.type });
    });
    socket.on('signal', (data) => {
      socket.to(data.to).emit('signal', { from: socket.id, type: data.signalType });
    });
    socket.on('disconnect', () => {
      for (const roomId in rooms) {
        const idx = rooms[roomId].indexOf(socket.id);
        if (idx !== -1) {
          rooms[roomId].splice(idx, 1);
          socket.to(roomId).emit('peer-disconnected', socket.id);
          if (rooms[roomId].length === 0) delete rooms[roomId];
          break;
        }
      }
    });
  });
  const PORT = process.env.PORT || 3000;
  function tryListen(port) {
    server.listen(port, '0.0.0.0', () => {
      console.log('Signaling server running on port', port);
      process.env.NT_PORT = String(port);
      addUPnPMapping(port);
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log('Port', port, 'busy, trying', port + 1);
        tryListen(port + 1);
      } else {
        console.error('Server error:', err.message);
      }
    });
  }
  tryListen(PORT);
  signalingServer = server;
}

function getLocalIP() {
  const ifaces = os.networkInterfaces();
  const skipNames = ['vEthernet', 'virtual', 'vmware', 'virtualbox', 'bluetooth', 'pseudo'];
  // Pass 1: prefer Wi-Fi / wireless / беспроводная by name
  for (const name of Object.keys(ifaces)) {
    const lower = name.toLowerCase();
    if (skipNames.some(s => lower.includes(s))) continue;
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal &&
          (lower.includes('wi-fi') || lower.includes('wi_fi') || lower.includes('беспровод') || lower.includes('wireless'))) {
        return iface.address;
      }
    }
  }
  // Pass 2: first non-internal IPv4 (skip virtual adapters)
  for (const name of Object.keys(ifaces)) {
    const lower = name.toLowerCase();
    if (skipNames.some(s => lower.includes(s))) continue;
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  // Pass 3: last resort — any IPv4
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

let menuLang = 'ru';
const MENU_STR = {
  ru: {
    file: 'Файл', quit: 'Выход',
    settings: 'Настройки', modes: 'Режимы', fullscreen: 'Полный экран', devtools: 'Инструменты разработчика',
    help: 'Помощь', releaseNotes: 'История версий', about: 'О программе',
    ctxCopy: 'Копировать', ctxPaste: 'Вставить',
  },
  en: {
    file: 'File', quit: 'Quit',
    settings: 'Settings', modes: 'Modes', fullscreen: 'Full Screen', devtools: 'Developer Tools',
    help: 'Help', releaseNotes: 'Release Notes', about: 'About',
    ctxCopy: 'Copy', ctxPaste: 'Paste',
  }
};

function rebuildMenus(win) {
  if (!win) return;
  const s = MENU_STR[menuLang] || MENU_STR.ru;

  const appMenu = Menu.buildFromTemplate([
    {
      label: s.file,
      submenu: [ { role: 'quit', label: s.quit } ]
    },
    {
      label: s.settings,
      submenu: [
        { label: s.modes, click: () => win.webContents.send('show-settings') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: s.fullscreen },
        { type: 'separator' },
        { role: 'toggleDevTools', label: s.devtools },
      ]
    },
    {
      label: s.help,
      submenu: [
        { label: s.releaseNotes, click: () => win.webContents.send('show-release-notes') },
        { label: s.about, click: () => win.webContents.send('show-help') },
      ]
    }
  ]);
  Menu.setApplicationMenu(appMenu);

  win.webContents.removeAllListeners('context-menu');
  win.webContents.on('context-menu', () => {
    const ctx = Menu.buildFromTemplate([
      { label: s.ctxCopy, role: 'copy' },
      { label: s.ctxPaste, role: 'paste' },
      { type: 'separator' },
      { label: s.fullscreen, click: () => win.setFullScreen(!win.isFullScreen()) },
      { label: s.devtools, role: 'toggleDevTools' },
    ]);
    ctx.popup({ window: win });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 680,
    minWidth: 380,
    minHeight: 520,
    autoHideMenuBar: false,
    fullscreenable: true,
    title: 'TV Hamsters (v' + APP_VERSION + ')',
    icon: __dirname + '/icon.png',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  win.loadFile('renderer/index.html');

  win.on('close', () => {
    if (panelWindow) { panelWindow.close(); panelWindow = null; }
    if (facesWindow) { facesWindow.close(); facesWindow = null; }
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') win.webContents.toggleDevTools();
    if (input.key === 'F11') win.setFullScreen(!win.isFullScreen());
    if (input.key === 'Escape' && win.isFullScreen()) win.setFullScreen(false);
  });

  rebuildMenus(win);
}

ipcMain.on('toggle-fullscreen', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.setFullScreen(!win.isFullScreen());
});

ipcMain.handle('copy-clipboard', (event, text) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle('get-local-ip', () => getLocalIP());

ipcMain.handle('get-public-ip', async () => {
  const services = ['https://api.ipify.org', 'https://icanhazip.com', 'https://ifconfig.me/ip'];
  for (const url of services) {
    try {
      const res = await fetch(url);
      if (res.ok) return (await res.text()).trim();
    } catch {}
  }
  return getLocalIP();
});

ipcMain.handle('get-server-port', () => parseInt(process.env.NT_PORT || '3000'));

// Screen source picker — uses desktopCapturer + PowerShell to enumerate ALL windows (including minimized)
ipcMain.handle('get-screens', async () => {
  const sources = await desktopCapturer.getSources({ types: ['window', 'screen'], thumbnailSize: { width: 320, height: 240 } });
  // Get all window titles via PowerShell (includes minimized windows)
  let allTitles = [];
  try {
    const { execSync } = require('child_process');
    const psOut = execSync(`powershell -NoProfile -NonInteractive -Command "$OutputEncoding=[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -ExpandProperty MainWindowTitle"`, { timeout: 5000, encoding: 'utf8' });
    // Remove BOM and split
    allTitles = psOut.replace(/^\uFEFF/, '').split(/\r?\n/).map(t => t.trim()).filter(t => t.length > 0);
  } catch (e) {
    console.error('PowerShell window list failed:', e.message);
  }
  // Merge: mark titles not found in desktopCapturer list as minimized
  const capturerNames = sources.map(s => s.name.toLowerCase());
  const merged = sources.map(s => ({ id: s.id, name: s.name, thumbnail: s.thumbnail ? s.thumbnail.toDataURL() : '', minimized: false }));
  for (const title of allTitles) {
    const tl = title.toLowerCase();
    if (!capturerNames.includes(tl) && !tl.includes('tv hamsters') && !tl.includes('program manager')) {
      merged.push({ id: 'minimized:' + title, name: title + ' (свёрнуто)', thumbnail: '', minimized: true });
    }
  }
  return merged;
});

ipcMain.handle('set-screen-source', (event, sourceId) => {
  pendingScreenSourceId = sourceId;
});

ipcMain.handle('restore-window', async (event, title) => {
  if (!title) return false;
  const { execSync } = require('child_process');
  try {
    const escTitle = title.replace(/'/g, "''");
    execSync(`powershell -NoProfile -NonInteractive -Command "(New-Object -ComObject WScript.Shell).AppActivate('${escTitle}')"`, { timeout: 5000 });
    return true;
  } catch (e) {
    return false;
  }
});

ipcMain.handle('get-upnp-status', () => upnpStatus);
ipcMain.handle('get-cloud-url', () => CLOUD_SERVER_URL);
ipcMain.handle('create-desktop-shortcut', async () => {
  const { execSync } = require('child_process');
  const path = require('path');
  const exePath = process.env.PORTABLE_EXECUTABLE_FILE || process.argv[0];
  const iconPath = exePath;
  const desktop = path.join(require('os').homedir(), 'Desktop');
  const lnk = path.join(desktop, 'TV Hamsters.lnk');
  const escExe = exePath.replace(/'/g,"''");
  const escIcon = iconPath.replace(/'/g,"''");
  const ps = `$s=(New-Object -COM WScript.Shell).CreateShortcut('${lnk.replace(/'/g,"''")}');$s.TargetPath='${escExe}';$s.IconLocation='${escIcon},0';$s.WorkingDirectory='${path.dirname(exePath).replace(/'/g,"''")}';$s.Save()`;
  try { execSync(`powershell -Command "${ps}"`, { timeout: 10000 }); return true; } catch { return false; }
});

ipcMain.handle('open-url', (event, url) => {
  const { shell } = require('electron');
  shell.openExternal(url);
});

// --- Floating panel for screen sharing ---
let panelWindow = null;

ipcMain.handle('create-panel', (event) => {
  const mainWin = BrowserWindow.fromWebContents(event.sender);
  if (!mainWin || panelWindow) return;

  panelWindow = new BrowserWindow({
    width: 310,
    height: 78,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  panelWindow.loadFile('renderer/panel.html');
  panelWindow.once('ready-to-show', () => panelWindow.show());
  panelWindow.setAlwaysOnTop(true, 'pop-up-menu');

  // Position bottom-center
  const { workArea } = require('electron').screen.getPrimaryDisplay();
  panelWindow.setPosition(
    workArea.x + Math.round((workArea.width - 310) / 2),
    workArea.y + workArea.height - 88
  );

  panelWindow.on('closed', () => { panelWindow = null; });
});

ipcMain.handle('close-panel', () => {
  if (panelWindow) {
    panelWindow.close();
    panelWindow = null;
  }
});

// Bridge: main renderer → panel
ipcMain.on('panel-update', (event, data) => {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.webContents.send('panel-update', data);
  }
});

// Bridge: panel → main renderer
ipcMain.on('panel-action', (event, action) => {
  const allWins = BrowserWindow.getAllWindows();
  const mainWin = allWins.find(w => !w.isDestroyed() && w !== panelWindow && w !== facesWindow);
  if (mainWin) {
    mainWin.webContents.send('panel-action', action);
  }
});

ipcMain.handle('window-mode', (event, mode) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (mode === 'fullscreen') win.setFullScreen(true);
  else if (mode === 'minimized') win.minimize();
  else if (mode === 'restore') win.restore();
  else win.setFullScreen(false);
});

// --- Faces window for camera thumbnails ---
let facesWindow = null;

ipcMain.handle('create-faces', (event) => {
  const mainWin = BrowserWindow.fromWebContents(event.sender);
  if (!mainWin || facesWindow) return;

  const { workArea } = require('electron').screen.getPrimaryDisplay();
  const fw = 400, fh = 160;

  facesWindow = new BrowserWindow({
    width: fw,
    height: fh,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  facesWindow.loadFile('renderer/faces.html');
  facesWindow.once('ready-to-show', () => facesWindow.show());
  facesWindow.setAlwaysOnTop(true, 'pop-up-menu');

  // Position bottom-right
  facesWindow.setPosition(
    workArea.x + workArea.width - fw - 8,
    workArea.y + workArea.height - fh - 8
  );

  facesWindow.on('closed', () => { facesWindow = null; });
});

ipcMain.handle('close-faces', () => {
  if (facesWindow) {
    facesWindow.close();
    facesWindow = null;
  }
});

// Bridge: main renderer → faces window
ipcMain.on('faces-frames', (event, frames) => {
  if (facesWindow && !facesWindow.isDestroyed()) {
    facesWindow.webContents.send('faces-frames', frames);
  }
});

// Bridge: faces window → main renderer
ipcMain.on('faces-volume', (event, data) => {
  const wins = BrowserWindow.getAllWindows();
  const mainWin = wins.find(w => !w.isDestroyed() && w !== panelWindow && w !== facesWindow);
  if (mainWin) {
    mainWin.webContents.send('faces-volume', data);
  }
});

ipcMain.on('faces-mic-volume', (event, data) => {
  const wins = BrowserWindow.getAllWindows();
  const mainWin = wins.find(w => !w.isDestroyed() && w !== panelWindow && w !== facesWindow);
  if (mainWin) {
    mainWin.webContents.send('faces-mic-volume', data);
  }
});

ipcMain.on('set-language', (event, lang) => {
  if (lang !== 'ru' && lang !== 'en') return;
  menuLang = lang;
  const win = BrowserWindow.fromWebContents(event.sender);
  rebuildMenus(win);
});

app.whenReady().then(() => {
  startSignalingServer();
  registerProtocol();
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }
  app.on('second-instance', (event, argv) => {
    const url = argv.find(a => a.startsWith('hamsters://'));
    if (url) {
      const wins = BrowserWindow.getAllWindows();
      const mainWin = wins.find(w => !w.isDestroyed() && w !== panelWindow && w !== facesWindow);
      if (mainWin) {
        mainWin.webContents.send('deep-link', url);
        if (mainWin.isMinimized()) mainWin.restore();
        mainWin.focus();
      }
    } else {
      const wins = BrowserWindow.getAllWindows();
      const mainWin = wins.find(w => !w.isDestroyed() && w !== panelWindow && w !== facesWindow);
      if (mainWin) {
        if (mainWin.isMinimized()) mainWin.restore();
        mainWin.focus();
      }
    }
  });
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'display-capture'];
    if (allowed.includes(permission)) return callback(true);
    callback(false);
  });

  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    const id = pendingScreenSourceId;
    pendingScreenSourceId = null;
    desktopCapturer.getSources({ types: ['window', 'screen'] })
      .then(sources => {
        const source = sources.find(s => s.id === id) || sources[0];
        if (source) {
          try { callback({ video: source, audio: 'loopback' }); } catch (e) { console.error('DisplayMedia callback err:', e); }
        }
      })
      .catch(err => console.error('DisplayMedia sources err:', err));
  });

  createWindow();

  const deepLinkUrl = process.argv.find(a => a.startsWith('hamsters://'));
  if (deepLinkUrl) {
    const wins = BrowserWindow.getAllWindows();
    const mainWin = wins.find(w => !w.isDestroyed() && w !== panelWindow && w !== facesWindow);
    if (mainWin) mainWin.webContents.send('deep-link', deepLinkUrl);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (panelWindow) { panelWindow.close(); panelWindow = null; }
  if (facesWindow) { facesWindow.close(); facesWindow = null; }
  removeUPnPMapping();
  if (signalingServer) { signalingServer.close(); signalingServer = null; }
});
