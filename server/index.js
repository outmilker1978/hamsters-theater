const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Net Theater Signaling Server\n');
});

const io = new Server(server, { cors: { origin: '*' } });

const rooms = {};

io.on('connection', (socket) => {
  socket.on('create-room', () => {
    const roomId = Math.random().toString(36).substring(2, 8);
    rooms[roomId] = [socket.id];
    socket.join(roomId);
    socket.emit('room-created', roomId);
  });

  socket.on('join-room', (roomId) => {
    if (!rooms[roomId]) {
      socket.emit('error-msg', 'Комната не найдена');
      return;
    }
    if (rooms[roomId].length >= 2) {
      socket.emit('error-msg', 'Комната уже заполнена');
      return;
    }
    rooms[roomId].push(socket.id);
    socket.join(roomId);
    socket.emit('joined', roomId);
    socket.to(roomId).emit('peer-joined', socket.id);
  });

  socket.on('offer', (data) => {
    console.log(`[Server] offer: type=${data.type} from=${socket.id} to=${data.to}`);
    socket.to(data.to).emit('offer', { from: socket.id, sdp: data.sdp, type: data.type });
  });

  socket.on('answer', (data) => {
    console.log(`[Server] answer: type=${data.type} from=${socket.id} to=${data.to}`);
    socket.to(data.to).emit('answer', { from: socket.id, sdp: data.sdp, type: data.type });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.to).emit('ice-candidate', { from: socket.id, candidate: data.candidate, type: data.type });
  });

  socket.on('signal', (data) => {
    console.log(`[Server] signal: type=${data.signalType} from=${socket.id} to=${data.to}`);
    socket.to(data.to).emit('signal', { from: socket.id, type: data.signalType });
  });

  socket.on('disconnect', () => {
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
server.listen(PORT, () => console.log('Signaling server running on port', PORT));
