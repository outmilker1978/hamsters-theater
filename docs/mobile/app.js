const CLOUD = 'https://tv-hamsters-bot.onrender.com';
const RTC = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const MEDIA = { video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } }, audio: { echoCancellation: true, noiseSuppression: true } };

let socket, localStream, roomId, myId, isHost = false;
let peers = {}, pendingOffers = [], pendingPeers = [];
let micOn = true, camOn = true;
let reconnectTimer = null;

const $ = id => document.getElementById(id);

function show(msg) { $('error').textContent = msg; }
function log(m) { console.log('[M]', m); }

function startMedia() {
  return navigator.mediaDevices.getUserMedia(MEDIA).catch(() => {
    return navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  });
}

function connect() {
  socket = io(CLOUD);
  socket.on('connect', () => log('Connected'));
  socket.on('disconnect', () => {
    show('Потеря связи с сервером');
    if (!reconnectTimer) reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, 3000);
  });
  socket.on('error-msg', show);
  socket.on('room-created', onRoomCreated);
  socket.on('joined', onJoined);
  socket.on('peer-joined', onPeerJoined);
  socket.on('offer', onOffer);
  socket.on('answer', onAnswer);
  socket.on('ice-candidate', onIce);
  socket.on('peer-disconnected', removePeer);
  socket.on('signal', (d) => { if (d.type === 'screen-started') { $('screenshareBadge').style.display = 'block'; } if (d.type === 'screen-stopped') { $('screenshareBadge').style.display = 'none'; } });
}

function createRoom() {
  isHost = true;
  connect();
  connectOnce(socket, 'connect', () => { log('Creating room'); socket.emit('create-room'); });
}

function joinRoom(code) {
  isHost = false;
  roomId = code;
  connect();
  connectOnce(socket, 'connect', () => { log('Joining room'); socket.emit('join-room', code); });
}

function connectOnce(sock, ev, fn) {
  if (sock.connected) { fn(); return; }
  sock.once(ev, fn);
}

function onRoomCreated(id) {
  roomId = id;
  myId = socket.id;
  showRoom();
  startMedia().then(s => { localStream = s; $('localVideo').srcObject = s; }).catch(() => show('Нет доступа к камере'));
}

async function onJoined() {
  myId = socket.id;
  showRoom();
  try {
    localStream = await startMedia();
    $('localVideo').srcObject = localStream;
    const list = document.getElementById('peerList');
    list.innerHTML = '';
    pendingOffers.forEach(o => handleOffer(o)); pendingOffers = [];
    pendingPeers.forEach(p => createPC(p)); pendingPeers = [];
  } catch(e) { show('Нет доступа к камере'); }
}

function showRoom() {
  $('landing').style.display = 'none';
  $('room').style.display = 'flex';
  $('roomCode').textContent = 'Палата № ' + roomId;
}

function leaveRoom() {
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  for (const pid of Object.keys(peers)) { if (peers[pid].pc) peers[pid].pc.close(); if (peers[pid].pc) peers[pid].pc.close(); }
  peers = {}; pendingOffers = []; pendingPeers = [];
  if (socket) { socket.disconnect(); socket = null; }
  $('room').style.display = 'none';
  $('landing').style.display = 'flex';
  $('roomCodeInput').value = '';
  $('peerList').innerHTML = '';
  $('screenshareBadge').style.display = 'none';
}

function createPC(peerId) {
  if (peers[peerId]) return peers[peerId].pc;
  const pc = new RTCPeerConnection(RTC);
  const p = { pc };
  peers[peerId] = p;
  if (localStream) localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  pc.onicecandidate = (e) => { if (e.candidate) socket.emit('ice-candidate', { to: peerId, candidate: e.candidate }); };
  pc.ontrack = (e) => {
    let video = document.getElementById('video_' + peerId);
    if (!video) {
      const wrapper = document.createElement('div');
      wrapper.className = 'remote-peer';
      wrapper.innerHTML = '<div class="peer-label">Хомячок</div><video id="video_' + peerId + '" autoplay playsinline></video>';
      document.getElementById('peerList').appendChild(wrapper);
      video = wrapper.querySelector('video');
    }
    if (e.streams[0]) video.srcObject = e.streams[0];
  };
  pc.onconnectionstatechange = () => { if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') removePeer(peerId); };
  return pc;
}

function createOfferToPeer(peerId) {
  const pc = createPC(peerId);
  pc.createOffer().then(o => { pc.setLocalDescription(o); socket.emit('offer', { to: peerId, sdp: o, type: 'video' }); }).catch(log);
}

function onPeerJoined(peerId) {
  if (localStream) createOfferToPeer(peerId);
  else pendingPeers.push(peerId);
}

function onOffer(data) {
  if (!localStream) { pendingOffers.push(data); return; }
  handleOffer(data);
}

function handleOffer(data) {
  const pc = createPC(data.from);
  pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
  pc.createAnswer().then(a => { pc.setLocalDescription(a); socket.emit('answer', { to: data.from, sdp: a }); }).catch(log);
}

function onAnswer(data) {
  const pc = peers[data.from]?.pc;
  if (pc) pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).catch(log);
}

function onIce(data) {
  const pc = peers[data.from]?.pc;
  if (pc && data.candidate) pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(log);
}

function removePeer(peerId) {
  if (peers[peerId]) {
    if (peers[peerId].pc) peers[peerId].pc.close();
    delete peers[peerId];
  }
  const el = document.getElementById('video_' + peerId);
  if (el) { const w = el.closest('.remote-peer'); if (w) w.remove(); }
}

// UI Events
$('createRoomBtn').onclick = () => { show(''); createRoom(); };
$('joinRoomBtn').onclick = () => {
  show('');
  const code = $('roomCodeInput').value.trim();
  if (!code) { show('Введите код комнаты'); return; }
  joinRoom(code);
};
$('leaveBtn').onclick = leaveRoom;

$('camBtn').onclick = () => {
  camOn = !camOn;
  if (localStream) localStream.getVideoTracks().forEach(t => t.enabled = camOn);
  $('camBtn').textContent = camOn ? '📷' : '📷🚫';
};
$('micBtn').onclick = () => {
  micOn = !micOn;
  if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = micOn);
  $('micBtn').textContent = micOn ? '🎤' : '🎤🚫';
};

// Auto-join from URL
(() => {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  if (code) { $('roomCodeInput').value = code; joinRoom(code); }
})();
