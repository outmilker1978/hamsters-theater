const { io } = require('socket.io-client');
const { ipcRenderer } = require('electron');

let CLOUD_SERVER_URL = 'https://tv-hamsters-bot.onrender.com';
let isCloudMode = true;

function getServerUrl() {
  if (isCloudMode) return CLOUD_SERVER_URL;
  const val = el('serverUrlInput').value.trim();
  return 'http://' + val.replace(/^https?:\/\//, '');
}

let useRelay = localStorage.getItem('useRelay') === 'true';

function getRTCConfig() {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.xten.com:3478' },
    { urls: 'stun:stun.voiparound.com' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    // TURN relay — всегда включён как в v1.7.8
    { urls: 'turn:relay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' }
  ];
  if (useRelay) {
    servers.push(
      { urls: 'turn:relay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:relay.metered.ca:80?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
    );
  }
  return { iceServers: servers };
}

let socket = null;
let localStream = null;
let mySocketId = null;
let roomId = null;
let isHost = false;
let myAddress = 'localhost:3000';
let serverPort = 3000;
let localAddress = 'localhost:3000';
let sharingScreen = false;
let screenStream = null;
let sharerId = null;
let isCamGridActive = false;
let pttMode = false;
let pttActive = false;
let prevMicOn = true;
let camOn = true;
let micOn = true;
let micMode = 'normal'; // 'normal' | 'ptt'
let qualityLevel = localStorage.getItem('qualityLevel') || 'medium';
let pendingPeers = [];
let pendingOffers = [];
let userName = localStorage.getItem('userName') || '';
const FUNNY_NAMES = [
  '\u043F\u0443\u0445\u043B\u044F\u043A', '\u043D\u0430 \u0441\u043F\u043E\u0440\u0442\u0435', '\u0436\u0443\u043B\u044C\u0431\u0430\u043D', '\u0448\u0438\u0432\u043E\u0440\u043E\u0442', '\u043A\u043E\u043B\u0431\u0430\u0441\u043A\u0430', '\u043F\u044B\u0445\u0442\u0435\u043B\u043A\u0438\u043D',
  '\u0449\u0438\u043F\u0430\u0447', '\u043B\u0430\u043F\u0448\u0430', '\u0448\u043C\u0435\u043B\u044C', '\u0431\u0443\u043B\u044C\u043A\u0430', '\u0441\u044B\u0440\u043D\u0438\u043A', '\u0445\u0440\u044F\u043A',
  '\u043F\u0443\u0448\u0438\u0441\u0442\u0430\u044F \u0436\u043E\u043F\u043A\u0430', '\u043D\u0430 \u043B\u0438\u043D\u044C\u043A\u0435', '\u043D\u0430 \u0437\u0430\u0436\u0438\u0440\u043E\u0432\u043A\u0435', '\u0447\u0443\u0431\u0438\u043A', '\u0445\u0432\u043E\u0441\u0442\u0438\u043A', '\u0448\u0430\u0440\u0438\u043A', '\u043A\u043E\u043C\u043E\u0447\u0435\u043A',
  '\u044C\u044E-\u0445\u044E', '\u0445\u0440\u044E\u043C', '\u043F\u0438\u0449\u0430\u043B\u043A\u0430', '\u0445\u0440\u044E\u0447\u0438\u043A'
];
function getRandomName() { return '\u0425\u043E\u043C\u044F\u043A ' + FUNNY_NAMES[Math.floor(Math.random() * FUNNY_NAMES.length)]; }
function ensureUserName() {
  const saved = localStorage.getItem('userName');
  if (saved && saved.trim()) { userName = saved.trim(); return true; }
  return false;
}

let peers = {};

ipcRenderer.invoke('get-server-port').then(p => {
  serverPort = p;
  myAddress = 'localhost:' + p;
  log('Server port: ' + p);
  // Auto-update server URL input with actual port (only for local addresses)
  const input = el('serverUrlInput');
  if (input && input.value.includes('localhost')) {
    const parts = input.value.split(':');
    input.value = parts[0] + ':' + p;
  }
  // Get local LAN IP for local mode
  ipcRenderer.invoke('get-local-ip').then(lan => {
    localAddress = (lan || 'localhost') + ':' + p;
    if (!isCloudMode) {
      const elIP = document.getElementById('publicIP');
      if (elIP) elIP.textContent = localAddress;
    }
  });
  // Get public IP (for copyAddress in cloud mode)
  ipcRenderer.invoke('get-public-ip').then(ip => {
    myAddress = ip + ':' + p;
  });
});
ipcRenderer.invoke('get-upnp-status').then(s => {
  const el = document.getElementById('upnpStatus');
  if (el) el.textContent = '\uD83D\uDD0C ' + s;
});
ipcRenderer.invoke('get-cloud-url').then(url => {
  CLOUD_SERVER_URL = url;
});

const el = (id) => document.getElementById(id);
const showError = (msg) => { const e = el('errorMsg'); if (e) e.textContent = msg; };
const log = (msg) => console.log('[NT]', msg);
const appDebug = (msg) => {}; // placeholder

// --- Quality / Bandwidth settings ---
const QUALITY_PRESETS = {
  low:   { camScale: 0.5,  screenScale: 0.5,  camBitrate: 200_000, screenBitrate: 1_000_000 },
  medium:{ camScale: 0.75, screenScale: 0.75, camBitrate: 400_000, screenBitrate: 2_000_000 },
  high:  { camScale: 1.0,  screenScale: 1.0,  camBitrate: 700_000, screenBitrate: 4_000_000 }
};

function getQualityPreset() {
  return QUALITY_PRESETS[qualityLevel] || QUALITY_PRESETS.medium;
}

function getCameraConstraints() {
  return {
    video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 20 } },
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
  };
}

function applyQualityToSender(pc, kind, bitrate, scale) {
  setTimeout(() => {
    const sender = pc.getSenders().find(s => s.track && s.track.kind === kind);
    if (!sender) return;
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
      params.encodings[0].maxBitrate = bitrate;
      if (scale) params.encodings[0].scaleResolutionDownBy = scale;
      sender.setParameters(params).catch(e => log('setParams err: ' + e.message));
    } catch (e) { log('setParams err: ' + e.message); }
  }, 500);
}

function syncQuality() {
  const q = getQualityPreset();
  for (const peerId of Object.keys(peers)) {
    const p = peers[peerId];
    if (p.pc) {
      applyQualityToSender(p.pc, 'video', q.camBitrate, q.camScale);
      applyQualityToSender(p.pc, 'audio', 64_000, null);
    }
    if (p.screenPC) {
      applyQualityToSender(p.screenPC, 'video', q.screenBitrate, q.screenScale);
    }
  }
}

function copyAddress() {
  const text = isCloudMode ? CLOUD_SERVER_URL : t('copy.server_prefix') + localAddress;
  ipcRenderer.invoke('copy-clipboard', text).then(() => showCopyToast()).catch(() => {});
}

function showToast(msg) {
  let toast = document.getElementById('copyToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'copyToast';
    toast.className = 'copy-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}
function showCopyToast() { showToast(t('toast.copied')); }

// --- i18n ---
function applyLangToUI() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  });
  document.querySelectorAll('[data-tooltip-i18n]').forEach(el => {
    el.setAttribute('data-tooltip', t(el.getAttribute('data-tooltip-i18n')));
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
  });
  updateControlTooltips();
}

function updateControlTooltips() {
  el('toggleCameraBtn').setAttribute('data-tooltip', t('tooltip.camera'));
  el('toggleMicBtn').setAttribute('data-tooltip', micMode === 'ptt' ? t('tooltip.mic_ptt') : t('tooltip.mic'));
  if (sharingScreen || sharerId) {
    el('shareScreenBtn').setAttribute('data-tooltip', t('tooltip.share_disabled'));
  } else {
    el('shareScreenBtn').setAttribute('data-tooltip', t('tooltip.share'));
  }
  el('leaveBtn').setAttribute('data-tooltip', t('tooltip.leave'));
  el('pttBtn').setAttribute('data-tooltip', t('tooltip.ptt'));
}

document.addEventListener('langchange', (e) => {
  applyLangToUI();
  ipcRenderer.send('set-language', e.detail);
});

function applyModeUI() {
  const addrRow = el('addressRow');
  const upnpRow = el('upnpRow');
  if (isCloudMode) {
    el('modeCloud').classList.add('active');
    el('modeLan').classList.remove('active');
    el('serverUrlInput').value = CLOUD_SERVER_URL;
    el('serverUrlInput').placeholder = t('mode.cloud_placeholder');
    if (addrRow) addrRow.style.display = 'none';
    if (upnpRow) upnpRow.style.display = 'none';
  } else {
    el('modeLan').classList.add('active');
    el('modeCloud').classList.remove('active');
    el('serverUrlInput').placeholder = t('mode.local_placeholder');
    el('serverUrlInput').value = 'localhost:' + serverPort;
    el('publicIP').textContent = localAddress;
    el('addressLabel').textContent = t('landing.your_address') || '\u041B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0430\u0434\u0440\u0435\u0441:';
    if (addrRow) addrRow.style.display = 'flex';
    if (upnpRow) upnpRow.style.display = '';
  }
}
el('modeLan').onclick = () => {
  isCloudMode = false;
  applyModeUI();
};
el('modeCloud').onclick = () => {
  isCloudMode = true;
  applyModeUI();
};

// --- Shared Socket Setup ---
function setupSocketListeners() {
  function onPeerJoined(peerId) {
    log('peer-joined: ' + peerId);
    if (localStream) createOfferToPeer(peerId);
    else pendingPeers.push(peerId);
    if (socket && socket.connected && userName) {
      socket.emit('signal', { to: peerId, signalType: 'user-info', name: userName });
    }
  }
  socket.on('user-joined', onPeerJoined);
  socket.on('peer-joined', onPeerJoined);
  socket.on('offer', (data) => {
    if (data.type === 'screen') { handleScreenOffer(data); return; }
    if (localStream) handleOffer(data);
    else pendingOffers.push(data);
  });
  socket.on('answer', handleAnswer);
  socket.on('ice-candidate', handleIceCandidate);
  socket.on('peer-disconnected', (peerId) => removePeer(peerId));
  socket.on('error-msg', showError);
  socket.on('disconnect', () => { showError(t('error.server_lost')); });
  socket.on('signal', handleSignal);
  socket.on('server-log', (msg) => log(msg));
  socket.on('chat-message', (d) => {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg';
    msgDiv.innerHTML = '<span class="chat-msg-author">' + escapeHtml(d.name) + '</span><span class="chat-msg-text">' + escapeHtml(d.text) + '</span>';
    el('chatMessages').appendChild(msgDiv);
    el('chatMessages').scrollTop = el('chatMessages').scrollHeight;
    if (d.from !== socket.id) {
      if (el('chatOverlay').style.display !== 'flex') showToast(d.name + ': ' + d.text, 4000);
      try { ipcRenderer.send('forward-chat', { name: d.name, text: d.text }); } catch(e) {}
    }
  });
  socket.on('reaction', (d) => {
    showReaction(d.emoji);
    try { ipcRenderer.send('forward-reaction', d.emoji); } catch(e) {}
  });
}

// --- Landing ---
el('createRoomBtn').onclick = () => {
  showError('');
  isHost = true;
  socket = io(getServerUrl());
  setupSocketListeners();
  socket.on('connect', () => { log('Connected'); socket.emit('create-room'); });
  socket.on('room-created', async (id) => {
    roomId = id;
    mySocketId = socket.id;
    el('roomCodeDisplay').textContent = t('room.code_label') + ' ' + id;
    el('roomCodeDisplay').className = 'copyable';
    const serverLabel = isCloudMode ? CLOUD_SERVER_URL : ('\u0421\u0435\u0440\u0432\u0435\u0440: ' + localAddress);
    const connectInfo = serverLabel + '\n' + t('room.code_label') + ' ' + id;
    ipcRenderer.invoke('copy-clipboard', connectInfo).then(() => showCopyToast()).catch(() => {});
    showRoom();
    updateCamGrid();
    await startCamera();
    if (pendingPeers.length) {
      pendingPeers.forEach(pid => createOfferToPeer(pid));
      pendingPeers = [];
    }
    pendingOffers.forEach(o => handleOffer(o));
    pendingOffers = [];
  });
};

el('roomCodeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') el('joinRoomBtn').click(); });
el('joinRoomBtn').onclick = () => {
  showError('');
  const code = el('roomCodeInput').value.trim();
  if (!code) { showError(t('error.enter_code')); return; }
  isHost = false;
  roomId = code;
  socket = io(getServerUrl());
  setupSocketListeners();
  socket.on('connect', () => { log('Connected'); socket.emit('join-room', code); });
  socket.on('joined', async () => {
    mySocketId = socket.id;
    showRoom();
    el('roomCodeDisplay').textContent = t('room.code_label') + ' ' + roomId;
    await startCamera();
    updateCamGrid();
    pendingOffers.forEach(o => handleOffer(o));
    pendingOffers = [];
    if (pendingPeers.length) {
      pendingPeers.forEach(pid => createOfferToPeer(pid));
      pendingPeers = [];
    }
  });
  socket.on('room-users', (users) => {
    log('room-users: ' + JSON.stringify(users));
    if (userName && socket && socket.connected) {
      users.forEach(pid => {
        socket.emit('signal', { to: pid, signalType: 'user-info', name: userName });
      });
    }
  });
};

function showRoom() {
  el('landing').style.display = 'none';
  el('room').style.display = 'flex';
}

// --- Camera ---
async function startCamera() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia(getCameraConstraints());
    // Ensure echo cancellation is applied
    localStream.getAudioTracks().forEach(t => {
      try { t.applyConstraints({ echoCancellation: true, noiseSuppression: true, autoGainControl: true }); } catch(e) {}
      log('Audio track settings:', JSON.stringify(t.getSettings ? t.getSettings() : {}));
    });
    el('localVideo').srcObject = localStream;
    // Apply saved mic volume
    const savedMicVol = parseFloat(localStorage.getItem('micVolume') || '100');
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack && savedMicVol !== 100) {
      try { audioTrack.applyConstraints({ advanced: [{ gain: savedMicVol / 100 }] }); } catch(e) {}
    }
    log('Camera ready');
    const localLabel = el('localFace').querySelector('.face-label');
    if (localLabel) localLabel.textContent = userName || t('room.you');
    setupPTT();
  } catch (err) {
    log('Camera error:', err.message);
    const label = el('localFace').querySelector('.face-label');
    if (label) label.textContent = t('error.camera_unavailable');
  }
}

let peerNames = {};

// --- Peer Entry ---
function createPeerEntry(peerId) {
  if (!peers[peerId]) {
    peers[peerId] = { pc: null, screenPC: null, remoteStream: null, cameraCandidates: [], screenCandidates: [] };
  }
  return peers[peerId];
}

// --- Video Elements ---
function addPeerVideo(peerId) {
  const container = el('remote-faces');
  if (!container || document.getElementById('face-' + peerId)) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'face-wrapper';
  wrapper.id = 'face-' + peerId;
  const video = document.createElement('video');
  video.id = 'video-' + peerId;
  video.dataset.peerId = peerId;
  video.autoplay = true;
  video.playsInline = true;
  const label = document.createElement('div');
  label.className = 'face-label';
  label.id = 'label-' + peerId;
  label.textContent = peerNames[peerId] || '\u0425\u043e\u043c\u044f\u0447\u043e\u043a [' + peerId.slice(0,6) + '] ' + Object.keys(peers).length;
  wrapper.appendChild(video);
  wrapper.appendChild(label);
  // Volume slider
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'volume-slider';
  slider.min = 0;
  slider.max = 100;
  slider.value = localStorage.getItem('vol-' + peerId) || 100;
  slider.oninput = () => {
    const vol = slider.value / 100;
    const v = document.getElementById('video-' + peerId);
    if (v) v.volume = vol;
    localStorage.setItem('vol-' + peerId, slider.value);
  };
  wrapper.appendChild(slider);
  container.appendChild(wrapper);
  // Apply saved volume after stream attaches
  setTimeout(() => {
    const v = document.getElementById('video-' + peerId);
    if (v) v.volume = (parseInt(localStorage.getItem('vol-' + peerId) || '100')) / 100;
  }, 1000);
}

function removePeerVideo(peerId) {
  const el = document.getElementById('face-' + peerId);
  if (el) el.remove();
}

// --- Peer Connection ---
function createPC(peerId) {
  const conn = new RTCPeerConnection(getRTCConfig());
  conn.onicecandidate = (e) => {
    if (e.candidate && peerId)
      socket.emit('ice-candidate', { to: peerId, candidate: e.candidate, type: 'camera' });
  };
  conn.ontrack = (e) => {
    const peer = peers[peerId];
    if (!peer) return;
    if (!peer.remoteStream) {
      peer.remoteStream = new MediaStream();
      const videoEl = document.getElementById('video-' + peerId);
      if (videoEl) videoEl.srcObject = peer.remoteStream;
    }
    peer.remoteStream.addTrack(e.track);
    log('Remote track from ' + peerId + ': ' + e.track.kind);
  };
  conn.oniceconnectionstatechange = () => {
    if (['disconnected', 'failed'].includes(conn.iceConnectionState)) {
      const peer = peers[peerId];
      if (peer && !peer.remoteStream && peerId) {
        log('Initial connection failed to ' + peerId + ' – retrying');
        conn.close();
        if (peers[peerId]) peers[peerId].pc = null;
        socket.emit('signal', { to: peerId, signalType: 'request-offer' });
      }
    }
  };
  return conn;
}

function createScreenPC(peerId) {
  const conn = new RTCPeerConnection(getRTCConfig());
  conn.onicecandidate = (e) => {
    if (e.candidate && peerId)
      socket.emit('ice-candidate', { to: peerId, candidate: e.candidate, type: 'screen' });
  };
  conn.ontrack = (e) => {
    el('screenshareVideo').style.display = 'block';
    el('screenshare-placeholder').style.display = 'none';
    el('screenshareVideo').srcObject = e.streams[0];
    el('screenshareVideo').muted = false;
    log('SCREEN TRACK from ' + peerId);
  };
  conn.onconnectionstatechange = () => {
    log('screenPC[' + peerId + '] state=' + conn.connectionState);
    if (conn.connectionState === 'disconnected' || conn.connectionState === 'failed') {
      if (sharerId === peerId) {
        sharerId = null;
        el('shareScreenBtn').disabled = false;
        updateControlTooltips();
        el('screenshareVideo').srcObject = null;
        el('screenshareVideo').style.display = 'none';
        el('screenshare-placeholder').style.display = 'block';
        updateCamGrid();
      }
      if (peers[peerId]) peers[peerId].screenPC = null;
    }
  };
  return conn;
}

// --- Signaling ---
function createOfferToPeer(peerId) {
  if (!localStream) return;
  if (!peers[peerId]) { peers[peerId] = createPeerEntry(peerId); addPeerVideo(peerId); }
  const peer = peers[peerId];
  if (peer.pc) { peer.pc.close(); }
  peer.pc = createPC(peerId);
  localStream.getTracks().forEach(t => peer.pc.addTrack(t, localStream));
  peer.pc.createOffer().then(offer => {
    peer.pc.setLocalDescription(offer);
    socket.emit('offer', { to: peerId, sdp: offer, type: 'camera' });
    log('Offer sent to ' + peerId);
    const q = getQualityPreset();
    applyQualityToSender(peer.pc, 'video', q.camBitrate, q.camScale);
    applyQualityToSender(peer.pc, 'audio', 64_000, null);
  });
  if (sharingScreen && screenStream) {
    createScreenOffer(peerId, screenStream);
  }
}

function handleOffer(data) {
  if (data.type === 'screen') { handleScreenOffer(data); return; }
  const fromId = data.from;
  log('handleOffer from: ' + fromId);
  if (!peers[fromId]) { peers[fromId] = createPeerEntry(fromId); addPeerVideo(fromId); }
  if (data.name) {
    peerNames[fromId] = data.name;
    const label = document.getElementById('label-' + fromId);
    if (label) label.textContent = data.name;
  }
  const peer = peers[fromId];
  if (peer.pc) { peer.pc.close(); }
  peer.pc = createPC(fromId);
  if (localStream) localStream.getTracks().forEach(t => peer.pc.addTrack(t, localStream));
  peer.pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
    .then(() => {
      peer.cameraCandidates.forEach(c => {
        peer.pc.addIceCandidate(new RTCIceCandidate(c)).catch(e => log('flush cam cand err: ' + e.message));
      });
      peer.cameraCandidates = [];
      return peer.pc.createAnswer();
    })
    .then(answer => {
      peer.pc.setLocalDescription(answer);
      socket.emit('answer', { to: fromId, sdp: answer, type: 'camera' });
      log('Answer sent to ' + fromId);
      const q = getQualityPreset();
      applyQualityToSender(peer.pc, 'video', q.camBitrate, q.camScale);
      applyQualityToSender(peer.pc, 'audio', 64_000, null);
    });
}

function handleScreenOffer(data) {
  const fromId = data.from;
  if (sharingScreen) { log('Screen offer ignored – already sharing'); return; }
  log('handleScreenOffer from: ' + fromId);
  if (!peers[fromId]) { peers[fromId] = createPeerEntry(fromId); addPeerVideo(fromId); }
  const peer = peers[fromId];
  if (peer.screenPC) { peer.screenPC.close(); }
  peer.screenPC = createScreenPC(fromId);
  peer.screenPC.setRemoteDescription(new RTCSessionDescription(data.sdp))
    .then(() => {
      peer.screenCandidates.forEach(c => {
        peer.screenPC.addIceCandidate(new RTCIceCandidate(c)).catch(e => log('flush screen cand err: ' + e.message));
      });
      peer.screenCandidates = [];
      return peer.screenPC.createAnswer();
    })
    .then(answer => {
      peer.screenPC.setLocalDescription(answer);
      socket.emit('answer', { to: fromId, sdp: answer, type: 'screen' });
      log('Screen answer sent to ' + fromId);
    })
    .catch(e => log('screenPC error: ' + e.message));
  sharerId = fromId;
  el('shareScreenBtn').disabled = true;
  updateControlTooltips();
}

function handleAnswer(data) {
  if (data.type === 'screen') { handleScreenAnswer(data); return; }
  const fromId = data.from;
  const peer = peers[fromId];
  if (peer && peer.pc && peer.pc.signalingState !== 'stable') {
    peer.pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
      .then(() => {
        peer.cameraCandidates.forEach(c => {
          peer.pc.addIceCandidate(new RTCIceCandidate(c)).catch(e => log('flush cam cand err: ' + e.message));
        });
        peer.cameraCandidates = [];
      });
  }
}

function handleScreenAnswer(data) {
  const fromId = data.from;
  const peer = peers[fromId];
  if (peer && peer.screenPC && peer.screenPC.signalingState !== 'stable') {
    peer.screenPC.setRemoteDescription(new RTCSessionDescription(data.sdp));
    peer.screenCandidates.forEach(c => {
      peer.screenPC.addIceCandidate(new RTCIceCandidate(c)).catch(e => log('flush screen cand err: ' + e.message));
    });
    peer.screenCandidates = [];
    log('screenPC remote from answer ' + fromId);
  }
}

function handleIceCandidate(data) {
    if (!data.candidate || !data.from) return;
    const fromId = data.from;
    if (!peers[fromId]) { peers[fromId] = createPeerEntry(fromId); addPeerVideo(fromId); }
    const peer = peers[fromId];
    if (data.type === 'screen') {
      if (peer.screenPC && peer.screenPC.remoteDescription && peer.screenPC.remoteDescription.type) {
        peer.screenPC.addIceCandidate(new RTCIceCandidate(data.candidate));
      } else {
        peer.screenCandidates.push(data.candidate);
      }
    } else {
      if (peer.pc && peer.pc.remoteDescription && peer.pc.remoteDescription.type) {
        peer.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } else {
        peer.cameraCandidates.push(data.candidate);
      }
    }
  }

function handleSignal(data) {
  log('handleSignal: ' + data.type + ' from=' + data.from);
  if (data.type === 'screen-started') {
    sharerId = data.from;
    el('shareScreenBtn').disabled = true;
    updateControlTooltips();
    updateCamGrid();
  }
  if (data.type === 'screen-stopped') {
    sharerId = null;
    el('shareScreenBtn').disabled = false;
    updateControlTooltips();
    el('screenshareVideo').srcObject = null;
    el('screenshareVideo').style.display = 'none';
    el('screenshare-placeholder').style.display = 'block';
    if (peers[data.from]) {
      if (peers[data.from].screenPC) { peers[data.from].screenPC.close(); peers[data.from].screenPC = null; }
    }
    updateCamGrid();
  }
  if (data.type === 'request-offer') {
    if (localStream) createOfferToPeer(data.from);
  }
  if (data.type === 'user-info') {
    console.log('user-info: name="' + data.name + '" from=' + data.from);
    if (data.name) {
      peerNames[data.from] = data.name;
      const label = document.getElementById('label-' + data.from);
      if (label) { label.textContent = data.name; }
      else { console.log('user-info: label for ' + data.from + ' not found'); }
    }
  }
}

// --- Screen Share with Window Picker ---
async function openSourcePicker() {
  if (sharingScreen) { stopScreenShare(); return; }
  if (Object.keys(peers).length === 0) { showError(t('error.no_peer')); return; }
  let sources;
  try {
    sources = await ipcRenderer.invoke('get-screens');
  } catch (e) {
    log('get-screens failed: ' + e.message);
    return;
  }
  sources = sources.filter(s => !s.name.toLowerCase().includes('hamsters theater'));
  const list = el('sourceList');
  list.innerHTML = '';
  if (!sources.length) {
    el('sourcePickerModal').style.display = 'flex';
    return;
  }
  for (const src of sources) {
    const item = document.createElement('div');
    item.className = 'source-item' + (src.minimized ? ' minimized' : '');
    const thumb = document.createElement('img');
    if (src.thumbnail) {
      thumb.src = src.thumbnail;
    } else {
      thumb.alt = t('sourcepicker.no_preview') || 'Нет превью';
      thumb.className = 'no-thumb';
    }
    item.appendChild(thumb);
    const label = document.createElement('span');
    label.textContent = src.name;
    item.appendChild(label);
    item.onclick = () => {
      el('sourcePickerModal').style.display = 'none';
      if (src.minimized) {
        const title = src.name.replace(' (свёрнуто)', '');
        ipcRenderer.invoke('restore-window', title).then(ok => {
          if (ok) {
            showError('Окно восстановлено, выберите его снова');
            setTimeout(() => { showError(''); openSourcePicker(); }, 1500);
          } else {
            showError(t('sourcepicker.restore_hint') || 'Разверните окно и нажмите заново');
          }
        });
        return;
      }
      log('Selected source: ' + src.name + ' (' + src.id + ')');
      startShareWithSource(src.id);
    };
    list.appendChild(item);
  }
  el('sourcePickerModal').style.display = 'flex';
}

async function startShareWithSource(sourceId) {
  await ipcRenderer.invoke('set-screen-source', sourceId);
  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  } catch (e) {
    log('Screen share error:', e.message);
    return;
  }
  doStartScreenShare(stream);
}

el('shareScreenBtn').onclick = openSourcePicker;
el('closeSourcePickerBtn').onclick = () => el('sourcePickerModal').style.display = 'none';
el('sourcePickerModal').onclick = (e) => { if (e.target === el('sourcePickerModal')) el('sourcePickerModal').style.display = 'none'; };

function replacePeerVideoTrack(newTrack) {
  for (const pid of Object.keys(peers)) {
    const p = peers[pid];
    if (p.pc) {
      const sender = p.pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) sender.replaceTrack(newTrack).catch(() => {});
    }
  }
}

async function switchCameraResolution(targetConstraints) {
  if (!localStream) return;
  try {
    const newStream = await navigator.mediaDevices.getUserMedia({ video: targetConstraints, audio: false });
    const oldTrack = localStream.getVideoTracks()[0];
    const newTrack = newStream.getVideoTracks()[0];
    if (oldTrack) { localStream.removeTrack(oldTrack); oldTrack.stop(); }
    localStream.addTrack(newTrack);
    replacePeerVideoTrack(newTrack);
    el('localVideo').srcObject = localStream;
  } catch (e) { log('camera switch err: ' + e.message); }
}

async function doStartScreenShare(stream) {
  screenStream = stream;
  sharingScreen = true;
  syncQuality();
  updateCamGrid();
  el('screenshareVideo').style.display = 'block';
  el('screenshare-placeholder').style.display = 'none';
  el('screenshareVideo').srcObject = stream;
  el('screenshareVideo').muted = true;
  el('shareScreenBtn').classList.add('sharing');
  await ipcRenderer.invoke('window-mode', 'minimized');
  await ipcRenderer.invoke('create-panel');
  await ipcRenderer.invoke('create-faces');
  ipcRenderer.invoke('create-reactions-overlay');
  startFacesTimer();
  updateControlTooltips();
  for (const peerId of Object.keys(peers)) {
    createScreenOffer(peerId, stream);
  }
  broadcastSignal('screen-started', { hasAudio: stream.getAudioTracks().length > 0 });
  if (stream.getVideoTracks().length) {
    stream.getVideoTracks()[0].onended = () => stopScreenShare();
  }
}

function createScreenOffer(peerId, stream) {
  if (!peers[peerId]) return;
  const peer = peers[peerId];
  if (peer.screenPC) { peer.screenPC.close(); }
  peer.screenPC = createScreenPC(peerId);
  stream.getTracks().forEach(t => peer.screenPC.addTrack(t, stream));
  peer.screenPC.createOffer().then(offer => {
    peer.screenPC.setLocalDescription(offer);
    socket.emit('offer', { to: peerId, sdp: offer, type: 'screen' });
    log('Screen offer sent to ' + peerId);
    const q = getQualityPreset();
    applyQualityToSender(peer.screenPC, 'video', q.screenBitrate, q.screenScale);
  }).catch(e => log('screen offer error: ' + e.message));
}

async function stopScreenShare() {
  sharingScreen = false;
  syncQuality();
  updateCamGrid();
  if (screenStream) { screenStream.getTracks().forEach(t => t.stop()); screenStream = null; }
  for (const peerId of Object.keys(peers)) {
    if (peers[peerId].screenPC) { peers[peerId].screenPC.close(); peers[peerId].screenPC = null; }
  }
  broadcastSignal('screen-stopped');
  el('screenshareVideo').srcObject = null;
  el('screenshareVideo').style.display = 'none';
  el('screenshare-placeholder').style.display = 'block';
  el('shareScreenBtn').classList.remove('sharing');
  ipcRenderer.invoke('close-panel');
  ipcRenderer.invoke('close-faces');
  ipcRenderer.invoke('close-reactions-overlay');
  stopFacesTimer();
  ipcRenderer.invoke('window-mode', 'restore');
  updateControlTooltips();
  setTimeout(() => showError(''), 2000);
}

function broadcastSignal(type, extra) {
  for (const peerId of Object.keys(peers)) {
    socket.emit('signal', { to: peerId, signalType: type, ...(extra || {}) });
  }
}

// --- PTT (for ALL users, two modes) ---
function setupPTT() {
  if (pttMode) return;
  pttMode = true;
  pttActive = false;
  prevMicOn = micOn;
  // Always start in normal mic mode
  micMode = 'normal';
  updatePTTUI();
  updateMicButtonUI();
  log('PTT mode on');
  el('pttBtn').style.display = micMode === 'ptt' ? 'flex' : 'none';
  el('pttBtn').classList.remove('active');

  const onKeyDown = (e) => {
    if ((e.code === 'Space' || e.key === ' ') && pttMode && micMode === 'ptt') {
      e.preventDefault();
      log('PTT keydown');
      startPTT();
    }
  };
  const onKeyUp = (e) => {
    if ((e.code === 'Space' || e.key === ' ') && pttMode && micMode === 'ptt') {
      e.preventDefault();
      log('PTT keyup');
      stopPTT();
    }
  };
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  // PTT button: hold to talk (mouse)
  el('pttBtn').onmousedown = (e) => { e.preventDefault(); if (micMode === 'ptt') startPTT(); };
  el('pttBtn').onmouseup = (e) => { e.preventDefault(); stopPTT(); };
  el('pttBtn').onmouseleave = (e) => { stopPTT(); };
  el('pttBtn')._onKeyDown = onKeyDown;
  el('pttBtn')._onKeyUp = onKeyUp;
}
let timeoutPTTRemoval = null;

function removePTT() {
  if (!pttMode) return;
  pttMode = false;
  if (pttActive) stopPTT();
  window.removeEventListener('keydown', el('pttBtn')._onKeyDown, true);
  window.removeEventListener('keyup', el('pttBtn')._onKeyUp, true);
  el('pttBtn').onmousedown = null;
  el('pttBtn').onmouseup = null;
  el('pttBtn').onmouseleave = null;
  el('pttBtn').style.display = 'none';
  clearTimeout(timeoutPTTRemoval);
  micOn = micMode === 'normal' ? prevMicOn : false;
  if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = micOn);
  updateMicButtonUI();
  showError('');
  log('PTT mode off');
}

function toggleMicMode() {
  // Enter PTT mode from normal mode
  if (micMode !== 'normal') return;
  prevMicOn = micOn;
  micMode = 'ptt';
  micOn = false;
  if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = false);
  updatePTTUI();
  updateMicButtonUI();
  localStorage.setItem('micMode', 'ptt');
}

function updatePTTUI() {
  if (micMode === 'ptt') {
    el('pttBtn').style.display = 'flex';
  } else {
    el('pttBtn').style.display = 'none';
  }
}

function updateMicButtonUI() {
  if (micMode === 'ptt') {
    el('toggleMicBtn').className = 'control-btn ptt-mode' + (pttActive ? ' active' : '');
    el('toggleMicBtn').innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg><span class="ptt-badge">PTT</span>';
  } else {
    el('toggleMicBtn').innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>';
    el('toggleMicBtn').className = 'control-btn' + (micOn ? ' active' : ' active off');
  }
}

function startPTT() {
  if (pttActive) { log('PTT start skipped — already active'); return; }
  log('PTT start');
  pttActive = true;
  micOn = true;
  if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = true);
  el('pttBtn').classList.add('active');
  el('pttBtn').style.background = '';
  el('pttBtn').style.color = '';
  updateMicButtonUI();
}

function stopPTT() {
  if (!pttActive) { log('PTT stop skipped — not active'); return; }
  log('PTT stop');
  pttActive = false;
  micOn = false;
  if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = false);
  el('pttBtn').classList.remove('active');
  updateMicButtonUI();
}

function updateCamGrid() {
  const showGrid = !sharerId && !sharingScreen && el('room').style.display !== 'none';
  if (showGrid === isCamGridActive) return;
  isCamGridActive = showGrid;
  el('faces').classList.toggle('faces-full', showGrid);
  el('screenshare-placeholder').style.display = showGrid ? 'none' : 'block';
}

// --- Remove Peer ---
function removePeer(peerId) {
  log('removePeer: ' + peerId);
  const peer = peers[peerId];
  if (peer) {
    if (peer.pc) { peer.pc.close(); }
    if (peer.screenPC) { peer.screenPC.close(); }
    if (sharerId === peerId) {
      sharerId = null;
      el('shareScreenBtn').disabled = false;
      updateControlTooltips();
      el('screenshareVideo').srcObject = null;
      el('screenshareVideo').style.display = 'none';
      el('screenshare-placeholder').style.display = 'block';
      updateCamGrid();
    }
    delete peers[peerId];
    delete peerNames[peerId];
  }
  removePeerVideo(peerId);
  if (Object.keys(peers).length === 0) {
    cleanupCall();
  }
}

function cleanupCall() {
  for (const pid of Object.keys(peers)) {
    if (peers[pid].pc) { peers[pid].pc.close(); }
    if (peers[pid].screenPC) { peers[pid].screenPC.close(); }
    delete peers[pid];
  }
  peers = {};
  peerNames = {};
  pendingPeers = [];
  pendingOffers = [];
  // Clear all peer video elements from DOM
  const facesContainer = el('remote-faces');
  if (facesContainer) facesContainer.innerHTML = '';
  sharingScreen = false;
  sharerId = null;
  isCamGridActive = false;
  el('faces').classList.remove('faces-full');
  if (screenStream) { screenStream.getTracks().forEach(t => t.stop()); screenStream = null; }
  el('screenshareVideo').srcObject = null;
  el('screenshareVideo').style.display = 'none';
  el('screenshare-placeholder').style.display = 'block';
  el('shareScreenBtn').classList.remove('sharing');
  ipcRenderer.invoke('close-panel');
  ipcRenderer.invoke('close-faces');
  ipcRenderer.invoke('close-reactions-overlay');
  stopFacesTimer();
  ipcRenderer.invoke('window-mode', 'restore');
  el('shareScreenBtn').disabled = false;
  el('chatOverlay').style.display = 'none';
  el('chatMessages').innerHTML = '';
  el('chatInput').value = '';
  updateControlTooltips();
  el('toggleCameraBtn').className = 'control-btn active';
  removePTT();
  micMode = 'normal';
  micOn = true;
  updateMicButtonUI();
}

// --- Leave ---
el('leaveBtn').onclick = () => {
  cleanupCall();
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  if (socket) { socket.close(); socket = null; }
  roomId = null; isHost = false; mySocketId = null;
  el('room').style.display = 'none';
  el('landing').style.display = 'flex';
  el('roomCodeInput').value = '';
  showError('');
};

// --- Toggle ---
camOn = true;
el('toggleCameraBtn').classList.add('active');
el('toggleCameraBtn').onclick = () => {
  camOn = !camOn;
  el('toggleCameraBtn').className = 'control-btn' + (camOn ? ' active' : ' active off');
  if (localStream) localStream.getVideoTracks().forEach(t => t.enabled = camOn);
};
micOn = true;
el('toggleMicBtn').classList.add('active');
function exitPTTMode() {
  if (micMode !== 'ptt') return;
  micMode = 'normal';
  micOn = true;
  if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = true);
  updatePTTUI();
  updateMicButtonUI();
  localStorage.setItem('micMode', 'normal');
}

el('toggleMicBtn').onclick = () => {
  if (micMode === 'normal') {
    micOn = !micOn;
    if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = micOn);
    updateMicButtonUI();
  } else {
    exitPTTMode();
  }
};
el('toggleMicBtn').oncontextmenu = (e) => {
  e.preventDefault();
  if (micMode === 'normal') {
    toggleMicMode();
  } else {
    exitPTTMode();
  }
};
updateMicButtonUI();

window.addEventListener('auxclick', (e) => {
  if (e.button === 1) { e.preventDefault(); log('Middle-click → toggle fullscreen'); ipcRenderer.send('toggle-fullscreen'); }
}, true);

// --- Modals ---
function closeAllModals() {
  ['helpModal', 'releaseNotesModal', 'settingsModal', 'shortcutPromptModal'].forEach(id => {
    const m = el(id); if (m) m.style.display = 'none';
  });
}
el('helpBtn').onclick = () => { closeAllModals(); el('helpModal').style.display = 'flex'; };
el('closeHelpBtn').onclick = () => el('helpModal').style.display = 'none';
el('helpModal').onclick = (e) => { if (e.target === el('helpModal')) el('helpModal').style.display = 'none'; };
ipcRenderer.on('show-help', () => { closeAllModals(); el('helpModal').style.display = 'flex'; setLang(currentLang); });
// External links
document.addEventListener('click', (e) => {
  const link = e.target.closest('.easter-link');
  if (link) { e.preventDefault(); ipcRenderer.invoke('open-url', link.href); }
});

el('closeReleaseBtn').onclick = () => el('releaseNotesModal').style.display = 'none';
el('releaseNotesModal').onclick = (e) => { if (e.target === el('releaseNotesModal')) el('releaseNotesModal').style.display = 'none'; };
ipcRenderer.on('show-release-notes', () => { closeAllModals(); el('releaseNotesModal').style.display = 'flex'; setLang(currentLang); });

el('closeSettingsBtn').onclick = () => el('settingsModal').style.display = 'none';
el('settingsModal').onclick = (e) => { if (e.target === el('settingsModal')) el('settingsModal').style.display = 'none'; };
ipcRenderer.on('show-settings', () => { closeAllModals(); el('settingsModal').style.display = 'flex'; setLang(currentLang); });
ipcRenderer.on('close-all-modals', closeAllModals);

// Deep link handler: hamsters://join?code=XXXX
ipcRenderer.on('deep-link', (event, url) => {
  try {
    const params = new URL(url).searchParams;
    const code = params.get('code');
    if (code) {
      el('roomCodeInput').value = code;
      el('joinRoomBtn').click();
    }
  } catch(e) {}
});

// Settings - Window Mode
document.querySelectorAll('[data-window]').forEach(btn => {
  btn.onclick = () => {
    const mode = btn.getAttribute('data-window');
    ipcRenderer.invoke('window-mode', mode);
  };
});

// Settings - Language
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.onclick = () => {
    setLang(btn.getAttribute('data-lang'));
  };
});

// Settings - Quality
document.querySelectorAll('.quality-btn').forEach(btn => {
  btn.onclick = () => {
    qualityLevel = btn.getAttribute('data-quality');
    localStorage.setItem('qualityLevel', qualityLevel);
    document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    syncQuality();
  };
});
if (qualityLevel) {
  const activeBtn = document.querySelector(`.quality-btn[data-quality="${qualityLevel}"]`);
  if (activeBtn) activeBtn.classList.add('active');
}

// Settings - Relay
document.querySelectorAll('.relay-btn').forEach(btn => {
  btn.onclick = () => {
    useRelay = btn.getAttribute('data-relay') === 'on';
    localStorage.setItem('useRelay', useRelay);
    document.querySelectorAll('.relay-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };
});
const relayBtn = document.querySelector(`.relay-btn[data-relay="${useRelay ? 'on' : 'off'}"]`);
if (relayBtn) relayBtn.classList.add('active');

// Settings - Desktop Shortcut
window.createDesktopShortcut = async () => {
  const ok = await ipcRenderer.invoke('create-desktop-shortcut');
  if (ok) showToast(t('settings.shortcut_created') || 'Ярлык создан на рабочем столе');
  else showToast(t('settings.shortcut_failed') || 'Ошибка создания ярлыка');
};

// Donate links - open in system browser
el('donateLinkBoosty').onclick = () => {
  ipcRenderer.invoke('open-url', 'https://boosty.to/outmilker');
};
el('donateLinkCloud').onclick = () => {
  ipcRenderer.invoke('open-url', 'https://pay.cloudtips.ru/p/8485a55c');
};

// --- Panel ---
let panelTimer = null;

function startPanelTimer() {
  if (panelTimer) clearInterval(panelTimer);
  panelTimer = setInterval(() => {
    ipcRenderer.send('panel-update', {
      micOn, camOn, micMode, pttActive, sharingScreen
    });
  }, 500);
}

function stopPanelTimer() {
  if (panelTimer) { clearInterval(panelTimer); panelTimer = null; }
}

// --- Faces Window Timer ---
let facesTimer = null;

function startFacesTimer() {
  if (facesTimer) clearInterval(facesTimer);
  facesTimer = setInterval(() => {
    const frames = [];
    // Local face
    const localVideo = el('localVideo');
    if (localVideo && localVideo.srcObject && localVideo.readyState >= 2) {
      const c = document.createElement('canvas');
      c.width = localVideo.videoWidth || 160;
      c.height = localVideo.videoHeight || 120;
      c.getContext('2d').drawImage(localVideo, 0, 0);
      frames.push({ id: '_local', data: c.toDataURL('image/jpeg', 0.3), isLocal: true });
    } else {
      frames.push({ id: '_local', data: '', isLocal: true });
    }
    // Remote faces
    document.querySelectorAll('#remote-faces video').forEach(v => {
      if (v.srcObject && v.readyState >= 2) {
        const c = document.createElement('canvas');
        c.width = v.videoWidth || 160;
        c.height = v.videoHeight || 120;
        c.getContext('2d').drawImage(v, 0, 0);
        const pid = v.dataset.peerId || '';
      frames.push({ id: pid, data: c.toDataURL('image/jpeg', 0.3), name: peerNames[pid] || '' });
      } else {
        const pid = v.dataset.peerId || '';
        frames.push({ id: pid, data: '', name: peerNames[pid] || '' });
      }
    });
    ipcRenderer.send('faces-frames', frames);
  }, 200);
}

function stopFacesTimer() {
  if (facesTimer) { clearInterval(facesTimer); facesTimer = null; }
}

// Faces volume change listener
ipcRenderer.on('faces-volume', (event, data) => {
  const video = document.querySelector(`#remote-faces video[data-peer-id="${data.peerId}"]`);
  if (video) video.volume = data.volume;
});

// Faces mic volume change listener (local mic)
ipcRenderer.on('faces-mic-volume', (event, data) => {
  const vol = Math.max(0, Math.min(1, data.volume));
  localStorage.setItem('micVolume', Math.round(vol * 100));
  const track = localStream ? localStream.getAudioTracks()[0] : null;
  if (track) {
    try { track.applyConstraints({ advanced: [{ gain: vol }] }); } catch(e) {}
  }
});

// Panel action listener
ipcRenderer.on('panel-action', (event, action) => {
  if (action === '__ping__') return;
  if (action === 'toggle-mic') {
    if (micMode === 'normal') {
      micOn = !micOn;
      if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = micOn);
      updateMicButtonUI();
    } else {
      micMode = 'normal'; micOn = true;
      if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = true);
      updatePTTUI(); updateMicButtonUI();
      localStorage.setItem('micMode', 'normal');
    }
  } else if (action === 'toggle-mic-mode') {
    if (micMode === 'normal') {
      micMode = 'ptt'; micOn = false;
      if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = false);
      updatePTTUI(); updateMicButtonUI();
      localStorage.setItem('micMode', 'ptt');
    } else {
      micMode = 'normal'; micOn = true;
      if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = true);
      updatePTTUI(); updateMicButtonUI();
      localStorage.setItem('micMode', 'normal');
    }
  } else if (action === 'toggle-cam') {
    camOn = !camOn;
    el('toggleCameraBtn').className = 'control-btn' + (camOn ? ' active' : ' active off');
    if (localStream) localStream.getVideoTracks().forEach(t => t.enabled = camOn);
  } else if (action === 'toggle-screen') {
    if (sharingScreen) stopScreenShare(); else el('shareScreenBtn').onclick();
  } else if (action === 'open-ptt') {
    startPTT();
  } else if (action === 'close-ptt') {
    stopPTT();
  } else if (action === 'leave') {
    el('leaveBtn').onclick();
  } else if (action === 'show-chat') {
    el('chatOverlay').style.display = 'flex';
    el('chatInput').focus();
  } else if (action === 'show-reaction') {
    el('reactionPicker').style.display = 'flex';
  }
});

ipcRenderer.on('faces-send-chat', (event, text) => {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-msg';
  msgDiv.innerHTML = '<span class="chat-msg-author">' + escapeHtml(userName || 'РЇ') + '</span><span class="chat-msg-text">' + escapeHtml(text) + '</span>';
  el('chatMessages').appendChild(msgDiv);
  el('chatMessages').scrollTop = el('chatMessages').scrollHeight;
  if (socket && socket.connected) {
    socket.emit('chat-message', { text: text, name: userName || 'РЇ' });
  }
});

ipcRenderer.on('faces-send-reaction', (event, emoji) => {
  showReaction(emoji);
  if (socket && socket.connected) {
    socket.emit('reaction', { emoji: emoji });
  }
  try { ipcRenderer.send('forward-reaction', emoji); } catch(e) {}
});

// Start panel timer when sharing starts, stop when sharing stops
// (panel timer checks sharingScreen, so it's safe to always run)
startPanelTimer();

initLang();
applyModeUI();
// Init PTT mode early (works without localStream)
setupPTT();

// Name prompt
function showNameModal(prefill) {
  const modal = document.getElementById('namePromptModal');
  const input = document.getElementById('nameInput');
  if (input) input.value = prefill || '';
  if (modal) modal.style.display = 'flex';
  if (input) setTimeout(() => { input.focus(); input.select(); }, 100);
}
function applyName(val) {
  if (val && val.trim()) { userName = val.trim(); localStorage.setItem('userName', val.trim()); }
  else { userName = getRandomName(); }
  document.getElementById('namePromptModal').style.display = 'none';
  updateNameDisplay();
}
function updateNameDisplay() {
  const display = document.getElementById('nameDisplay');
  if (display) display.textContent = userName;
  const localLabel = document.querySelector('#localFace .face-label');
  if (localLabel) localLabel.textContent = userName;
}
if (!ensureUserName()) showNameModal('');
else updateNameDisplay();
document.getElementById('nameConfirm').onclick = () => {
  applyName(document.getElementById('nameInput').value);
};
document.getElementById('nameSkip').onclick = () => {
  applyName('');
};
document.getElementById('nameInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('nameConfirm').click();
});
document.getElementById('namePromptModal').onclick = (e) => {
  if (e.target === document.getElementById('namePromptModal')) applyName('');
};
document.getElementById('nameEditBtn').onclick = () => {
  showNameModal(userName);
};

// Chat
el('chatBtn').onclick = () => {
  el('chatOverlay').style.display = 'flex';
  setTimeout(() => el('chatInput').focus(), 100);
};
el('chatOverlay').onclick = (e) => { if (e.target === el('chatOverlay')) el('chatOverlay').style.display = 'none'; };
el('chatCloseBtn').onclick = () => el('chatOverlay').style.display = 'none';
el('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
el('chatSendBtn').onclick = sendChat;
function sendChat() {
  const input = el('chatInput');
  const text = input.value.trim();
  if (!text || !socket) return;
  input.value = '';
  const elMsg = document.createElement('div');
  elMsg.className = 'chat-msg chat-msg-self';
  elMsg.innerHTML = '<span class="chat-msg-text">' + escapeHtml(text) + '</span>';
  el('chatMessages').appendChild(elMsg);
  el('chatMessages').scrollTop = el('chatMessages').scrollHeight;
  try { ipcRenderer.send('main-chat-send', text); } catch(e) {}
  socket.emit('chat-message', { text: text, name: userName || 'РЇ' });
}
function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Reactions
el('reactionBtn').onclick = () => {
  el('reactionPicker').style.display = el('reactionPicker').style.display === 'flex' ? 'none' : 'flex';
};
document.querySelectorAll('.reaction-emoji').forEach(btn => {
  btn.onclick = () => {
    const emoji = btn.dataset.emoji;
    showReaction(emoji);
    if (socket && socket.connected) socket.emit('reaction', { emoji: emoji });
    try { ipcRenderer.send('forward-reaction', emoji); } catch(e) {}
  };
});
el('reactionClose').onclick = () => { el('reactionPicker').style.display = 'none'; };
function showReaction(emoji) {
  const elm = document.createElement('div');
  elm.className = 'reaction-float';
  elm.textContent = emoji;
  elm.style.left = (10 + Math.random() * 80) + '%';
  elm.style.bottom = (50 + Math.random() * 50) + 'px';
  elm.style.animation = 'floatBubble ' + (5 + Math.random() * 3) + 's cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';
  document.body.appendChild(elm);
  setTimeout(() => elm.remove(), 8500);
}

// First-launch shortcut prompt (shows once per version)
(function() {
  const ver = '1.8.0';
  // Set version in UI
  const verEls = document.querySelectorAll('#versionDisplay, .modal-version, title');
  verEls.forEach(el => {
    if (el.tagName === 'TITLE') el.textContent = 'TV Hamsters (v' + ver + ')';
    else el.textContent = 'v' + ver;
  });
  if (localStorage.getItem('shortcutPrompted') === ver) return;
  const modal = document.getElementById('shortcutPromptModal');
  if (!modal) return;
  setTimeout(() => { modal.style.display = 'flex'; }, 500);
  function close() { modal.style.display = 'none'; }
  function done(skipReminder) {
    close();
    localStorage.setItem('shortcutPrompted', ver);
    if (!skipReminder) setTimeout(() => showToast(t('shortcut.reminder')), 600);
  }
  document.getElementById('shortcutYes').onclick = async () => {
    await window.createDesktopShortcut();
    done();
  };
  document.getElementById('shortcutNo').onclick = () => done();
  document.getElementById('shortcutDontAsk').onclick = () => {
    localStorage.setItem('shortcutPrompted', ver);
    done(true);
  };
  modal.onclick = (e) => { if (e.target === modal) done(); };
})();

setTimeout(() => { try { setLang(currentLang); } catch(e) {} }, 100);
