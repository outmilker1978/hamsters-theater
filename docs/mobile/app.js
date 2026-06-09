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
const MEDIA = { video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } }, audio: { echoCancellation: true, noiseSuppression: true } };

let socket, localStream, roomId, isHost = false;
let peers = {}, pendingOffers = [], pendingPeers = [];
let micOn = true, camOn = true;
let connecting = false;

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
      pendingPeers.forEach(p => createPC(p)); pendingPeers = [];
    } catch(e) { toast('Камера не доступна'); }
  });
  socket.on('peer-joined', (peerId) => { if (localStream) createOfferToPeer(peerId); else pendingPeers.push(peerId); });
  socket.on('offer', (data) => { if (localStream) handleOffer(data); else pendingOffers.push(data); });
  socket.on('answer', (data) => { const pc = peers[data.from]?.pc; if (pc) pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).catch(e => log('answer sd err: ' + e.message)); });
  socket.on('ice-candidate', (data) => { const pc = peers[data.from]?.pc; if (pc && data.candidate) pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => log('ice err: ' + e.message)); });
  socket.on('peer-disconnected', removePeer);
  socket.on('signal', (d) => {
    if (d.type === 'screen-started') toast('Кто-то делится экраном');
    if (d.type === 'screen-stopped') toast('Трансляция завершена');
  });
}

function showRoom() {
  $('landing').style.display = 'none';
  $('room').style.display = 'flex';
  $('roomCode').textContent = 'Палата № ' + roomId;
}

function leaveRoom() {
  stopMedia();
  for (const pid of Object.keys(peers)) { if (peers[pid].pc) peers[pid].pc.close(); }
  peers = {}; pendingOffers = []; pendingPeers = [];
  if (socket) { socket.disconnect(); socket = null; }
  connecting = false;
  $('room').style.display = 'none';
  $('landing').style.display = 'flex';
  $('roomCodeInput').value = '';
  $('peerList').innerHTML = '';
}

function createPC(peerId) {
  if (peers[peerId]) return peers[peerId].pc;
  const pc = new RTCPeerConnection(RTC);
  peers[peerId] = { pc };
  if (localStream) localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  pc.onicecandidate = (e) => { if (e.candidate) socket.emit('ice-candidate', { to: peerId, candidate: e.candidate }); };
  pc.ontrack = (e) => {
    let v = document.getElementById('v_' + peerId);
    if (!v) {
      const w = document.createElement('div');
      w.className = 'remote-peer';
      w.innerHTML = '<div class="peer-label">Хомячок</div><video id="v_' + peerId + '" autoplay playsinline></video>';
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

function createOfferToPeer(peerId) {
  const pc = createPC(peerId);
  pc.createOffer().then(o => { pc.setLocalDescription(o); socket.emit('offer', { to: peerId, sdp: o, type: 'video' }); }).catch(e => log('offer err: ' + e.message));
}

function handleOffer(data) {
  const p = createPC(data.from);
  p.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => p.createAnswer())
    .then(a => { p.setLocalDescription(a); socket.emit('answer', { to: data.from, sdp: a }); })
    .catch(e => log('answer err: ' + e.message));
}

function removePeer(peerId) {
  if (peers[peerId]) { if (peers[peerId].pc) peers[peerId].pc.close(); delete peers[peerId]; }
  const el = document.getElementById('v_' + peerId);
  if (el) { const w = el.closest('.remote-peer'); if (w) w.remove(); }
}

$('createRoomBtn').onclick = () => { show(''); connectAndDo(() => socket.emit('create-room')); };
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
  $('camBtn').textContent = camOn ? '📷' : '📷';
  $('camBtn').classList.toggle('off', !camOn);
};
$('micBtn').onclick = () => {
  micOn = !micOn;
  if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = micOn);
  $('micBtn').textContent = micOn ? '🎤' : '🎤';
  $('micBtn').classList.toggle('off', !micOn);
};

// Auto-join from URL - fires immediately
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
