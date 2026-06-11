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
      wasInRoom = false;
    } else {
      toast('\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E, \u0432\u0445\u043E\u0436\u0443 \u0432 \u043A\u043E\u043C\u043D\u0430\u0442\u0443...');
      action();
    }
  });
  socket.on('connect_error', (err) => {
    log('connect_error: ' + err.message);
    toast('\u041E\u0448\u0438\u0431\u043A\u0430: ' + err.message);
    connecting = false;
  });
  socket.on('disconnect', (reason) => {
    log('disconnect: ' + reason);
    if (reason !== 'io client disconnect') {
      wasInRoom = true;
      toast('\u041F\u043E\u0442\u0435\u0440\u044F \u0441\u0432\u044F\u0437\u0438, \u043F\u0435\u0440\u0435\u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u044E\u0441\u044C...');
    }
  });
  socket.on('error-msg', (msg) => { toast(msg); show(msg); });
  socket.on('room-created', (id) => {
    roomId = id;
    if (!myAction) myAction = { type: 'create', code: id };
    sessionStorage.setItem('hamsters_room', JSON.stringify(myAction));
    showRoom();
    if (localStream) $('localVideo').srcObject = localStream;
  });
  socket.on('joined', () => {
    if (myAction) sessionStorage.setItem('hamsters_room', JSON.stringify(myAction));
    showRoom();
    if (localStream) $('localVideo').srcObject = localStream;
    pendingOffers.forEach(o => handleOffer(o)); pendingOffers = [];
    pendingPeers.forEach(p => { createPC(p); socket.emit('signal', { to: p, signalType: 'request-offer', name: userName }); socket.emit('signal', { to: p, signalType: 'user-info', name: userName }); }); pendingPeers = [];
  });
  socket.on('room-users', (users) => { users.forEach(pid => { createPC(pid); socket.emit('signal', { to: pid, signalType: 'request-offer' }); if (userName) socket.emit('signal', { to: pid, signalType: 'user-info', name: userName }); }); });
  socket.on('peer-joined', (peerId) => {
    createOfferToPeer(peerId);
    if (socket && socket.connected && userName) {
      socket.emit('signal', { to: peerId, signalType: 'user-info', name: userName });
    }
  });
  socket.on('offer', (data) => {
    if (data.type === 'screen') { handleScreenOffer(data); return; }
    handleOffer(data);
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
  socket.on('chat-message', (d) => {
    const el = document.createElement('div');
    el.className = 'chat-msg';
    el.innerHTML = '<span class="chat-msg-author">' + escapeHtml(d.name) + '</span><span class="chat-msg-text">' + escapeHtml(d.text) + '</span>';
    $('chatMessages').appendChild(el);
    $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
    if ($('chatOverlay').style.display !== 'flex' && d.from !== socket.id) toast('\u0427\u0430\u0442: ' + d.name + ' \u043D\u0430\u043F\u0438\u0441\u0430\u043B(\u0430)');
  });
  socket.on('reaction', (d) => {
    showReaction(d.emoji);
  });
  socket.on('user-info', (d) => {
    // mobile doesn't show peer labels, ignore
  });
  socket.on('signal', (d) => {
    if (d.type === 'user-info' && d.name) {
      // mobile doesn't show peer labels
    }
    if (d.type === 'screen-started') {
      sharerId = d.from;
      $('screenContainer').style.display = 'block';
      $('faces').classList.add('screen-mode');
      $('peerList').insertBefore($('localVideo'), $('peerList').firstChild);
      camsVisible = true;
      $('toggleCamsBtn').classList.remove('off');
      $('toggleCamsBtn').classList.remove('screen-only');
      toast('\u041A\u0442\u043E-\u0442\u043E \u0434\u0435\u043B\u0438\u0442\u0441\u044F \u044D\u043A\u0440\u0430\u043D\u043E\u043C');
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
      toast('\u0422\u0440\u0430\u043D\u0441\u043B\u044F\u0446\u0438\u044F \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430');
    }
  });
}

function showRoom() {
  $('landing').style.display = 'none';
  $('room').style.display = 'flex';
  $('roomCode').textContent = (userName || '\u0427\u0430\u0442') + ' \u2022 \u041F\u0430\u043B\u0430\u0442\u0430 \u2116 ' + roomId;
  updatePeerCount();
  $('camBtn').classList.add('on');
  $('micBtn').classList.add('on');
  $('camBtn').classList.remove('off');
  $('micBtn').classList.remove('off');
}
function updatePeerCount() {
  const count = Object.keys(peers).length + 1;
  const el = $('roomPeers');
  if (el) el.textContent = count + ' \u0445\u043E\u043C\u044F\u043A' + (count % 10 === 1 && count % 100 !== 11 ? '' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20) ? '\u0430' : '\u043E\u0432');
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
  myAction = null; wasInRoom = false;
  sessionStorage.removeItem('hamsters_room');
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
  $('chatOverlay').style.display = 'none';
  $('chatMessages').innerHTML = '';
  $('chatInput').value = '';
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

function requestMedia() {
  if (localStream) return Promise.resolve(localStream);
  return startMedia().then(s => { localStream = s; return s; }).catch(() => { toast('\u041D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u043A \u043A\u0430\u043C\u0435\u0440\u0435/\u043C\u0438\u043A\u0440\u043E\u0444\u043E\u043D\u0443'); return null; });
}
$('createRoomBtn').onclick = () => {
  show('');
  myAction = null; wasInRoom = false;
  requestMedia().then(() => {
    connectAndDo(() => { myAction = { type: 'create', code: null }; socket.emit('create-room'); });
  });
};
$('roomCodeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('joinRoomBtn').click(); });
$('joinRoomBtn').onclick = () => {
  show('');
  const code = $('roomCodeInput').value.trim();
  if (!code) { show('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043A\u043E\u0434 \u043A\u043E\u043C\u043D\u0430\u0442\u044B'); return; }
  roomId = code;
  myAction = null; wasInRoom = false;
  requestMedia().then(() => {
    connectAndDo(() => { myAction = { type: 'join', code: code }; socket.emit('join-room', code); });
  });
};
$('leaveBtn').onclick = leaveRoom;
$('camBtn').onclick = () => {
  camOn = !camOn;
  if (localStream) localStream.getVideoTracks().forEach(t => t.enabled = camOn);
  $('camBtn').classList.toggle('on', camOn);
  $('camBtn').classList.toggle('off', !camOn);
};
let pttMode = false, lastTap = 0, tapTimer = null, savedMic = true, lastPttTap = 0, pttTapTimer = null;
function enterPttMode() {
  pttMode = true;
  savedMic = micOn; micOn = false;
  if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = false);
  $('micBtn').classList.remove('on', 'off');
  $('micBtn').classList.add('ptt-mode');
  $('pttBtn').style.display = '';
}
function exitPttMode() {
  pttMode = false;
  $('micBtn').classList.remove('ptt-mode');
  $('pttBtn').style.display = 'none';
  $('pttBtn').classList.remove('ptt-active');
  micOn = savedMic;
  if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = micOn);
  $('micBtn').classList.toggle('on', micOn);
  $('micBtn').classList.toggle('off', !micOn);
}
// Mic: single tap = toggle, double tap = enter/exit PTT
$('micBtn').addEventListener('pointerup', (e) => {
  if (pttMode) {
    // in PTT mode, only respond to double tap to exit
    const now = Date.now();
    if (now - lastTap < 350) {
      lastTap = 0; clearTimeout(tapTimer);
      exitPttMode();
    } else {
      lastTap = now; clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { lastTap = 0; }, 350);
    }
    return;
  }
  const now = Date.now();
  if (now - lastTap < 350) {
    lastTap = 0; clearTimeout(tapTimer);
    enterPttMode();
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
// PTT button: hold = talk, double tap = exit PTT
$('pttBtn').addEventListener('pointerdown', () => {
  if (!pttMode) return;
  if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = true);
  $('pttBtn').classList.add('ptt-active');
});
$('pttBtn').addEventListener('pointerup', (e) => {
  if (!pttMode) return;
  if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = false);
  $('pttBtn').classList.remove('ptt-active');
  // double tap on pttBtn to exit
  const now = Date.now();
  if (now - lastPttTap < 350) {
    lastPttTap = 0; clearTimeout(pttTapTimer);
    exitPttMode();
    return;
  }
  lastPttTap = now; clearTimeout(pttTapTimer);
  pttTapTimer = setTimeout(() => { lastPttTap = 0; }, 350);
});
$('pttBtn').addEventListener('pointercancel', () => {
  if (!pttMode) return;
  if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = false);
  $('pttBtn').classList.remove('ptt-active');
});
$('toggleCamsBtn').onclick = () => {
  camsVisible = !camsVisible;
  $('peerList').style.display = camsVisible ? '' : 'none';
  $('localVideo').style.display = camsVisible ? '' : 'none';
  $('toggleCamsBtn').classList.toggle('off', !camsVisible);
};
$('fullscreenBtn').onclick = () => {
  $('room').classList.toggle('fullscreen');
  $('controls').classList.toggle('overlay');
};
$('shareBtn').onclick = () => {
  if (!roomId) return;
  const url = `https://tvhamsters.outmilk.online/mobile/?code=${roomId}`;
  const text = `\u041F\u0440\u0438\u0441\u043E\u0435\u0434\u0438\u043D\u044F\u0439\u0441\u044F \u043A\u043E \u043C\u043D\u0435 \u0432 TV Hamsters! \uD83D\uDC39\n\u041A\u043E\u0434 \u043A\u043E\u043C\u043D\u0430\u0442\u044B: ${roomId}\n\u0421\u0441\u044B\u043B\u043A\u0430: ${url}`;
  if (navigator.share) {
    navigator.share({ title: 'TV Hamsters', text: text, url: url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => toast('\u0421\u0441\u044B\u043B\u043A\u0430 \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u0430')).catch(() => {});
  }
};
document.addEventListener('contextmenu', e => e.preventDefault());
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

// Chat
$('chatBtn').onclick = () => {
  $('chatOverlay').style.display = 'flex';
  setTimeout(() => $('chatInput').focus(), 300);
};
$('chatOverlay').onclick = (e) => { if (e.target === $('chatOverlay')) $('chatOverlay').style.display = 'none'; };
$('chatCloseBtn').onclick = () => $('chatOverlay').style.display = 'none';
$('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
$('chatSendBtn').onclick = sendChat;
function sendChat() {
  const input = $('chatInput');
  const text = input.value.trim();
  if (!text || !socket) return;
  input.value = '';
  const el = document.createElement('div');
  el.className = 'chat-msg chat-msg-self';
  el.innerHTML = '<span class="chat-msg-text">' + escapeHtml(text) + '</span>';
  $('chatMessages').appendChild(el);
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
  socket.emit('chat-message', { text: text, name: userName || '\u042F' });
}
function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Reactions
$('reactionBtn').onclick = () => {
  $('reactionPicker').style.display = $('reactionPicker').style.display === 'flex' ? 'none' : 'flex';
};
document.querySelectorAll('.reaction-emoji').forEach(btn => {
  btn.onclick = () => {
    const emoji = btn.dataset.emoji;
    $('reactionPicker').style.display = 'none';
    showReaction(emoji);
    if (socket && socket.connected) socket.emit('reaction', { emoji: emoji });
  };
});
function showReaction(emoji) {
  const el = document.createElement('div');
  el.className = 'reaction-float';
  el.textContent = emoji;
  $('faces').appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

// PWA Install
$('installBtn').onclick = async () => {
  if (!installPrompt) return;
  await installPrompt.prompt();
  installPrompt = null;
  $('installBtn').style.display = 'none';
};

// Name prompt
function showMobileNameModal(prefill) {
  const input = $('mobileNameInput');
  if (input) input.value = prefill || '';
  const modal = $('namePromptModal');
  if (modal) modal.style.display = 'flex';
  if (input) setTimeout(() => { input.focus(); input.select(); }, 300);
}
function applyMobileName(val) {
  if (val && val.trim()) { userName = val.trim(); localStorage.setItem('mobileUserName', val.trim()); }
  else { userName = getRandomName(); }
  $('namePromptModal').style.display = 'none';
  const display = $('mobileNameDisplay');
  if (display) display.textContent = userName;
  const bar = $('mobileNameBar');
  if (bar) bar.style.display = 'flex';
}
if (!ensureUserName()) showMobileNameModal('');
else applyMobileName(userName);
$('mobileNameConfirm').onclick = () => { applyMobileName($('mobileNameInput').value); };
$('mobileNameSkip').onclick = () => { applyMobileName(''); };
$('mobileNameInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('mobileNameConfirm').click();
});
$('namePromptModal').onclick = (e) => {
  if (e.target === $('namePromptModal')) applyMobileName('');
};
$('mobileNameEditBtn').onclick = () => { showMobileNameModal(userName); };

// Help modal
$('helpBtn').onclick = () => $('helpModal').style.display = 'flex';
$('closeHelpBtn').onclick = () => $('helpModal').style.display = 'none';
$('helpModal').onclick = (e) => { if (e.target === $('helpModal')) $('helpModal').style.display = 'none'; };
$('donateLinkBoosty').onclick = () => {
  window.open('https://boosty.to/outmilker', '_blank');
};
$('donateLinkCloud').onclick = () => {
  window.open('https://pay.cloudtips.ru/p/8485a55c', '_blank');
};

(function() {
  try {
    const p = new URLSearchParams(location.search);
    const c = p.get('code');
    if (c) {
      $('roomCodeInput').value = c;
      roomId = c;
      show('\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u044E\u0441\u044C...');
      myAction = { type: 'join', code: c };
      sessionStorage.setItem('hamsters_room', JSON.stringify({ type: 'join', code: c }));
      requestMedia().then(() => connectAndDo(() => socket.emit('join-room', c)));
    } else {
      const saved = sessionStorage.getItem('hamsters_room');
      if (saved) {
        const r = JSON.parse(saved);
        $('roomCodeInput').value = r.code;
        roomId = r.code;
        show('\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u044E \u043A\u043E\u043C\u043D\u0430\u0442\u0443...');
        myAction = r;
        requestMedia().then(() => connectAndDo(() => { if (r.type === 'create') socket.emit('create-room'); else socket.emit('join-room', r.code); }));
      }
    }
  } catch(e) { console.error(e); }
})();
