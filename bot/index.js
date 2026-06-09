const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);
const { io } = require('socket.io-client');
const http = require('http');

const token = '8776055170:AAE04MU921tF1wteiHPERxotIL8l69W9eow';
const CLOUD_SERVER = 'https://hamsters-theater-cloud.onrender.com';
const PORT = process.env.PORT || 3001;
const DL_URL = 'https://tvhamsters.outmilk.online';

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('TV Hamsters Bot OK');
}).listen(PORT, () => console.log('Health server on port', PORT));

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
  return new Promise((resolve, reject) => {
    const socket = io(CLOUD_SERVER, { transports: ['websocket'], timeout: 25000 });
    socket.on('connect', () => { socket.emit('create-room'); });
    socket.on('room-created', (id) => { socket.disconnect(); resolve(id); });
    socket.on('connect_error', (err) => { reject(err); });
    setTimeout(() => { socket.disconnect(); reject(new Error('timeout')); }, 25000);
  });
}

function onStart(msg) {
  const name = msg.from.first_name || '\u0425\u043E\u043C\u044F\u0447\u043E\u043A';
  bot.sendMessage(msg.chat.id,
    '\u041F\u0440\u0438\u0432\u0435\u0442, ' + name + '! \u042D\u0442\u043E \u0431\u043E\u0442 TV Hamsters.\n\n'
    + '\u042F \u043F\u043E\u043C\u043E\u0433\u0430\u044E \u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u0432\u0438\u0434\u0435\u043E \u0432\u043C\u0435\u0441\u0442\u0435 \u043F\u043E \u0432\u0438\u0434\u0435\u043E\u0437\u0432\u043E\u043D\u043A\u0443.\n\n'
    + '\u041D\u0430\u0436\u0438\u043C\u0430\u0439 \u043A\u043D\u043E\u043F\u043A\u0438 \u0432\u043D\u0438\u0437\u0443 \u2014 \u0432\u0441\u0451 \u043F\u0440\u043E\u0441\u0442\u043E.',
    menuKeyboard
  );
}

bot.onText(/\/start/, onStart);

bot.onText(/\/room|^\+\s|\u043A\u043E\u043C\u043D\u0430\u0442\u0443$/i, async (msg) => {
  if (msg.text && msg.text.startsWith('/')) {
  } else if (msg.text && !msg.text.includes('\u041A\u043E\u043C\u043D\u0430\u0442\u0443')) {
    return;
  }
  const chatId = msg.chat.id;
  const sent = await bot.sendMessage(chatId, '\u0421\u043E\u0437\u0434\u0430\u044E \u043F\u0430\u043B\u0430\u0442\u0443... \u0441\u0435\u0439\u0447\u0430\u0441 \u0432\u0441\u0451 \u0431\u0443\u0434\u0435\u0442 \u2665');
  try {
    const code = await createRoom();
    const link = 'hamsters://join?code=' + code;
    await bot.editMessageText(
      '\u2705 \u041F\u0430\u043B\u0430\u0442\u0430 \u2116 ' + code + ' \u0433\u043E\u0442\u043E\u0432\u0430!\n\n'
      + '\u0427\u0442\u043E \u0434\u0430\u043B\u044C\u0448\u0435:\n'
      + '1. \u041D\u0430\u0436\u043C\u0438 \u00AB\u041E\u0442\u043A\u0440\u044B\u0442\u044C\u00BB \u043D\u0438\u0436\u0435\n'
      + '2. \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0441\u044F \u0438 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0441\u044F\n'
      + '3. \u041E\u0442\u043F\u0440\u0430\u0432\u044C \u044D\u0442\u0443 \u0436\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u0434\u0440\u0443\u0437\u044C\u044F\u043C \u2014 \u043F\u0443\u0441\u0442\u044C \u0442\u043E\u0436\u0435 \u043D\u0430\u0436\u043C\u0443\u0442 \u00AB\u041E\u0442\u043A\u0440\u044B\u0442\u044C\u00BB',
      {
        chat_id: chatId,
        message_id: sent.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: '\u25B6 \u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u043E\u043C\u043D\u0430\u0442\u0443', url: link }],
            [{ text: '\u041D\u0443\u0436\u043D\u0430 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430? \u0421\u043A\u0430\u0447\u0430\u0442\u044C', url: DL_URL }],
          ],
        },
      }
    );
  } catch (e) {
    await bot.editMessageText(
      '\u041D\u0435 \u043F\u043E\u043B\u0443\u0447\u0438\u043B\u043E\u0441\u044C \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u043E\u043C\u043D\u0430\u0442\u0443.\n'
      + '\u041E\u0431\u043B\u0430\u0447\u043D\u044B\u0439 \u0441\u0435\u0440\u0432\u0435\u0440 \u043F\u0440\u043E\u0441\u044B\u043F\u0430\u0435\u0442\u0441\u044F... \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0435\u0449\u0451 \u0440\u0430\u0437\u043E\u043A \u0447\u0435\u0440\u0435\u0437 5 \u0441\u0435\u043A\u0443\u043D\u0434.',
      { chat_id: chatId, message_id: sent.message_id }
    );
  }
});

bot.onText(/\/help|\u043A\u0430\u043A|\u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442/i, (msg) => {
  if (msg.text && msg.text.startsWith('/help')) {
  } else if (msg.text && !msg.text.match(/\u043A\u0430\u043A|\u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442/i)) {
    return;
  }
  bot.sendMessage(msg.chat.id,
    '\u041A\u0430\u043A \u044D\u0442\u043E \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442:\n\n'
    + '1\uFE0F\u20E3 \u0422\u044B \u0438\u043B\u0438 \u0434\u0440\u0443\u0433 \u043D\u0430\u0436\u0438\u043C\u0430\u0435\u0442\u0435 \u00AB\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u043E\u043C\u043D\u0430\u0442\u0443\u00BB\n'
    + '2\uFE0F\u20E3 \u041F\u043E\u043B\u0443\u0447\u0430\u0435\u0442\u0435 \u0441\u0441\u044B\u043B\u043A\u0443 \u0438 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u0442\u0435 \u0435\u0451 \u0434\u0440\u0443\u0433\u0443\n'
    + '3\uFE0F\u20E3 \u041E\u0431\u0430 \u043D\u0430\u0436\u0438\u043C\u0430\u0435\u0442\u0435 \u00AB\u041E\u0442\u043A\u0440\u044B\u0442\u044C\u00BB \u2014 \u0438 \u0432\u044B \u0432 \u043A\u043E\u043C\u043D\u0430\u0442\u0435\n\n'
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

// Catch-all: any text message that isn't a command shows menu
bot.on('message', (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  const txt = msg.text.toLowerCase();
  if (txt.includes('\u043A\u043E\u043C\u043D\u0430\u0442') || txt === '+') {
    return;
  }
  onStart(msg);
});

console.log('Bot started');
