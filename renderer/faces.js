const { ipcRenderer } = require('electron');
const container = document.getElementById('faces-container');
let faceData = {};

ipcRenderer.on('faces-frames', (event, frames) => {
  if (!frames || !frames.length) {
    container.innerHTML = '<div class="no-faces">\u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0438 \u043F\u043E\u044F\u0432\u044F\u0442\u0441\u044F \u0437\u0434\u0435\u0441\u044C</div>';
    return;
  }
  const currentIds = frames.map(f => f.id);
  for (const id of Object.keys(faceData)) {
    if (!currentIds.includes(id)) {
      const el = document.getElementById('face-' + id);
      if (el) el.remove();
      delete faceData[id];
    }
  }
  for (const f of frames) {
    if (!faceData[f.id]) {
      const card = document.createElement('div');
      card.className = 'face-card';
      card.id = 'face-' + f.id;
      const img = document.createElement('img');
      img.id = 'img-' + f.id;
      img.alt = '';
      card.appendChild(img);
      const label = document.createElement('div');
      label.className = 'label';
      label.id = 'lbl-' + f.id;
      label.textContent = f.isLocal ? '\u0412\u044B' : '\u0425\u043E\u043C\u044F\u0447\u043E\u043A';
      card.appendChild(label);
      const volContainer = document.createElement('div');
      volContainer.className = 'vol-container';
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = 0;
      slider.max = 100;
      slider.value = f.isLocal ? (localStorage.getItem('micVolume') || 100) : (localStorage.getItem('fvol-' + f.id) || 100);
      slider.oninput = () => {
        const vol = slider.value / 100;
        if (f.isLocal) {
          localStorage.setItem('micVolume', slider.value);
          ipcRenderer.send('faces-mic-volume', { volume: vol });
        } else {
          localStorage.setItem('fvol-' + f.id, slider.value);
          ipcRenderer.send('faces-volume', { peerId: f.id, volume: vol });
        }
      };
      volContainer.appendChild(slider);
      card.appendChild(volContainer);
      container.appendChild(card);
      faceData[f.id] = { card, img, label, slider };
    }
    if (f.data) {
      faceData[f.id].img.src = f.data;
      faceData[f.id].img.style.display = 'block';
    } else {
      faceData[f.id].img.style.display = 'none';
    }
  }
});

ipcRenderer.on('faces-reaction', (event, emoji) => {
  const el = document.createElement('div');
  el.textContent = emoji;
  el.style.cssText = 'position:fixed;top:50%;left:50%;font-size:48px;transform:translate(-50%,-50%);animation:reactionFade 2s ease-out forwards;pointer-events:none;z-index:999';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
});

ipcRenderer.on('faces-chat-toast', (event, data) => {
  if (!data) return;
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:12px;left:8px;right:8px;background:rgba(18,14,20,0.9);color:#e8d8f0;padding:8px 12px;border-radius:10px;font-size:12px;line-height:1.4;animation:chatFadeIn 0.3s ease-out;z-index:998;pointer-events:none';
  el.innerHTML = '<b style="color:#c285e4">' + escapeHtml(data.name) + '</b>: ' + escapeHtml(data.text);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
});

function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
