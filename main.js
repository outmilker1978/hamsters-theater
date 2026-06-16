const { app, BrowserWindow, session, ipcMain, Menu, clipboard, globalShortcut, desktopCapturer, shell } = require('electron');
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
let mainWindow = null;

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

let pendingDeepLinkCode = null;
let deepLinkServer = null;

function startDeepLinkServer() {
  const dls = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/ping') { res.writeHead(200); res.end('ok'); return; }
    if (url.pathname === '/join') {
      const code = url.searchParams.get('code');
      if (code) {
        pendingDeepLinkCode = code;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('deep-link', 'hamsters://join?code=' + code);
        }
      }
      res.writeHead(200); res.end('ok');
      return;
    }
    res.writeHead(404); res.end();
  });
  dls.listen(32456, () => console.log('[DeepLink] Server on port 32456'));
  dls.on('error', () => {}); // port busy, ignore
  deepLinkServer = dls;
  return dls;
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
      socket.roomId = roomId;
      socket.emit('room-created', roomId);
    });
    socket.on('join-room', (roomId) => {
      console.log('[Server] join-room: roomId=' + roomId + ' rooms=' + JSON.stringify(Object.keys(rooms)));
      socket.emit('server-log', '[Server] join-room: roomId=' + roomId + ' rooms=' + JSON.stringify(Object.keys(rooms)));
      if (!rooms[roomId]) { socket.emit('error-msg', 'Комната не найдена'); return; }
      if (rooms[roomId].length >= 5) { socket.emit('error-msg', 'Комната уже заполнена'); return; }
      rooms[roomId].push(socket.id);
      socket.join(roomId);
      socket.roomId = roomId;
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
      socket.to(data.to).emit('signal', { from: socket.id, type: data.signalType, name: data.name });
    });
    socket.on('chat-message', (data) => {
      if (socket.roomId) {
        socket.to(socket.roomId).emit('chat-message', { from: socket.id, text: data.text, name: data.name || 'Хомячок', time: Date.now() });
      }
    });
    socket.on('reaction', (data) => {
      if (socket.roomId) {
        socket.to(socket.roomId).emit('reaction', { from: socket.id, emoji: data.emoji });
      }
    });
    socket.on('jumpscare', (data) => {
      if (socket.roomId) {
        io.to(socket.roomId).emit('jumpscare', { from: socket.id, name: (data && data.name) || '\u0425\u043E\u043C\u044F\u043A' });
      }
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

let menuLang = 'en';
const MENU_STR = {
  ru: {
    file: 'Файл', quit: 'Выход',
    settings: 'Настройки', modes: 'Режимы', fullscreen: 'Полный экран', devtools: 'Инструменты разработчика',
    help: 'Помощь', releaseNotes: 'История версий', about: 'О программе',
    supportBoosty: 'Помочь Хомяку создателю через Boosty',
    supportCloud: 'Помочь Хомяку создателю через CloudTips',
    ctxCopy: 'Копировать', ctxPaste: 'Вставить',
  },
  en: {
    file: 'File', quit: 'Quit',
    settings: 'Settings', modes: 'Modes', fullscreen: 'Full Screen', devtools: 'Developer Tools',
    help: 'Help', releaseNotes: 'Release Notes', about: 'About',
    supportBoosty: 'Support the Hamster creator via Boosty',
    supportCloud: 'Support the Hamster creator via CloudTips',
    ctxCopy: 'Copy', ctxPaste: 'Paste',
  },
  es: {
    file: 'Archivo', quit: 'Salir',
    settings: 'Ajustes', modes: 'Modos', fullscreen: 'Pantalla completa', devtools: 'Herramientas de desarrollador',
    help: 'Ayuda', releaseNotes: 'Historial de versiones', about: 'Acerca de',
    supportBoosty: 'Ayudar al H\u00E1mster creador a trav\u00E9s de Boosty',
    supportCloud: 'Ayudar al H\u00E1mster creador a trav\u00E9s de CloudTips',
    ctxCopy: 'Copiar', ctxPaste: 'Pegar',
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
        { type: 'separator' },
        { label: s.supportBoosty, click: () => { win.webContents.send('close-all-modals'); shell.openExternal('https://boosty.to/outmilker'); } },
        { label: s.supportCloud, click: () => { win.webContents.send('close-all-modals'); shell.openExternal('https://pay.cloudtips.ru/p/8485a55c'); } },
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

let sharingActive = false;

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

  mainWindow = win;

  win.loadFile('renderer/index.html');

  win.on('close', () => {
    if (panelWindow) { panelWindow.close(); panelWindow = null; }
    if (facesWindow) { facesWindow.close(); facesWindow = null; }
    if (reactionsWindow) { reactionsWindow.close(); reactionsWindow = null; }
    if (panelChatWindow) { panelChatWindow.close(); panelChatWindow = null; }
    if (panelReactionsWindow) { panelReactionsWindow.close(); panelReactionsWindow = null; }
  });

  win.on('minimize', () => {
    if (sharingActive) {
      if (panelWindow && !panelWindow.isDestroyed()) panelWindow.show();
      if (panelChatWindow && !panelChatWindow.isDestroyed()) panelChatWindow.show();
      if (panelReactionsWindow && !panelReactionsWindow.isDestroyed()) panelReactionsWindow.show();
      if (facesWindow && !facesWindow.isDestroyed()) facesWindow.show();
      if (reactionsWindow && !reactionsWindow.isDestroyed()) reactionsWindow.show();
    }
  });

  win.on('restore', () => {
    if (sharingActive) {
      if (panelWindow && !panelWindow.isDestroyed()) panelWindow.hide();
      if (panelChatWindow && !panelChatWindow.isDestroyed()) panelChatWindow.hide();
      if (panelReactionsWindow && !panelReactionsWindow.isDestroyed()) panelReactionsWindow.hide();
      if (facesWindow && !facesWindow.isDestroyed()) facesWindow.hide();
      if (reactionsWindow && !reactionsWindow.isDestroyed()) reactionsWindow.hide();
    }
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') win.webContents.toggleDevTools();
    if (input.key === 'F11') win.setFullScreen(!win.isFullScreen());
    if (input.key === 'Escape' && win.isFullScreen()) win.setFullScreen(false);
  });

  win.webContents.on('did-finish-load', () => {
    const deepLinkUrl = process.argv.find(a => a.startsWith('hamsters://'));
    if (deepLinkUrl) {
      win.webContents.send('deep-link', deepLinkUrl);
    }
    if (pendingDeepLinkCode) {
      win.webContents.send('deep-link', 'hamsters://join?code=' + pendingDeepLinkCode);
      pendingDeepLinkCode = null;
    }
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
    width: 560,
    height: 90,
    frame: false,
    transparent: false,
    backgroundColor: '#120e14',
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
  sharingActive = true;
  panelWindow.once('ready-to-show', () => panelWindow.show());
  panelWindow.setAlwaysOnTop(true, 'screen-saver');
  var panelTopTimer = setInterval(() => { if (panelWindow && !panelWindow.isDestroyed()) panelWindow.setAlwaysOnTop(true, 'screen-saver'); }, 5000);
  panelWindow.on('close', () => { clearInterval(panelTopTimer); });

  // Position bottom-center
  const { workArea } = require('electron').screen.getPrimaryDisplay();
  panelWindow.setPosition(
    workArea.x + Math.round((workArea.width - 560) / 2),
    workArea.y + workArea.height - 10 - 90
  );

  panelWindow.on('closed', () => {
    stopChildPoll();
    if (panelChatWindow) { panelChatWindow.close(); panelChatWindow = null; }
    if (panelReactionsWindow) { panelReactionsWindow.close(); panelReactionsWindow = null; }
    panelWindow = null; sharingActive = false;
  });
});

ipcMain.handle('close-panel', () => {
  stopChildPoll();
  if (panelChatWindow) { panelChatWindow.close(); panelChatWindow = null; }
  if (panelReactionsWindow) { panelReactionsWindow.close(); panelReactionsWindow = null; }
  if (panelWindow) {
    panelWindow.close();
    panelWindow = null;
    sharingActive = false;
  }
});

// Bridge: main renderer → panel
ipcMain.on('panel-update', (event, data) => {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.webContents.send('panel-update', data);
  }
});

// --- Child windows for chat and reactions (follow panel) ---
let panelChatWindow = null;
let panelReactionsWindow = null;
let panelChildPoll = null;
let chatHistory = [];
const CHAT_HISTORY_MAX = 200;

function updatePanelChildren() {
  if (!panelWindow || panelWindow.isDestroyed()) return;
  const [px, py] = panelWindow.getPosition();
  if (panelChatWindow && !panelChatWindow.isDestroyed()) {
    panelChatWindow.setPosition(px, py - 190);
  }
  if (panelReactionsWindow && !panelReactionsWindow.isDestroyed()) {
    panelReactionsWindow.setPosition(px, py - 56);
  }
}

function startChildPoll() {
  if (panelChildPoll) return;
  panelChildPoll = setInterval(updatePanelChildren, 50);
}

function stopChildPoll() {
  if (panelChildPoll) {
    clearInterval(panelChildPoll);
    panelChildPoll = null;
  }
}

ipcMain.handle('get-chat-history', () => chatHistory);

ipcMain.handle('open-chat-window', () => {
  if (panelChatWindow || !panelWindow) return;
  if (panelWindow && !panelWindow.isDestroyed()) panelWindow.webContents.send('panel-child-opened');
  const [px, py] = panelWindow.getPosition();
  panelChatWindow = new BrowserWindow({
    width: 560, height: 190,
    parent: panelWindow,
    frame: false, transparent: false, backgroundColor: '#120e14', alwaysOnTop: true, skipTaskbar: true, resizable: false, show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  panelChatWindow.setPosition(px, py - 190);
  panelChatWindow.loadFile('renderer/panel-chat.html');
  panelChatWindow.once('ready-to-show', () => {
    panelChatWindow.show();
    panelChatWindow.webContents.send('panel-chat-history', chatHistory);
  });
  startChildPoll();
  panelChatWindow.on('closed', () => {
    panelChatWindow = null;
    if (!panelReactionsWindow) stopChildPoll();
    if (panelWindow && !panelWindow.isDestroyed()) panelWindow.webContents.send('panel-child-closed');
  });
});

ipcMain.handle('close-chat-window', () => {
  if (panelChatWindow) { panelChatWindow.close(); panelChatWindow = null; }
  if (!panelReactionsWindow) stopChildPoll();
  if (panelWindow && !panelWindow.isDestroyed()) panelWindow.webContents.send('panel-child-closed');
});
ipcMain.handle('has-chat-window', () => panelChatWindow !== null && !panelChatWindow.isDestroyed());

ipcMain.handle('open-reactions-window', () => {
  if (panelReactionsWindow || !panelWindow) return;
  if (panelWindow && !panelWindow.isDestroyed()) panelWindow.webContents.send('panel-child-opened');
  const [px, py] = panelWindow.getPosition();
  panelReactionsWindow = new BrowserWindow({
    width: 560, height: 56,
    parent: panelWindow,
    frame: false, transparent: false, backgroundColor: '#120e14', alwaysOnTop: true, skipTaskbar: true, resizable: false, show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  panelReactionsWindow.setPosition(px, py - 56);
  panelReactionsWindow.loadFile('renderer/panel-reactions.html');
  panelReactionsWindow.once('ready-to-show', () => { panelReactionsWindow.show(); });
  startChildPoll();
  panelReactionsWindow.on('closed', () => {
    panelReactionsWindow = null;
    if (!panelChatWindow) stopChildPoll();
    if (panelWindow && !panelWindow.isDestroyed()) panelWindow.webContents.send('panel-child-closed');
  });
});

ipcMain.handle('close-reactions-window', () => {
  if (panelReactionsWindow) { panelReactionsWindow.close(); panelReactionsWindow = null; }
  if (!panelChatWindow) stopChildPoll();
  if (panelWindow && !panelWindow.isDestroyed()) panelWindow.webContents.send('panel-child-closed');
});
ipcMain.handle('has-reactions-window', () => panelReactionsWindow !== null && !panelReactionsWindow.isDestroyed());

// Bridge: chat from main window → history + panel
ipcMain.on('main-chat-send', (event, text) => {
  chatHistory.push({ name: '\u042F', text, time: Date.now() });
  if (chatHistory.length > CHAT_HISTORY_MAX) chatHistory.shift();
  if (panelChatWindow && !panelChatWindow.isDestroyed()) {
    panelChatWindow.webContents.send('panel-chat-msg', { name: '\u042F', text });
  }
});

// Bridge: chat from panel chat window → main renderer + history
ipcMain.on('panel-chat-send', (event, text) => {
  chatHistory.push({ name: '\u042F', text, time: Date.now() });
  if (chatHistory.length > CHAT_HISTORY_MAX) chatHistory.shift();
  const wins = BrowserWindow.getAllWindows();
  const mainWin = wins.find(w => !w.isDestroyed() && w !== panelWindow && w !== facesWindow && w !== reactionsWindow && w !== panelChatWindow && w !== panelReactionsWindow);
  if (mainWin) mainWin.webContents.send('faces-send-chat', text);
});
ipcMain.on('panel-chat-msg', (event, data) => {
  if (panelChatWindow && !panelChatWindow.isDestroyed()) {
    panelChatWindow.webContents.send('panel-chat-msg', data);
  }
});

// Bridge: reactions from reactions window → all targets
ipcMain.on('panel-reaction', (event, emoji) => {
  const wins = BrowserWindow.getAllWindows();
  const mainWin = wins.find(w => !w.isDestroyed() && w !== panelWindow && w !== facesWindow && w !== reactionsWindow && w !== panelChatWindow && w !== panelReactionsWindow);
  if (mainWin) mainWin.webContents.send('faces-send-reaction', emoji);
  const fw = wins.find(w => !w.isDestroyed() && w === facesWindow);
  if (fw) fw.webContents.send('faces-reaction', emoji);
  const rw = wins.find(w => !w.isDestroyed() && w === reactionsWindow);
  if (rw) rw.webContents.send('show-overlay-reaction', emoji);
});

// --- Reaction overlay window (fullscreen, transparent) ---
let reactionsWindow = null;

ipcMain.handle('create-reactions-overlay', (event) => {
  if (reactionsWindow) return;
  const { workArea } = require('electron').screen.getPrimaryDisplay();
  reactionsWindow = new BrowserWindow({
    width: workArea.width,
    height: workArea.height,
    x: workArea.x,
    y: workArea.y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });
  reactionsWindow.loadFile('renderer/reactions.html');
  reactionsWindow.once('ready-to-show', () => reactionsWindow.show());
  reactionsWindow.setIgnoreMouseEvents(true);
  reactionsWindow.on('closed', () => { reactionsWindow = null; });
});

ipcMain.handle('close-reactions-overlay', () => {
  if (reactionsWindow) {
    reactionsWindow.close();
    reactionsWindow = null;
  }
});

var scrimerActive = false;

ipcMain.handle('show-scrimer', (event) => {
  if (scrimerActive) return;
  scrimerActive = true;
  const { workArea } = require('electron').screen.getPrimaryDisplay();
  var win = new BrowserWindow({
    width: workArea.width,
    height: workArea.height,
    x: workArea.x,
    y: workArea.y,
    frame: false,
    transparent: false,
    backgroundColor: '#000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });
  win.loadFile('renderer/scrimer.html');
  win.once('ready-to-show', function() { win.show(); });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.on('closed', function() { scrimerActive = false; win = null; });
});

// Bridge: panel → main renderer
ipcMain.on('forward-reaction', (event, emoji) => {
  const allWins = BrowserWindow.getAllWindows();
  const fw = allWins.find(w => !w.isDestroyed() && w === facesWindow);
  if (fw) fw.webContents.send('faces-reaction', emoji);
  const rw = allWins.find(w => !w.isDestroyed() && w === reactionsWindow);
  if (rw) rw.webContents.send('show-overlay-reaction', emoji);
});

ipcMain.on('forward-chat', (event, data) => {
  chatHistory.push(data);
  if (chatHistory.length > CHAT_HISTORY_MAX) chatHistory.shift();
  if (panelChatWindow && !panelChatWindow.isDestroyed()) {
    panelChatWindow.webContents.send('panel-chat-msg', data);
  }
  const fw = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w === facesWindow);
  if (fw) fw.webContents.send('faces-chat-toast', data);
});

ipcMain.on('panel-send-chat', (event, text) => {
  chatHistory.push({ name: '\u042F', text, time: Date.now() });
  if (chatHistory.length > CHAT_HISTORY_MAX) chatHistory.shift();
  const allWins = BrowserWindow.getAllWindows();
  const win = allWins.find(w => !w.isDestroyed() && w !== panelWindow && w !== facesWindow && w !== reactionsWindow && w !== panelChatWindow && w !== panelReactionsWindow);
  if (win) win.webContents.send('faces-send-chat', text);
});

ipcMain.on('faces-send-reaction', (event, emoji) => {
  const allWins = BrowserWindow.getAllWindows();
  const win = allWins.find(w => !w.isDestroyed() && w !== panelWindow && w !== facesWindow && w !== reactionsWindow && w !== panelChatWindow && w !== panelReactionsWindow);
  if (win) win.webContents.send('faces-send-reaction', emoji);
});

ipcMain.on('panel-action', (event, action, data) => {
  const allWins = BrowserWindow.getAllWindows();
  const mainWin = allWins.find(w => !w.isDestroyed() && w !== panelWindow && w !== facesWindow && w !== reactionsWindow && w !== panelChatWindow && w !== panelReactionsWindow);
  const fw = allWins.find(w => !w.isDestroyed() && w === facesWindow);
  if (action === 'show-chat') {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.webContents.send('panel-chat-toggle');
    }
    return;
  }
  if (action === 'show-reaction') {
    return;
  }
  if (action === 'send-reaction') {
    if (mainWin) mainWin.webContents.send('faces-send-reaction', data);
    if (fw && !fw.isDestroyed()) {
      fw.webContents.send('faces-reaction', data);
    }
    const rw = allWins.find(w => !w.isDestroyed() && w === reactionsWindow);
    if (rw) rw.webContents.send('show-overlay-reaction', data);
    return;
  }
  if (action === 'toast-chat') {
    if (fw && !fw.isDestroyed()) {
      fw.webContents.send('faces-chat-toast', data);
    }
    return;
  }
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
  const fw = 400, fh = 200;

  facesWindow = new BrowserWindow({
    width: fw,
    height: fh,
    minWidth: 340,
    minHeight: 120,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    hasShadow: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  facesWindow.loadFile('renderer/faces.html');
  facesWindow.once('ready-to-show', () => facesWindow.show());
  facesWindow.setAlwaysOnTop(true, 'screen-saver');
  var facesTopTimer = setInterval(() => { if (facesWindow && !facesWindow.isDestroyed()) facesWindow.setAlwaysOnTop(true, 'screen-saver'); }, 5000);
  facesWindow.on('close', () => { clearInterval(facesTopTimer); });

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

ipcMain.on('reset-faces-size', () => {
  if (facesWindow && !facesWindow.isDestroyed()) {
    facesWindow.setSize(400, 200);
    const { workArea } = require('electron').screen.getPrimaryDisplay();
    facesWindow.setPosition(
      workArea.x + workArea.width - 400 - 8,
      workArea.y + workArea.height - 200 - 8
    );
  }
});

ipcMain.on('reset-panel-pos', () => {
  stopChildPoll();
  if (panelChatWindow) { panelChatWindow.close(); panelChatWindow = null; }
  if (panelReactionsWindow) { panelReactionsWindow.close(); panelReactionsWindow = null; }
  if (panelWindow && !panelWindow.isDestroyed()) {
    const { workArea } = require('electron').screen.getPrimaryDisplay();
    const x = workArea.x + Math.round((workArea.width - 560) / 2);
    panelWindow.setPosition(x, workArea.y + workArea.height - 10 - 90);
    panelWindow.webContents.send('panel-reset');
  }
});
ipcMain.on('drag-panel-pos', (e, dx, dy) => {
  if (panelWindow && !panelWindow.isDestroyed()) {
    const [x, y] = panelWindow.getPosition();
    const { workArea } = require('electron').screen.getPrimaryDisplay();
    const clampedX = Math.max(workArea.x, Math.min(x + dx, workArea.x + workArea.width - 560));
    const clampedY = Math.max(workArea.y, Math.min(y + dy, workArea.y + workArea.height - 90));
    panelWindow.setPosition(clampedX, clampedY);
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
  const mainWin = wins.find(w => !w.isDestroyed() && w !== panelWindow && w !== facesWindow && w !== reactionsWindow && w !== panelChatWindow && w !== panelReactionsWindow);
  if (mainWin) {
    mainWin.webContents.send('faces-volume', data);
  }
});

ipcMain.on('faces-mic-volume', (event, data) => {
  const wins = BrowserWindow.getAllWindows();
  const mainWin = wins.find(w => !w.isDestroyed() && w !== panelWindow && w !== facesWindow && w !== reactionsWindow && w !== panelChatWindow && w !== panelReactionsWindow);
  if (mainWin) {
    mainWin.webContents.send('faces-mic-volume', data);
  }
});

ipcMain.on('set-language', (event, lang) => {
  if (!MENU_STR[lang]) return;
  menuLang = lang;
  const win = BrowserWindow.fromWebContents(event.sender);
  rebuildMenus(win);
});

app.whenReady().then(() => {
  startSignalingServer();
  registerProtocol();
  startDeepLinkServer();
  // const gotLock = app.requestSingleInstanceLock();
  // if (!gotLock) {
  //   app.quit();
  //   return;
  // }
  // app.on('second-instance', (event, argv) => {
  //   const url = argv.find(a => a.startsWith('hamsters://'));
  //   if (mainWindow && !mainWindow.isDestroyed()) {
  //     if (url) {
  //       mainWindow.webContents.send('deep-link', url);
  //     }
  //     if (mainWindow.isMinimized()) mainWindow.restore();
  //     mainWindow.focus();
  //   }
  // });
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (panelWindow) { panelWindow.close(); panelWindow = null; }
  if (panelChatWindow) { panelChatWindow.close(); panelChatWindow = null; }
  if (panelReactionsWindow) { panelReactionsWindow.close(); panelReactionsWindow = null; }
  if (facesWindow) { facesWindow.close(); facesWindow = null; }
  if (reactionsWindow) { reactionsWindow.close(); reactionsWindow = null; }
  removeUPnPMapping();
  if (signalingServer) { signalingServer.close(); signalingServer = null; }
  if (deepLinkServer) { deepLinkServer.close(); deepLinkServer = null; }
});
