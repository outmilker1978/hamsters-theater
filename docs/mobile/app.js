const CLOUD = 'https://tv-hamsters-bot.onrender.com';
const RTC = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    {
      urls: 'turn:relay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};
const MEDIA = { video: { facingMode: 'user', width: { ideal: 240 }, height: { ideal: 180 }, frameRate: { ideal: 15, max: 20 } }, audio: { echoCancellation: true, noiseSuppression: true } };

let socket, localStream, roomId, isHost = false;
let peers = {}, pendingOffers = [], pendingPeers = [];
let micOn = true, camOn = true;
let connecting = false;
let sharerId = null;
let camsVisible = true;

const $ = id => document.getElementById(id);

function toast(msg) { const t = $('statusToast'); if (t) { t.textContent = msg; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 3000); } }
function show(msg) { const e = $('error'); if (e) e.textContent = msg; }
function log(m) { console.log('[M]', m); }

function startMedia() {
  return navigator.mediaDevices.getUserMedia(MEDIA).catch(() => {
    return navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  });
}

function stopMedia() {
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
}

function connectAndDo(action) {
  if (connecting) { log('Already connecting'); return; }
  if (socket && socket.connected) { action(); return; }
  connecting = true;
  if (socket) { socket.disconnect(); socket = null; }
  toast('Подключаюсь к серверу...');
  socket = io(CLOUD, { transports: ['websocket', 'polling'], timeout: 15000, reconnection: true, reconnectionAttempts: 3 });
  socket.on('connect', () => {
    connecting = false;
    log('Connected, id=' + socket.id);
    toast('Подключено, вхожу в комнату...');
    action();
  });
  socket.on('connect_error', (err) => {
    log('connect_error: ' + err.message);
    toast('Ошибка: ' + err.message);
    connecting = false;
  });
  socket.on('disconnect', (reason) => {
    log('disconnect: ' + reason);
    if (reason !== 'io client disconnect') toast('Потеря связи с сервером');
  });
  socket.on('error-msg', (msg) => { toast(msg); show(msg); });
  socket.on('room-created', (id) => {
    roomId = id;
    showRoom();
    startMedia().then(s => { localStream = s; $('localVideo').srcObject = s; }).catch(() => toast('Камера не доступна'));
  });
  socket.on('joined', async () => {
    showRoom();
    try {
      localStream = await startMedia();
      $('localVideo').srcObject = localStream;
      pendingOffers.forEach(o => handleOffer(o)); pendingOffers = [];
      pendingPeers.forEach(p => { createPC(p); socket.emit('signal', { to: p, signalType: 'request-offer' }); }); pendingPeers = [];
    } catch(e) { toast('Камера не доступна'); }
  });
  socket.on('room-users', (users) => { users.forEach(pid => { if (localStream) { createPC(pid); socket.emit('signal', { to: pid, signalType: 'request-offer' }); } else pendingPeers.push(pid); }); });
  socket.on('peer-joined', (peerId) => { if (localStream) createOfferToPeer(peerId); else pendingPeers.push(peerId); });
  socket.on('offer', (data) => {
    if (data.type === 'screen') { handleScreenOffer(data); return; }
    if (localStream) handleOffer(data); else pendingOffers.push(data);
  });
  socket.on('answer', (data) => {
    if (data.type === 'screen') {
      const pc = peers[data.from]?.screenPC;
      if (pc) pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).catch(e => log('screen ans err: ' + e.message));
      return;
    }
    const pc = peers[data.from]?.pc;
    if (pc) pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).catch(e => log('answer sd err: ' + e.message));
  });
  socket.on('ice-candidate', (data) => {
    const pc = data.type === 'screen' ? peers[data.from]?.screenPC : peers[data.from]?.pc;
    if (pc && data.candidate) pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => log('ice err: ' + e.message));
  });
  socket.on('peer-disconnected', removePeer);
  socket.on('signal', (d) => {
    if (d.type === 'screen-started') {
      sharerId = d.from;
      $('screenContainer').style.display = 'block';
      $('faces').classList.add('screen-mode');
      $('peerList').insertBefore($('localVideo'), $('peerList').firstChild);
      camsVisible = true;
      $('toggleCamsBtn').classList.remove('off');
      $('toggleCamsBtn').classList.remove('screen-only');
      toast('Кто-то делится экраном');
    }
    if (d.type === 'request-offer') { if (localStream) createOfferToPeer(d.from); }
    if (d.type === 'screen-stopped') {
      sharerId = null;
      $('screenContainer').style.display = 'none';
      if ($('screenVideo')) $('screenVideo').srcObject = null;
      $('faces').classList.remove('screen-mode');
      $('faces').insertBefore($('localVideo'), $('screenContainer'));
      $('room').classList.remove('fullscreen');
      $('controls').classList.remove('overlay');
      $('toggleCamsBtn').classList.add('screen-only');
      $('peerList').style.display = '';
      $('localVideo').style.display = '';
      for (const pid of Object.keys(peers)) {
        if (peers[pid].screenPC) { peers[pid].screenPC.close(); delete peers[pid].screenPC; }
      }
      toast('Трансляция завершена');
    }
  });
}

function showRoom() {
  $('landing').style.display = 'none';
  $('room').style.display = 'flex';
  $('roomCode').textContent = 'Палата № ' + roomId;
  updatePeerCount();
  $('camBtn').classList.add('on');
  $('micBtn').classList.add('on');
  $('camBtn').classList.remove('off');
  $('micBtn').classList.remove('off');
}
function updatePeerCount() {
  const count = Object.keys(peers).length + 1;
  const el = $('roomPeers');
  if (el) el.textContent = count + ' хомяк' + (count % 10 === 1 && count % 100 !== 11 ? '' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20) ? 'а' : 'ов');
}

function leaveRoom() {
  stopMedia();
  for (const pid of Object.keys(peers)) {
    if (peers[pid].pc) peers[pid].pc.close();
    if (peers[pid].screenPC) peers[pid].screenPC.close();
  }
  peers = {}; pendingOffers = []; pendingPeers = [];
  if (socket) { socket.disconnect(); socket = null; }
  connecting = false;
  sharerId = null;
  $('room').style.display = 'none';
  $('landing').style.display = 'flex';
  $('roomCodeInput').value = '';
  $('peerList').innerHTML = '';
  $('peerList').style.display = '';
  $('localVideo').style.display = '';
  $('screenContainer').style.display = 'none';
  $('faces').classList.remove('screen-mode');
  if ($('localVideo').parentNode === $('peerList')) $('faces').insertBefore($('localVideo'), $('screenContainer'));
  $('room').classList.remove('fullscreen');
  $('controls').classList.remove('overlay');
  $('toggleCamsBtn').classList.add('screen-only');
  if ($('screenVideo')) $('screenVideo').srcObject = null;
}

function createPC(peerId) {
  if (peers[peerId]) return peers[peerId].pc;
  const pc = new RTCPeerConnection(RTC);
  peers[peerId] = { pc };
  updatePeerCount();
  if (localStream) localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  pc.onicecandidate = (e) => { if (e.candidate) socket.emit('ice-candidate', { to: peerId, candidate: e.candidate }); };
  pc.ontrack = (e) => {
    let v = document.getElementById('v_' + peerId);
    if (!v) {
      const w = document.createElement('div');
      w.className = 'remote-peer';
      w.innerHTML = '<video id="v_' + peerId + '" autoplay playsinline></video>';
      $('peerList').appendChild(w);
      v = w.querySelector('video');
    }
    if (e.streams[0] && v.srcObject !== e.streams[0]) v.srcObject = e.streams[0];
  };
  pc.onconnectionstatechange = () => {
    log('pc ' + peerId + ': ' + pc.connectionState);
    if (pc.connectionState === 'connected') toast('Хомячок подключился');
    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') removePeer(peerId);
  };
  return pc;
}

function createScreenPC(peerId) {
  if (peers[peerId] && peers[peerId].screenPC) return peers[peerId].screenPC;
  const pc = new RTCPeerConnection(RTC);
  if (!peers[peerId]) peers[peerId] = {};
  peers[peerId].screenPC = pc;
  pc.onicecandidate = (e) => { if (e.candidate) socket.emit('ice-candidate', { to: peerId, candidate: e.candidate, type: 'screen' }); };
  pc.ontrack = (e) => {
    const sv = $('screenVideo');
    if (sv && e.streams[0]) sv.srcObject = e.streams[0];
    $('screenContainer').style.display = 'block';
  };
  pc.onconnectionstatechange = () => { log('screenPC ' + peerId + ': ' + pc.connectionState); };
  return pc;
}

function createOfferToPeer(peerId) {
  const pc = createPC(peerId);
  pc.createOffer().then(o => { pc.setLocalDescription(o); socket.emit('offer', { to: peerId, sdp: o, type: 'video' }); }).catch(e => log('offer err: ' + e.message));
}

function handleOffer(data) {
  const p = createPC(data.from);
  p.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => p.createAnswer())
    .then(a => { p.setLocalDescription(a); socket.emit('answer', { to: data.from, sdp: a, type: 'camera' }); })
    .catch(e => log('answer err: ' + e.message));
}

function handleScreenOffer(data) {
  const pc = createScreenPC(data.from);
  pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => pc.createAnswer())
    .then(a => { pc.setLocalDescription(a); socket.emit('answer', { to: data.from, sdp: a, type: 'screen' }); })
    .catch(e => log('screen ans err: ' + e.message));
}

function removePeer(peerId) {
  const p = peers[peerId];
  if (p) {
    if (p.pc) p.pc.close();
    if (p.screenPC) p.screenPC.close();
    delete peers[peerId];
    updatePeerCount();
  }
  const el = document.getElementById('v_' + peerId);
  if (el) { const w = el.closest('.remote-peer'); if (w) w.remove(); }
}

$('createRoomBtn').onclick = () => { show(''); connectAndDo(() => socket.emit('create-room')); };
$('roomCodeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('joinRoomBtn').click(); });
$('joinRoomBtn').onclick = () => {
  show('');
  const code = $('roomCodeInput').value.trim();
  if (!code) { show('Введите код комнаты'); return; }
  roomId = code;
  connectAndDo(() => socket.emit('join-room', code));
};
$('leaveBtn').onclick = leaveRoom;
$('camBtn').onclick = () => {
  camOn = !camOn;
  if (localStream) localStream.getVideoTracks().forEach(t => t.enabled = camOn);
  $('camBtn').classList.toggle('on', camOn);
  $('camBtn').classList.toggle('off', !camOn);
};
const MIC_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
const PTT_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01"/><line x1="6" y1="16" x2="18" y2="16"/><path d="M6 6V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/></svg>';
let pttMode = false, lastTap = 0, tapTimer = null, savedMic = true, pttTouchStart = 0;
$('micBtn').addEventListener('pointerup', (e) => {
  if (e.pointerType === 'touch' && pttMode) {
    if (Date.now() - pttTouchStart < 250) {
      pttMode = false; pttTouchStart = 0;
      $('micBtn').classList.remove('ptt-mode', 'ptt-active');
      $('micBtn').innerHTML = MIC_ICON;
      micOn = savedMic;
      if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = micOn);
      $('micBtn').classList.toggle('on', micOn);
      $('micBtn').classList.toggle('off', !micOn);
    }
    return;
  }
  const now = Date.now();
  if (now - lastTap < 350) {
    lastTap = 0; clearTimeout(tapTimer);
    pttMode = !pttMode;
    $('micBtn').classList.toggle('ptt-mode', pttMode);
    if (pttMode) {
      $('micBtn').innerHTML = PTT_ICON;
      savedMic = micOn; micOn = false;
      if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = false);
      $('micBtn').classList.add('off'); $('micBtn').classList.remove('on');
    } else {
      $('micBtn').innerHTML = MIC_ICON;
      micOn = savedMic;
      if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = micOn);
      $('micBtn').classList.toggle('on', micOn);
      $('micBtn').classList.toggle('off', !micOn);
    }
    return;
  }
  lastTap = now; clearTimeout(tapTimer);
  tapTimer = setTimeout(() => {
    if (pttMode) { lastTap = 0; return; }
    micOn = !micOn;
    if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = micOn);
    $('micBtn').classList.toggle('on', micOn);
    $('micBtn').classList.toggle('off', !micOn);
    lastTap = 0;
  }, 350);
});
$('micBtn').addEventListener('pointerdown', (e) => {
  if (!pttMode || e.pointerType !== 'touch') return;
  pttTouchStart = Date.now();
  if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = true);
  $('micBtn').classList.remove('off'); $('micBtn').classList.add('ptt-active');
});
$('micBtn').addEventListener('pointercancel', () => {
  if (!pttMode) return;
  if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = false);
  $('micBtn').classList.add('off'); $('micBtn').classList.remove('ptt-active');
});
$('toggleCamsBtn').onclick = () => {
  camsVisible = !camsVisible;
  $('peerList').style.display = camsVisible ? '' : 'none';
  $('localVideo').style.display = camsVisible ? '' : 'none';
  $('toggleCamsBtn').classList.toggle('off', !camsVisible);
};
$('fullscreenBtn').onclick = () => {
  const fs = $('room').classList.toggle('fullscreen');
  $('controls').classList.toggle('overlay', fs);
  if (fs) {
    try { document.documentElement.requestFullscreen(); } catch(e) {}
  } else {
    try { document.exitFullscreen(); } catch(e) {}
  }
};
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    $('room').classList.remove('fullscreen');
    $('controls').classList.remove('overlay');
    $('controls').classList.remove('auto-hide');
  }
});
let hideTimer;
function showControls() {
  $('controls').classList.remove('auto-hide');
  clearTimeout(hideTimer);
  if ($('room').classList.contains('fullscreen')) {
    hideTimer = setTimeout(() => $('controls').classList.add('auto-hide'), 3000);
  }
}
$('faces').addEventListener('touchstart', showControls);
$('screenContainer').addEventListener('touchstart', showControls);
$('controls').addEventListener('touchstart', (e) => { e.stopPropagation(); showControls(); });

(function() {
  try {
    const p = new URLSearchParams(location.search);
    const c = p.get('code');
    if (c) {
      $('roomCodeInput').value = c;
      roomId = c;
      show('Подключаюсь...');
      connectAndDo(() => socket.emit('join-room', c));
    }
  } catch(e) { console.error(e); }
})();
