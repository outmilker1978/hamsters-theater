const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);
const http = require('http');
const { Server } = require('socket.io');

const token = '8776055170:AAE04MU921tF1wteiHPERxotIL8l69W9eow';
const PORT = process.env.PORT || 3001;
const DL_URL = 'https://tvhamsters.outmilk.online';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('TV Hamsters OK');
});
server.listen(PORT, () => console.log('Server on port', PORT));

// WebSocket signaling for the desktop app
const io = new Server(server, { cors: { origin: '*' } });
const rooms = {};
io.on('connection', (socket) => {
  console.log('[Signal] connected:', socket.id);
  socket.on('create-room', () => {
    const roomId = String(Math.floor(1000 + Math.random() * 9000));
    rooms[roomId] = [socket.id];
    socket.join(roomId);
    socket.roomId = roomId;
    socket.emit('room-created', roomId);
  });
  socket.on('join-room', (roomId) => {
    if (!rooms[roomId]) { socket.emit('error-msg', 'Комната не найдена'); return; }
    if (rooms[roomId].length >= 5) { socket.emit('error-msg', 'Комната уже заполнена'); return; }
    rooms[roomId].push(socket.id);
    socket.join(roomId);
    socket.roomId = roomId;
    socket.emit('joined', roomId);
    socket.emit('room-users', rooms[roomId].filter(id => id !== socket.id));
    socket.to(roomId).emit('user-joined', socket.id);
    socket.to(roomId).emit('peer-joined', socket.id);
  });
  socket.on('chat-message', (data) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('chat-message', { from: socket.id, text: data.text, name: data.name || 'Хомячок', time: Date.now() });
    }
  });
  socket.on('reaction', (data) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('reaction', { emoji: data.emoji, from: socket.id });
    }
  });
  socket.on('offer', (data) => { socket.to(data.to).emit('offer', { from: socket.id, sdp: data.sdp, type: data.type, name: data.name }); });
  socket.on('answer', (data) => { socket.to(data.to).emit('answer', { from: socket.id, sdp: data.sdp, type: data.type, name: data.name }); });
  socket.on('ice-candidate', (data) => { socket.to(data.to).emit('ice-candidate', { from: socket.id, candidate: data.candidate, type: data.type }); });
  socket.on('signal', (data) => { socket.to(data.to).emit('signal', { from: socket.id, type: data.signalType, hasAudio: data.hasAudio, name: data.name }); });
  socket.on('disconnect', () => {
    delete socket.roomId;
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

const proxy = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || '';
const botOpts = { polling: true };
if (proxy) {
  const HttpsProxyAgent = require('https-proxy-agent');
  botOpts.request = { agent: new HttpsProxyAgent(proxy) };
}

const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(token, botOpts);

bot.setMyCommands([
  { command: 'start', description: '\u0413\u043B\u0430\u0432\u043D\u043E\u0435 \u043C\u0435\u043D\u044E' },
  { command: 'room', description: '\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u043E\u043C\u043D\u0430\u0442\u0443' },
  { command: 'help', description: '\u041A\u0430\u043A \u044D\u0442\u043E \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442' },
  { command: 'download', description: '\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0443' },
]);

const menuKeyboard = {
  reply_markup: {
    keyboard: [
      ['+ \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u043E\u043C\u043D\u0430\u0442\u0443'],
      ['\u041A\u0430\u043A \u044D\u0442\u043E \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442', '\u0421\u043A\u0430\u0447\u0430\u0442\u044C'],
    ],
    resize_keyboard: true,
  },
};

function createRoom() {
  let code;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (rooms[code]);
  rooms[code] = [];
  return code;
}

async function sendRoom(chatId) {
  const code = createRoom();
  const link = DL_URL + '/join?code=' + code;
  await bot.sendMessage(chatId,
    '\uD83D\uDC3A <b>TV Hamsters</b>\n'
    + '\u2695 \u041F\u0430\u043B\u0430\u0442\u0430 \u2116 <b>' + code + '</b>\n\n'
    + '\u0427\u0442\u043E\u0431\u044B \u0432\u043E\u0439\u0442\u0438, \u043D\u0430\u0436\u043C\u0438 \u043D\u0430 \u0441\u0441\u044B\u043B\u043A\u0443:\n'
    + '<a href="' + link + '">\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u0430\u043B\u0430\u0442\u0443 \u2116 ' + code + '</a>\n\n'
    + '\u041F\u0435\u0440\u0435\u0448\u043B\u0438 \u044D\u0442\u043E \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0434\u0440\u0443\u0437\u044C\u044F\u043C \u2014 \u043F\u0443\u0441\u0442\u044C \u0442\u043E\u0436\u0435 \u043F\u043E\u0434\u0442\u044F\u0433\u0438\u0432\u0430\u044E\u0442\u0441\u044F.',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '\u2B07 \u0421\u043A\u0430\u0447\u0430\u0442\u044C \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0443', url: DL_URL }],
        ],
      },
    }
  );
}

function onStart(msg) {
  const name = msg.from.first_name || '\u0425\u043E\u043C\u044F\u0447\u043E\u043A';
  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
  if (isGroup) {
    bot.sendMessage(msg.chat.id,
      '\u041F\u0440\u0438\u0432\u0435\u0442! \u042F \u0431\u043E\u0442 TV Hamsters \uD83D\uDC3A\u200D\u2728\n\n'
      + '\u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u00AB\u043A\u0438\u043D\u043E\u00BB \u0438\u043B\u0438 /room \u2014 \u044F \u0441\u043E\u0437\u0434\u0430\u043C \u043A\u043E\u043C\u043D\u0430\u0442\u0443.\n\n'
      + '\u041A\u043B\u0438\u043A \u043F\u043E \u043A\u043D\u043E\u043F\u043A\u0435 \u043E\u0442\u043A\u0440\u043E\u0435\u0442 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0443 TV Hamsters \u043D\u0430 \u043A\u043E\u043C\u043F\u0435.',
      { parse_mode: 'HTML' }
    );
  } else {
    bot.sendMessage(msg.chat.id,
      '\u041F\u0440\u0438\u0432\u0435\u0442, ' + name + '! \uD83D\uDC3A\n\n'
      + '\u042D\u0442\u043E \u0431\u043E\u0442 <b>TV Hamsters</b> \u2014 \u0441\u043C\u043E\u0442\u0440\u0438\u0442\u0435 \u0432\u0438\u0434\u0435\u043E \u0432\u043C\u0435\u0441\u0442\u0435 \u0447\u0435\u0440\u0435\u0437 \u0432\u0438\u0434\u0435\u043E\u0437\u0432\u043E\u043D\u043E\u043A.\n\n'
      + '\u041D\u0430\u0436\u0438\u043C\u0430\u0439 \u043A\u043D\u043E\u043F\u043A\u0438 \u0432\u043D\u0438\u0437\u0443 \u2014 \u0432\u0441\u0451 \u043F\u0440\u043E\u0441\u0442\u043E.\n\n'
      + '\u0425\u043E\u0447\u0435\u0448\u044C \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043C\u0435\u043D\u044F \u0432 \u0433\u0440\u0443\u043F\u043F\u0443?\n'
      + '\u041E\u0442\u043A\u0440\u043E\u0439 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0433\u0440\u0443\u043F\u043F\u044B \u2192 \u0410\u0434\u043C\u0438\u043D\u044B \u2192 \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0430\u0434\u043C\u0438\u043D\u0430 \u2192 \u043F\u043E\u0438\u0441\u043A @tv_hamsters_bot',
      { parse_mode: 'HTML', ...menuKeyboard }
    );
  }
}

bot.onText(/\/start/, onStart);

bot.onText(/\/room/, async (msg) => {
  await sendRoom(msg.chat.id);
});

bot.onText(/\/help|\u043A\u0430\u043A|\u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442/i, (msg) => {
  if (msg.text && msg.text.startsWith('/help')) {
  } else if (msg.text && !msg.text.match(/\u043A\u0430\u043A|\u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442/i)) {
    return;
  }
  bot.sendMessage(msg.chat.id,
    '\u041A\u0430\u043A \u044D\u0442\u043E \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442:\n\n'
    + '1\uFE0F\u20E3 \u041D\u0430\u043F\u0438\u0448\u0438 /room \u0438\u043B\u0438 \u043D\u0430\u0436\u043C\u0438 \u00AB\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u043E\u043C\u043D\u0430\u0442\u0443\u00BB\n'
    + '2\uFE0F\u20E3 \u041F\u043E\u043B\u0443\u0447\u0438 \u043A\u043D\u043E\u043F\u043A\u0443 \u0441\u043E \u0441\u0441\u044B\u043B\u043A\u043E\u0439 hamsters://\n'
    + '3\uFE0F\u20E3 \u041A\u043B\u0438\u043A\u043D\u0438 \u0438\u043B\u0438 \u043F\u0435\u0440\u0435\u0448\u043B\u0438 \u0434\u0440\u0443\u0437\u044C\u044F\u043C \u2014 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u043E\u0442\u043A\u0440\u043E\u0435\u0442\u0441\u044F \u0441\u0430\u043C\u0430\n\n'
    + '\u0412 \u043A\u043E\u043C\u043D\u0430\u0442\u0435 \u043C\u043E\u0436\u043D\u043E \u0433\u043E\u0432\u043E\u0440\u0438\u0442\u044C \u0433\u043E\u043B\u043E\u0441\u043E\u043C, \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043A\u0430\u043C\u0435\u0440\u0443 \u0438 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u044D\u043A\u0440\u0430\u043D.\n\n'
    + '\u041A\u043E\u043C\u043D\u0430\u0442\u0430 \u0436\u0438\u0432\u0451\u0442, \u043F\u043E\u043A\u0430 \u043A\u0442\u043E-\u0442\u043E \u0432 \u043D\u0435\u0439 \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u0441\u044F.'
  );
});

bot.onText(/\/download|\u0441\u043A\u0430\u0447\u0430\u0442\u044C/i, (msg) => {
  if (msg.text && !msg.text.match(/\/download|\u0441\u043A\u0430\u0447\u0430\u0442\u044C/i)) return;
  bot.sendMessage(msg.chat.id,
    '\u0421\u043A\u0430\u0447\u0430\u0439 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0443 TV Hamsters:\n\n'
    + DL_URL + '\n\n'
    + '\u041F\u0440\u043E\u0441\u0442\u043E \u043E\u0442\u043A\u0440\u043E\u0439 \u0441\u0441\u044B\u043B\u043A\u0443 \u043D\u0430 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0435 \u0438\u043B\u0438 \u043A\u043E\u043C\u043F\u0435 \u2014 \u0441\u043A\u0430\u0447\u0430\u0435\u0448\u044C .exe, \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0448\u044C \u0431\u0435\u0437 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438.',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '\u2B07 \u0421\u043A\u0430\u0447\u0430\u0442\u044C \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0443', url: DL_URL }],
        ],
      },
    }
  );
});

// Group auto-response: keywords trigger room creation
const groupKeywords = /\u043A\u0438\u043D\u043E|\u0444\u0438\u043B\u044C\u043C|\u043F\u043E\u0441\u043C\u043E\u0442\u0440|\u0432\u043C\u0435\u0441\u0442\u0435|\u043F\u0430\u043B\u0430\u0442\u0430|\u0441\u043E\u0431\u0435\u0440\u0451\u043C\u0441\u044F|\u043F\u043E\u0441\u0438\u0434\u0435\u0442\u044C|\u0432\u0438\u0434\u0435\u043E|\u0442\u0440\u0430\u043D\u0441\u043B\u044F\u0446\u0438|\u0445\u043E\u043C\u044F\u043A|\u043E\u0442\u043A\u0440\u044B\u0442\u044C|\u043F\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C|\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C|\u0431\u0443\u0434\u0435\u043C|\u0433\u043E\u0432\u043E\u0440\u0438\u0442\u044C|\u0441\u043E\u0437\u0434\u0430\u0439/i;

// Catch-all: button presses and group auto-reply
bot.on('message', (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  const txt = msg.text.toLowerCase();
  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

  if (isGroup) {
    if (txt.match(groupKeywords)) {
      sendRoom(msg.chat.id).catch(() => {});
    }
    return;
  }

  // Private chat: menu buttons
  if (txt.includes('\u043A\u043E\u043C\u043D\u0430\u0442') || txt === '+') {
    sendRoom(msg.chat.id).catch(() => {});
    return;
  }
  if (txt.includes('\u043A\u0430\u043A') || txt.includes('\u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442')) return;
  if (txt.includes('\u0441\u043A\u0430\u0447\u0430\u0442\u044C')) return;
  onStart(msg);
});

console.log('Bot started');

process.on('unhandledRejection', (err) => {
  console.log('Unhandled rejection:', err?.message || err);
});

const httpsKeepAlive = require('https');
const SELF_URL = process.env.RENDER_EXTERNAL_URL || 'https://tv-hamsters-bot.onrender.com';
setInterval(() => {
  httpsKeepAlive.get(SELF_URL, (res) => {
    console.log('Keep-alive ping, status:', res.statusCode);
  }).on('error', (err) => {
    console.log('Keep-alive error:', err?.message || err);
  });
}, 10 * 60 * 1000);
