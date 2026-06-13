const { ipcRenderer } = require('electron');

document.addEventListener('auxclick', (e) => {
  if (e.button === 1) { e.preventDefault(); ipcRenderer.send('reset-panel-pos'); }
}, true);
document.addEventListener('mouseup', (e) => {
  if (e.button === 1) { e.preventDefault(); ipcRenderer.send('reset-panel-pos'); }
}, true);

document.querySelectorAll('.react-btn').forEach(btn => {
  btn.onclick = () => {
    const emoji = btn.dataset.emoji;
    ipcRenderer.send('panel-reaction', emoji);
  };
});
document.getElementById('reactClose').onclick = () => {
  ipcRenderer.invoke('close-reactions-window');
};
