const fs = require('fs');
const path = require('path');
const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);
const { io } = require('socket.io-client');

const token = process.env.TELEGRAM_TOKEN || fs.readFileSync(path.join(__dirname, '..', 'token.txt'), 'utf8').trim();
const CLOUD_SERVER = 'https://hamsters-theater-cloud.onrender.com';

const proxy = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || '';
const botOpts = { polling: true };
if (proxy) {
  const HttpsProxyAgent = require('https-proxy-agent');
  botOpts.request = { agent: new HttpsProxyAgent(proxy) };
}

const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(token, botOpts);

function createRoom() {
  return new Promise((resolve, reject) => {
    const socket = io(CLOUD_SERVER, { transports: ['websocket'], timeout: 25000 });
    socket.on('connect', () => { socket.emit('create-room'); });
    socket.on('room-created', (id) => { socket.disconnect(); resolve(id); });
    socket.on('connect_error', (err) => { reject(err); });
    setTimeout(() => { socket.disconnect(); reject(new Error('timeout')); }, 25000);
  });
}

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '.. TV Hamsters Bot ..\n\n'
    + '\u041A\u043E\u043C\u0430\u043D\u0434\u044B:\n'
    + '/room - \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u043E\u043C\u043D\u0430\u0442\u0443 \u0438 \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443\n'
    + '/help - \u043F\u043E\u043C\u043E\u0449\u044C'
  );
});

bot.onText(/\/room|\/\u043A\u0438\u043D\u043E/, async (msg) => {
  const chatId = msg.chat.id;
  const sent = await bot.sendMessage(chatId, '\u0421\u043E\u0437\u0434\u0430\u044E \u043F\u0430\u043B\u0430\u0442\u0443...');
  try {
    const code = await createRoom();
    const link = 'hamsters://join?code=' + code;
    await bot.editMessageText(
      '\u041F\u0430\u043B\u0430\u0442\u0430 \u2116 ' + code + '\n\n' + link + '\n\n'
      + '\u041E\u0442\u043F\u0440\u0430\u0432\u044C \u044D\u0442\u0443 \u0441\u0441\u044B\u043B\u043A\u0443 \u0434\u0440\u0443\u0437\u044C\u044F\u043C - \u043E\u043D\u0438 \u043E\u0442\u043A\u0440\u043E\u044E\u0442 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0443 \u0438 \u0441\u0440\u0430\u0437\u0443 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u0442\u0441\u044F.',
      { chat_id: chatId, message_id: sent.message_id }
    );
  } catch (e) {
    await bot.editMessageText(
      '\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0432\u044F\u0437\u0438 \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u043E\u043C. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u043F\u043E\u0437\u0436\u0435.',
      { chat_id: chatId, message_id: sent.message_id }
    );
  }
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '1. \u041D\u0430\u043F\u0438\u0448\u0438 /room - \u0431\u043E\u0442 \u0441\u043E\u0437\u0434\u0430\u0441\u0442 \u043A\u043E\u043C\u043D\u0430\u0442\u0443 \u0438 \u043F\u0440\u0438\u0448\u043B\u0451\u0442 \u0441\u0441\u044B\u043B\u043A\u0443\n'
    + '2. \u041E\u0442\u043F\u0440\u0430\u0432\u044C \u0441\u0441\u044B\u043B\u043A\u0443 \u0434\u0440\u0443\u0437\u044C\u044F\u043C \u0432 \u0447\u0430\u0442\n'
    + '3. \u041A\u043B\u0438\u043A - \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u043E\u0442\u043A\u0440\u043E\u0435\u0442\u0441\u044F \u0441 \u0433\u043E\u0442\u043E\u0432\u044B\u043C \u043A\u043E\u0434\u043E\u043C\n\n'
    + '\u0420\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0432 \u043B\u044E\u0431\u043E\u0439 \u0433\u0440\u0443\u043F\u043F\u0435 - \u043F\u0440\u043E\u0441\u0442\u043E \u0434\u043E\u0431\u0430\u0432\u044C \u0431\u043E\u0442\u0430 \u0442\u0443\u0434\u0430.'
  );
});

console.log('Bot started');
if (proxy) console.log('Using proxy:', proxy);

// Health check for Render
const http = require('http');
const PORT = process.env.PORT || 3001;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('TV Hamsters Bot OK');
}).listen(PORT, () => console.log('Health server on port', PORT));
