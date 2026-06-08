const { ipcRenderer } = require('electron');
const container = document.getElementById('faces-container');
let faceData = {};

ipcRenderer.on('faces-frames', (event, frames) => {
  if (!frames || !frames.length) {
    container.innerHTML = '<div class="no-faces">Участники появятся здесь</div>';
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
      label.textContent = f.isLocal ? 'Вы' : 'Хомячок';
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
