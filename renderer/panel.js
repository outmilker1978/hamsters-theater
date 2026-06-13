const { ipcRenderer } = require('electron');

let micMode = 'normal';
/* custom drag */
let _drag = false;
let _dx = 0, _dy = 0;
document.addEventListener('mousedown', (e) => {
  if (e.button === 0 && !e.target.closest('.control-btn')) {
    _drag = true; _dx = e.screenX; _dy = e.screenY; e.preventDefault();
  }
});
document.addEventListener('mousemove', (e) => {
  if (!_drag) return;
  const dx = e.screenX - _dx, dy = e.screenY - _dy;
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
    ipcRenderer.send('drag-panel-pos', dx, dy);
    _dx = e.screenX; _dy = e.screenY;
  }
});
document.addEventListener('mouseup', (e) => { if (e.button === 0) _drag = false; });
/* middle-click reset */
document.addEventListener('auxclick', (e) => {
  if (e.button === 1) { e.preventDefault(); ipcRenderer.send('reset-panel-pos'); }
}, true);
document.addEventListener('mouseup', (e) => {
  if (e.button === 1) { e.preventDefault(); ipcRenderer.send('reset-panel-pos'); }
}, true);

const map = { 'btn-mic':'toggle-mic', 'btn-cam':'toggle-cam', 'btn-screen':'toggle-screen', 'btn-leave':'leave' };
for (const [id, action] of Object.entries(map)) {
  const btn = document.getElementById(id);
  if (btn) btn.onclick = () => { try { ipcRenderer.send('panel-action', action); } catch(e) {} };
}

document.getElementById('btn-chat').onclick = () => {
  ipcRenderer.invoke('has-chat-window').then(exists => {
    if (exists) { ipcRenderer.invoke('close-chat-window'); }
    else { ipcRenderer.invoke('close-reactions-window'); ipcRenderer.invoke('open-chat-window'); }
  });
};
document.getElementById('btn-reaction').onclick = () => {
  ipcRenderer.invoke('has-reactions-window').then(exists => {
    if (exists) { ipcRenderer.invoke('close-reactions-window'); }
    else { ipcRenderer.invoke('close-chat-window'); ipcRenderer.invoke('open-reactions-window'); }
  });
};

const micBtn = document.getElementById('btn-mic');
if (micBtn) {
  micBtn.oncontextmenu = (e) => { e.preventDefault(); try { ipcRenderer.send('panel-action', 'toggle-mic-mode'); } catch(e) {} };
}

const pttBtn = document.getElementById('btn-ptt');
if (pttBtn) {
  pttBtn.onmousedown = (e) => { e.preventDefault(); try { ipcRenderer.send('panel-action', 'open-ptt'); } catch(e) {} };
  pttBtn.onmouseup = () => { try { ipcRenderer.send('panel-action', 'close-ptt'); } catch(e) {} };
}

ipcRenderer.on('panel-child-opened', () => {
  document.body.style.borderRadius = '0 0 16px 16px';
});
ipcRenderer.on('panel-child-closed', () => {
  document.body.style.borderRadius = '16px';
});

ipcRenderer.on('panel-reset', () => {
  document.body.style.borderRadius = '16px';
});

ipcRenderer.on('panel-update', (e, state) => {
  const m = document.getElementById('btn-mic');
  if (m) { m.className = 'control-btn' + (state.micOn ? ' active' : '') + (micMode === 'ptt' ? ' ptt' : ''); }
  const c = document.getElementById('btn-cam');
  if (c) { c.className = 'control-btn' + (state.camOn ? ' active' : ''); }
  const pt = document.getElementById('btn-ptt');
  if (pt) { pt.style.display = (state.pttActive && micMode === 'ptt') ? 'flex' : 'none'; }
  const s = document.getElementById('btn-screen');
  if (s) { s.className = 'control-btn' + (state.sharingScreen ? ' active' : ''); }
});
