const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hamsters Theater Cloud Server\n');
});

const io = new Server(server, { cors: { origin: '*' } });
const rooms = {};

io.on('connection', (socket) => {
  console.log('[Cloud] connected:', socket.id);

  socket.on('create-room', () => {
    const roomId = String(Math.floor(1000 + Math.random() * 9000));
    console.log('[Cloud] create-room: roomId=' + roomId + ' socket=' + socket.id);
    rooms[roomId] = [socket.id];
    socket.join(roomId);
    socket.emit('room-created', roomId);
  });

  socket.on('join-room', (roomId) => {
    console.log('[Cloud] join-room: roomId=' + roomId + ' rooms=' + JSON.stringify(Object.keys(rooms)));
    socket.emit('server-log', '[Cloud] join-room: roomId=' + roomId + ' rooms=' + JSON.stringify(Object.keys(rooms)));
    if (!rooms[roomId]) { socket.emit('error-msg', 'Комната не найдена'); return; }
    if (rooms[roomId].length >= 5) { socket.emit('error-msg', 'Комната уже заполнена'); return; }
    rooms[roomId].push(socket.id);
    socket.join(roomId);
    socket.emit('joined', roomId);
    const others = rooms[roomId].filter(id => id !== socket.id);
    socket.emit('room-users', others);
    socket.to(roomId).emit('user-joined', socket.id);
    socket.to(roomId).emit('peer-joined', socket.id);
  });

  socket.on('offer', (data) => {
    socket.to(data.to).emit('offer', { from: socket.id, sdp: data.sdp, type: data.type });
  });

  socket.on('answer', (data) => {
    socket.to(data.to).emit('answer', { from: socket.id, sdp: data.sdp, type: data.type });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.to).emit('ice-candidate', { from: socket.id, candidate: data.candidate, type: data.type });
  });

  socket.on('signal', (data) => {
    socket.to(data.to).emit('signal', { from: socket.id, type: data.signalType, hasAudio: data.hasAudio });
  });

  socket.on('disconnect', () => {
    console.log('[Cloud] disconnected:', socket.id);
    for (const roomId in rooms) {
      const idx = rooms[roomId].indexOf(socket.id);
      if (idx !== -1) {
        rooms[roomId].splice(idx, 1);
        socket.to(roomId).emit('peer-disconnected', socket.id);
        if (rooms[roomId].length === 0) delete rooms[roomId];
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('[Cloud] Hamsters Theater cloud server running on port', PORT);
});
