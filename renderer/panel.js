const { ipcRenderer } = require('electron');

let micMode = 'normal';

// Direct button handlers (same pattern as faces.js — works)
const map = { 'btn-mic':'toggle-mic', 'btn-cam':'toggle-cam', 'btn-screen':'toggle-screen', 'btn-leave':'leave' };
for (const [id, action] of Object.entries(map)) {
  const btn = document.getElementById(id);
  if (btn) btn.onclick = () => { try { ipcRenderer.send('panel-action', action); } catch(e) {} };
}

// Right click on mic
const micBtn = document.getElementById('btn-mic');
if (micBtn) {
  micBtn.oncontextmenu = (e) => { e.preventDefault(); try { ipcRenderer.send('panel-action', 'toggle-mic-mode'); } catch(e) {} };
}

// PTT
const pttBtn = document.getElementById('btn-ptt');
if (pttBtn) {
  pttBtn.onmousedown = (e) => { e.preventDefault(); try { ipcRenderer.send('panel-action', 'open-ptt'); } catch(e) {} };
  pttBtn.onmouseup = () => { try { ipcRenderer.send('panel-action', 'close-ptt'); } catch(e) {} };
}

// State update
ipcRenderer.on('panel-update', (event, state) => {
  micMode = state.micMode;
  const setClass = (id, cls) => { const el = document.getElementById(id); if (el) el.className = cls; };
  setClass('btn-mic', 'control-btn' + (state.micOn ? ' active' : ' active off'));
  setClass('btn-cam', 'control-btn' + (state.camOn ? ' active' : ' active off'));
  const ptt = document.getElementById('btn-ptt');
  if (ptt) {
    ptt.style.display = micMode === 'ptt' ? 'flex' : 'none';
    ptt.className = 'control-btn ptt' + (state.pttActive ? ' active' : '');
  }
  setClass('btn-screen', 'control-btn' + (state.sharingScreen ? ' sharing' : ''));
});
