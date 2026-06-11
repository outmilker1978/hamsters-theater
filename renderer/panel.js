const { ipcRenderer } = require('electron');

let micMode = 'normal';
let chatOpen = false;

const map = { 'btn-mic':'toggle-mic', 'btn-cam':'toggle-cam', 'btn-screen':'toggle-screen', 'btn-leave':'leave' };
for (const [id, action] of Object.entries(map)) {
  const btn = document.getElementById(id);
  if (btn) btn.onclick = () => { try { ipcRenderer.send('panel-action', action); } catch(e) {} };
}

const chatBtn = document.getElementById('btn-chat');
if (chatBtn) chatBtn.onclick = toggleChat;

const REACT_H = 56;
const reactBtn = document.getElementById('btn-reaction');
let reactOpen = false;
if (reactBtn) reactBtn.onclick = () => {
  reactOpen = !reactOpen;
  const el = document.getElementById('panel-reactions');
  if (el) el.classList.toggle('open', reactOpen);
  if (reactOpen && chatOpen) { toggleChat(); }
  updatePanelSize();
};
function updatePanelSize() {
  let h = 70;
  if (chatOpen) h = 260;
  else if (reactOpen) h = 70 + REACT_H;
  try { ipcRenderer.send('panel-resize', h); } catch(e) {}
}

document.querySelectorAll('.panel-reaction-btn').forEach(btn => {
  btn.onclick = () => {
    const emoji = btn.dataset.emoji;
    document.getElementById('panel-reactions').classList.remove('open');
    reactOpen = false;
    updatePanelSize();
    try { ipcRenderer.send('panel-action', 'send-reaction', emoji); } catch(e) {}
  };
});

const micBtn = document.getElementById('btn-mic');
if (micBtn) {
  micBtn.oncontextmenu = (e) => { e.preventDefault(); try { ipcRenderer.send('panel-action', 'toggle-mic-mode'); } catch(e) {} };
}

const pttBtn = document.getElementById('btn-ptt');
if (pttBtn) {
  pttBtn.onmousedown = (e) => { e.preventDefault(); try { ipcRenderer.send('panel-action', 'open-ptt'); } catch(e) {} };
  pttBtn.onmouseup = () => { try { ipcRenderer.send('panel-action', 'close-ptt'); } catch(e) {} };
}

function toggleChat() {
  chatOpen = !chatOpen;
  const el = document.getElementById('panel-chat');
  if (el) el.classList.toggle('open', chatOpen);
  if (reactOpen && chatOpen) { reactOpen = false; document.getElementById('panel-reactions').classList.remove('open'); }
  updatePanelSize();
  if (chatOpen) {
    const input = document.getElementById('panelChatInput');
    if (input) setTimeout(() => input.focus(), 200);
  }
}

function addPanelChatMsg(name, text) {
  const msgs = document.getElementById('panelChatMsgs');
  if (!msgs) return;
  const el = document.createElement('div');
  el.className = 'panel-chat-msg';
  el.innerHTML = '<span class="panel-chat-msg-author">' + escapeHtml(name) + '</span><span class="panel-chat-msg-text">' + escapeHtml(text) + '</span>';
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
}

function sendPanelChat() {
  const input = document.getElementById('panelChatInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  addPanelChatMsg('\u042F', text);
  ipcRenderer.send('panel-send-chat', text);
}

const sendBtn = document.getElementById('panelChatSend');
if (sendBtn) sendBtn.onclick = sendPanelChat;
const chatInput = document.getElementById('panelChatInput');
if (chatInput) chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendPanelChat(); });
const chatClose = document.getElementById('panelChatClose');
if (chatClose) chatClose.onclick = toggleChat;

ipcRenderer.on('panel-chat-msg', (event, data) => {
  if (!chatOpen) {
    try { ipcRenderer.send('panel-action', 'toast-chat', data); } catch(e) {}
  }
  addPanelChatMsg(data.name, data.text);
});

// Toggle from main (e.g. when incoming message auto-opens)
ipcRenderer.on('panel-chat-toggle', () => {
  if (!chatOpen) toggleChat();
});

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

function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
