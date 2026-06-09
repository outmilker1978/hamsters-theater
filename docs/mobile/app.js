const CLOUD = 'https://tv-hamsters-bot.onrender.com';
const RTC = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const MEDIA = { video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } }, audio: { echoCancellation: true, noiseSuppression: true } };

let socket, localStream, roomId, isHost = false;
let peers = {}, pendingOffers = [], pendingPeers = [];
let micOn = true, camOn = true;

const $ = id => document.getElementById(id);

function show(msg) { const e = $('error'); if (e) e.textContent = msg; }

function startMedia() {
  return navigator.mediaDevices.getUserMedia(MEDIA).catch(() => {
    return navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  });
}

function connectOnce(sock, ev, fn) {
  if (sock.connected) { fn(); return; }
  sock.once(ev, fn);
}

function connect(roomCb) {
  if (socket) socket.disconnect();
  socket = io(CLOUD, { transports: ['websocket', 'polling'], timeout: 10000 });
  socket.on('connect', () => { console.log('Connected'); if (roomCb) roomCb(); });
  socket.on('disconnect', () => { show('Потеря связи с сервером'); setTimeout(() => { if (!socket || !socket.connected) connect(roomCb); }, 3000); });
  socket.on('error-msg', show);
  socket.on('room-created', onRoomCreated);
  socket.on('joined', onJoined);
  socket.on('peer-joined', (peerId) => { if (localStream) createOfferToPeer(peerId); else pendingPeers.push(peerId); });
  socket.on('offer', (data) => { if (localStream) handleOffer(data); else pendingOffers.push(data); });
  socket.on('answer', (data) => { const pc = peers[data.from]?.pc; if (pc) pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).catch(() => {}); });
  socket.on('ice-candidate', (data) => { const pc = peers[data.from]?.pc; if (pc && data.candidate) pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {}); });
  socket.on('peer-disconnected', removePeer);
}

function createRoom() {
  isHost = true;
  connect(() => socket.emit('create-room'));
}

function joinRoom(code) {
  isHost = false;
  roomId = code;
  connect(() => socket.emit('join-room', code));
}

function onRoomCreated(id) {
  roomId = id;
  showRoom();
  startMedia().then(s => { localStream = s; $('localVideo').srcObject = s; }).catch(() => show('Нет доступа к камере'));
}

async function onJoined() {
  showRoom();
  try {
    localStream = await startMedia();
    $('localVideo').srcObject = localStream;
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
  for (const pid of Object.keys(peers)) { if (peers[pid].pc) peers[pid].pc.close(); }
  peers = {}; pendingOffers = []; pendingPeers = [];
  if (socket) { socket.disconnect(); socket = null; }
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
    if (e.streams[0]) v.srcObject = e.streams[0];
  };
  pc.onconnectionstatechange = () => { if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') removePeer(peerId); };
  return pc;
}

function createOfferToPeer(peerId) {
  const pc = createPC(peerId);
  pc.createOffer().then(o => { pc.setLocalDescription(o); socket.emit('offer', { to: peerId, sdp: o }); }).catch(() => {});
}

function handleOffer(data) {
  const pc = createPC(data.from);
  pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
  pc.createAnswer().then(a => { pc.setLocalDescription(a); socket.emit('answer', { to: data.from, sdp: a }); }).catch(() => {});
}

function removePeer(peerId) {
  if (peers[peerId]) { if (peers[peerId].pc) peers[peerId].pc.close(); delete peers[peerId]; }
  const el = document.getElementById('v_' + peerId);
  if (el) { const w = el.closest('.remote-peer'); if (w) w.remove(); }
}

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
(function() {
  try {
    const p = new URLSearchParams(location.search);
    const c = p.get('code');
    if (c) {
      $('roomCodeInput').value = c;
      show('Подключаюсь...');
      setTimeout(() => joinRoom(c), 300);
    }
  } catch(e) { console.error(e); }
})();
