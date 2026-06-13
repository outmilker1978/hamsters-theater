const { ipcRenderer } = require('electron');

ipcRenderer.on('show-overlay-reaction', (event, emoji) => {
  const el = document.createElement('div');
  el.className = 'reaction-float';
  el.textContent = emoji;
  el.style.left = (5 + Math.random() * 90) + '%';
  el.style.bottom = (30 + Math.random() * 60) + 'px';
  el.style.animation = 'floatBubble ' + (5 + Math.random() * 3) + 's cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 8500);
});
