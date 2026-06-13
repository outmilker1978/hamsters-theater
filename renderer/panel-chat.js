const { ipcRenderer } = require('electron');

document.addEventListener('auxclick', (e) => {
  if (e.button === 1) { e.preventDefault(); ipcRenderer.send('reset-panel-pos'); }
}, true);
document.addEventListener('mouseup', (e) => {
  if (e.button === 1) { e.preventDefault(); ipcRenderer.send('reset-panel-pos'); }
}, true);

function addMsg(name, text) {
  const msgs = document.getElementById('chatMsgs');
  if (!msgs) return;
  const el = document.createElement('div');
  el.className = 'chat-msg';
  el.innerHTML = '<span class="chat-msg-author">' + escapeHtml(name) + '</span><span class="chat-msg-text">' + escapeHtml(text) + '</span>';
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
}

function sendMsg() {
  const input = document.getElementById('chatInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  addMsg('\u042F', text);
  ipcRenderer.send('panel-chat-send', text);
}

document.getElementById('chatClose').onclick = () => { ipcRenderer.invoke('close-chat-window'); };
document.getElementById('chatSend').onclick = sendMsg;
document.getElementById('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMsg(); });
document.getElementById('chatInput').focus();

ipcRenderer.on('panel-chat-msg', (event, data) => {
  addMsg(data.name, data.text);
});

ipcRenderer.on('panel-chat-history', (event, messages) => {
  for (const msg of messages) {
    addMsg(msg.name, msg.text);
  }
});

ipcRenderer.invoke('get-chat-history').then(messages => {
  if (messages && messages.length) {
    for (const msg of messages) addMsg(msg.name, msg.text);
  }
});

function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
