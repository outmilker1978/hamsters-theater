const CLOUD = 'https://tv-hamsters-bot.onrender.com';
const TURN_CRED = { username: 'openrelayproject', credential: 'openrelayproject' };
const RTC = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'turn:relay.metered.ca:80', ...TURN_CRED },
    { urls: 'turn:relay.metered.ca:443', ...TURN_CRED },
    { urls: 'turn:relay.metered.ca:443?transport=tcp', ...TURN_CRED },
  ]
};
const MEDIA = { video: { facingMode: 'user', width: { ideal: 240 }, height: { ideal: 180 }, frameRate: { ideal: 15, max: 20 } }, audio: { echoCancellation: true, noiseSuppression: true } };

let socket, localStream, roomId, isHost = false;
let peers = {}, pendingOffers = [], pendingPeers = [];
let micOn = true, camOn = true;
let connecting = false;
let sharerId = null;
let camsVisible = true;
let myAction = null; // { type: 'create'|'join', code: roomId }
let wasInRoom = false;
let roomPeers = [];

const $ = id => document.getElementById(id);
let userName = localStorage.getItem('mobileUserName') || '';
const FUNNY_NAMES = [
  '\u043F\u0443\u0445\u043B\u044F\u043A', '\u043D\u0430 \u0441\u043F\u043E\u0440\u0442\u0435', '\u0436\u0443\u043B\u044C\u0431\u0430\u043D', '\u0448\u0438\u0432\u043E\u0440\u043E\u0442', '\u043A\u043E\u043B\u0431\u0430\u0441\u043A\u0430', '\u043F\u044B\u0445\u0442\u0435\u043B\u043A\u0438\u043D',
  '\u0449\u0438\u043F\u0430\u0447', '\u043B\u0430\u043F\u0448\u0430', '\u0448\u043C\u0435\u043B\u044C', '\u0431\u0443\u043B\u044C\u043A\u0430', '\u0441\u044B\u0440\u043D\u0438\u043A', '\u0445\u0440\u044F\u043A',
  '\u043F\u0443\u0448\u0438\u0441\u0442\u0430\u044F \u0436\u043E\u043F\u043A\u0430', '\u043D\u0430 \u043B\u0438\u043D\u044C\u043A\u0435', '\u043D\u0430 \u0437\u0430\u0436\u0438\u0440\u043E\u0432\u043A\u0435', '\u0447\u0443\u0431\u0438\u043A', '\u0445\u0432\u043E\u0441\u0442\u0438\u043A', '\u0448\u0430\u0440\u0438\u043A', '\u043A\u043E\u043C\u043E\u0447\u0435\u043A',
  '\u044C\u044E-\u0445\u044E', '\u0445\u0440\u044E\u043C', '\u043F\u0438\u0449\u0430\u043B\u043A\u0430', '\u0445\u0440\u044E\u0447\u0438\u043A'
];
function getRandomName() { return '\u0425\u043E\u043C\u044F\u043A ' + FUNNY_NAMES[Math.floor(Math.random() * FUNNY_NAMES.length)]; }
function ensureUserName() {
  const saved = localStorage.getItem('mobileUserName');
  if (saved && saved.trim()) { userName = saved.trim(); return true; }
  return false;
}

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
  toast('\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u044E\u0441\u044C \u043A \u0441\u0435\u0440\u0432\u0435\u0440\u0443...');
  socket = io(CLOUD, { transports: ['websocket', 'polling'], timeout: 15000, reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 2000 });
  socket.on('connect', () => {
    connecting = false;
    log('Connected, id=' + socket.id);
    if (wasInRoom && myAction) {
      log('Reconnecting to room ' + myAction.code);
      toast('\u041F\u0435\u0440\u0435\u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u044E\u0441\u044C...');
      if (myAction.type === 'create') socket.emit('create-room');
      else socket.emit('join-room', myAction.code);
      return;
    }
    action();
  });
  socket.on('disconnect', () => {
    log('Disconnected from server');
    wasInRoom = true;
  });
  socket.on('connect_error', (err) => {
    log('Connection error: ' + err.message);
    connecting = false;
    show('\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F: ' + err.message);
  });
  socket.on('error-msg', (msg) => { show(msg); });
  socket.on('server-log', (msg) => { log('[Server] ' + msg); });
  socket.on('room-created', (code) => {
    roomId = code; isHost = true;
    myAction = { type: 'create', code };
    $('roomCode').textContent = code;
    $('page-join').style.display = 'none';
    $('page-room').style.display = 'flex';
    toast('\u041A\u043E\u043C\u043D\u0430\u0442\u0430 \u0441\u043E\u0437\u0434\u0430\u043D\u0430! \u041A\u043E\u0434: ' + code);
  });
  socket.on('joined', (code) => {
    log('Joined room ' + code);
    roomId = code; isHost = false;
    myAction = { type: 'join', code };
    $('roomCode').textContent = code;
    $('page-join').style.display = 'none';
    $('page-room').style.display = 'flex';
    toast('\u0412\u044B \u0432 \u043A\u043E\u043C\u043D\u0430\u0442\u0435!');
  });
  socket.on('room-users', (users) => { roomPeers = users; users.forEach(pid => { createPC(pid); socket.emit('signal', { to: pid, signalType: 'request-offer' }); if (userName) socket.emit('signal', { to: pid, signalType: 'user-info', name: userName }); }); });
  socket.on('peer-joined', (peerId) => {
    createOfferToPeer(peerId);
    if (userName) socket.emit('signal', { to: peerId, signalType: 'user-info', name: userName });
  });
  socket.on('user-joined', (peerId) => { });
  socket.on('peer-left', (peerId) => { removePeer(peerId); });
  socket.on('offer', (data) => {
    if (data.type === 'screen') { handleScreenOffer(data); return; }
    handleOffer(data);
  });
  socket.on('answer', (data) => {
    const p = peers[data.from];
    if (!p || !p.pc) return;
    if (data.type === 'screen') {
      const sc = p.screenPC;
      if (sc) sc.setRemoteDescription(new RTCSessionDescription(data.sdp)).catch(e => log('screen ans err: ' + e.message));
      return;
    }
    p.pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).catch(e => log('ans setRD err: ' + e.message));
    log('Answer from ' + data.from);
  });
  socket.on('ice-candidate', (data) => {
    const p = peers[data.from];
    if (!p) return;
    let targetPC = p.pc;
    if (data.type === 'screen') targetPC = p.screenPC;
    if (data.type === 'screen') { if (targetPC && targetPC.remoteDescription) targetPC.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {}); return; }
    if (!targetPC) return;
    if (!targetPC.remoteDescription) {
      (p.cameraCandidates = p.cameraCandidates || []).push(data.candidate);
      return;
    }
    targetPC.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
  });
  socket.on('signal', (data) => {
    if (data.type === 'screen-started') {
      if (data.from) sharerId = data.from;
      $('toggleCamsBtn').classList.remove('screen-only');
      toast('\u041A\u0442\u043E-\u0442\u043E \u0434\u0435\u043B\u0438\u0442\u0441\u044F \u044D\u043A\u0440\u0430\u043D\u043E\u043C');
    }
    if (data.type === 'request-offer') { if (localStream) createOfferToPeer(data.from); }
    if (data.type === 'screen-stopped') {
      sharerId = null;
      $('screenContainer').style.display = 'none';
      if ($('screenVideo')) $('screenVideo').srcObject = null;
      $('faces').classList.remove('screen-mode');
    }
    if (data.type === 'user-info') {
      if (data.name) {
        peerNames[data.from] = data.name;
        const lbl = document.getElementById('lbl_' + data.from);
        if (lbl) lbl.textContent = data.name;
      }
    }
    if (data.type === 'voice-toggle') {
      const p = peers[data.from];
      if (p && p.audioBtn) {
        p.audioOn = !p.audioOn;
        p.audioBtn.classList.toggle('muted', !p.audioOn);
      }
    }
    if (data.type === 'cams') {
      const p = peers[data.from];
      if (p && p.videoBtn) p.videoBtn.classList.toggle('off', !data.show);
    }
  });
}

function handleUserInfo(data) {
  if (data.name) {
    peerNames[data.from] = data.name;
    const lbl = document.getElementById('lbl_' + data.from);
    if (lbl) lbl.textContent = data.name;
  }
}

function createOfferToPeer(peerId) {
  const pc = createPC(peerId);
  pc.createOffer().then(o => { pc.setLocalDescription(o); socket.emit('offer', { to: peerId, sdp: o, type: 'camera', name: userName || '' }); }).catch(e => log('offer err: ' + e.message));
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

function createPC(peerId) {
  if (peers[peerId]) return peers[peerId].pc;
  const pc = new RTCPeerConnection(RTC);
  peers[peerId] = { pc };
  updatePeerCount();
  if (localStream) {
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  } else {
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });
  }
  pc.onicecandidate = (e) => { if (e.candidate) socket.emit('ice-candidate', { to: peerId, candidate: e.candidate }); };
  pc.ontrack = (e) => {
    log('ontrack ' + peerId + ' kind=' + e.track.kind);
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
  pc.oniceconnectionstatechange = () => {
    log('iceState ' + peerId + ': ' + pc.iceConnectionState);
    if (pc.iceConnectionState === 'failed') {
      log('ICE restarting for ' + peerId);
      pc.restartIce();
    }
  };
  pc.onconnectionstatechange = () => {
    log('connState ' + peerId + ': ' + pc.connectionState);
    if (pc.connectionState === 'connected') toast('\u0425\u043E\u043C\u044F\u0447\u043E\u043A \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u043B\u0441\u044F');
    if (pc.connectionState === 'failed') {
      log('conn failed for ' + peerId + ', recreating...');
      removePeer(peerId);
      setTimeout(() => { if (myAction) socket.emit('signal', { to: peerId, signalType: 'request-offer' }); }, 2000);
    }
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

function updatePeerCount() {
  const count = Object.keys(peers).length;
  const e = $('peerCount');
  if (e) e.textContent = count + ' \u0445\u043E\u043C\u044F\u043A\u0430';
}

function toggleCam() {
  camOn = !camOn;
  if (localStream) localStream.getVideoTracks().forEach(t => { t.enabled = camOn; });
  const btn = $('toggleCamBtn');
  if (btn) btn.classList.toggle('off', !camOn);
  socket.emit('signal', { to: roomId, signalType: 'cams', show: camOn });
}

function toggleMic() {
  micOn = !micOn;
  if (localStream) localStream.getAudioTracks().forEach(t => { t.enabled = micOn; });
  const btn = $('toggleMicBtn');
  if (btn) btn.classList.toggle('off', !micOn);
  socket.emit('signal', { to: roomId, signalType: 'voice-toggle' });
}

function startPeerList() {
  for (const pid of Object.keys(peers)) {
    const w = document.getElementById('v_' + pid);
    if (w) continue;
    const div = document.createElement('div');
    div.className = 'remote-peer';
    div.innerHTML = '<video id="v_' + pid + '" autoplay playsinline></video><div class="peer-controls"><button class="audio-btn" data-peer="' + pid + '">\u0417\u0432\u0443\u043A</button><button class="video-btn" data-peer="' + pid + '">\u041A\u0430\u043C\u0435\u0440\u0430</button></div>';
    $('peerList').appendChild(div);
  }
}

function leaveRoom() {
  if (socket) { socket.disconnect(); socket = null; }
  wasInRoom = false; myAction = null;
  for (const pid of Object.keys(peers)) removePeer(pid);
  peers = {};
  stopMedia();
  $('page-room').style.display = 'none';
  $('page-main').style.display = 'flex';
  $('roomCode').textContent = '';
  $('peerList').innerHTML = '';
  $('screenContainer').style.display = 'none';
  if ($('screenVideo')) $('screenVideo').srcObject = null;
  sharerId = null;
  roomPeers = [];
}

function toggleCams() {
  camsVisible = !camsVisible;
  for (const pid of Object.keys(peers)) {
    const el = document.getElementById('v_' + pid);
    if (el) el.style.display = camsVisible ? 'block' : 'none';
  }
  $('toggleCamsBtn').classList.toggle('off', !camsVisible);
}

// --- UI ---
$('createRoomBtn').onclick = () => {
  if (!ensureUserName()) { $('nameModal').style.display = 'flex'; return; }
  connectAndDo(() => socket.emit('create-room'));
};
$('joinRoomBtn').onclick = () => $('page-join').style.display = 'flex';
$('joinConfirmBtn').onclick = () => {
  const code = $('roomInput').value.trim();
  if (!code) return;
  if (!ensureUserName()) { $('nameModal').style.display = 'flex'; return; }
  connectAndDo(() => socket.emit('join-room', code));
};
$('leaveRoomBtn').onclick = leaveRoom;
$('toggleCamBtn').onclick = toggleCam;
$('toggleMicBtn').onclick = toggleMic;
$('toggleCamsBtn').onclick = toggleCams;

$('nameConfirm').onclick = () => {
  const name = $('nameInput').value.trim();
  if (!name) return;
  userName = name;
  localStorage.setItem('mobileUserName', name);
  $('nameModal').style.display = 'none';
  const action = $('nameModal').getAttribute('data-pending-action');
  if (action === 'create') $('createRoomBtn').onclick();
  else if (action === 'join') $('joinRoomBtn').onclick();
  $('nameModal').removeAttribute('data-pending-action');
};
$('nameCancel').onclick = () => { $('nameModal').style.display = 'none'; };
$('nameModal').onclick = (e) => { if (e.target === $('nameModal')) $('nameModal').style.display = 'none'; };
$('nameInput').oninput = () => { $('nameConfirm').disabled = !$('nameInput').value.trim(); };
$('page-main').style.display = 'flex';
