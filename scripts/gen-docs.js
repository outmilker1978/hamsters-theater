const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  TableOfContents, Table, TableRow, TableCell, AlignmentType,
  widthType, BorderStyle, PageBreak
} = require('docx');

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { size: 22, font: 'Calibri' },
        paragraph: { spacing: { after: 120 } }
      }
    }
  },
  sections: [{
    properties: {},
    children: [
      new Paragraph({
        text: 'TV Hamsters',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 }
      }),
      new Paragraph({
        text: 'Документация разработчика / администратора',
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      }),
      new Paragraph({
        text: 'Версия продукта: 1.8.2',
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 }
      }),
      new Paragraph({
        text: 'Дата: июнь 2026',
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 }
      }),

      // --- 1. О продукте ---
      new Paragraph({ text: '1. О продукте', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({
        text: 'TV Hamsters — смотрите фильмы, сериалы и видео вместе онлайн. Один включает трансляцию экрана со звуком, остальные видят видео и слышат голоса всех участников. Текстовый чат, реакции-эмодзи на весь экран, скример-пасхалка. Режим рации (Push-to-Talk). До 5 участников P2P mesh. i18n RU/EN/ES.',
        spacing: { after: 200 }
      }),
      new Paragraph({
        text: 'Основные возможности: трансляция экрана со звуком (любое окно); видеозвонок с камерами всех участников; текстовый чат; emoji-реакции на весь экран; режим рации (Push-to-Talk); индикатор качества связи; скример-пасхалка в чате; плавающая панель управления при трансляции; окно камер участников (faces); ползунки громкости; i18n (RU/EN/ES); локальный (LAN) и облачный режимы.',
        spacing: { after: 300 }
      }),

      // --- 2. Технологии ---
      new Paragraph({ text: '2. Технологии', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: 'Стек:', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: '• Electron 34 — кросс-платформенная среда для десктопных приложений на веб-технологиях', spacing: { after: 60 } }),
      new Paragraph({ text: '• Socket.IO 4 — двунаправленная связь в реальном времени (signalling)', spacing: { after: 60 } }),
      new Paragraph({ text: '• WebRTC — передача видео/аудио/экрана (P2P, STUN, ICE restart)', spacing: { after: 60 } }),
      new Paragraph({ text: '• getDisplayMedia — нативный захват экрана (Chromium)', spacing: { after: 60 } }),
      new Paragraph({ text: '• nat-upnp — автоматическое открытие портов на роутере (для LAN режима)', spacing: { after: 60 } }),
      new Paragraph({ text: '• Node.js v24 — среда выполнения JavaScript', spacing: { after: 60 } }),
      new Paragraph({ text: '• electron-builder 25 — сборка портативного .exe', spacing: { after: 60 } }),
      new Paragraph({ text: '• node-telegram-bot-api — Telegram бот (команды /room, /download)', spacing: { after: 60 } }),
      new Paragraph({ text: '• docx — генерация этого документа', spacing: { after: 300 } }),

      // --- 3. Архитектура ---
      new Paragraph({ text: '3. Архитектура', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({
        text: 'Приложение имеет два режима работы: Локально (LAN) и Через Интернет (Cloud).',
        spacing: { after: 200 }
      }),
      new Paragraph({ text: 'Multi-user (до 5 участников):', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: 'Используется mesh-топология — каждый клиент создаёт отдельный RTCPeerConnection для каждого участника. Все участники соединяются напрямую друг с другом (P2P). Новый участник рассылает user-joined всем в комнате, каждый существующий создаёт offer. Screen sharing транслируется всем участникам.', spacing: { after: 200 } }),
      new Paragraph({ text: '3.1. Локальный режим', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({
        text: 'На ПК хоста запускается встроенный Socket.IO сервер на порту 3000 (или 3001, 3002... если занят). Гость подключается напрямую к хосту по его локальному IP. Все сигналы идут напрямую между ПК через локальную сеть. UPnP пытается открыть порт на роутере для внешнего доступа.',
        spacing: { after: 200 }
      }),
      new Paragraph({ text: '3.2. Облачный режим', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({
        text: 'Оба ПК подключаются к облачному сигнальному серверу на Render.com. Сервер только пересылает служебные сообщения. Видео и аудио передаются напрямую между ПК (P2P) через WebRTC и STUN серверы Google. Облачный сервер не участвует в передаче медиа.',
        spacing: { after: 200 }
      }),
      new Paragraph({ text: '3.3. Плавающая панель при трансляции', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({
        text: 'При старте трансляции экрана создаётся frameless-окно 310×78 (panel.html/panel.js) с always-on-top (уровень screen-saver). Кнопки 48×48 с SVG-иконками: камера, микрофон, рация (PTT), экран, выход. Состояние обновляется через IPC bridge каждые 500 мс. Правый клик по микрофону — переключение в режим PTT.',
        spacing: { after: 200 }
      }),
      new Paragraph({ text: '3.4. Окно камер участников (faces)', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({
        text: 'Третье BrowserWindow 300×220, bottom-right, always-on-top, с заголовком. Показывает canvas-кадры камер всех участников (отправляются через IPC, ~5 fps). Ползунки громкости для каждого. Качество связи: цветная точка (зелёный/жёлтый/красный/серый). Создаётся при старте трансляции, закрывается при остановке.',
        spacing: { after: 200 }
      }),
      new Paragraph({ text: '3.5. Чат и реакции', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({
        text: 'Текстовый чат работает через три IPC-канала (main-chat-send, panel-chat-send, forward-chat). Emoji-реакции на весь экран — анимированные взлетающие эмодзи. Скример-пасхалка: команда /скример в чате показывает пугающую картинку со звуком всем участникам.',
        spacing: { after: 200 }
      }),
      new Paragraph({ text: '3.6. Схема', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({
        text: 'ПК1 (хост) ←—— видео/аудио (WebRTC P2P) ——→ ПК2 (гость)\n     │                                        │\n     └── сигналы (Socket.IO) ——→ Render.com ——→──┘\n\n(только в облачном режиме; в локальном сигналы идут напрямую)\n\nПК1 (шарер) ←—— IPC —→ Плавающая панель (always-on-top screen-saver)\n    │\n    ├—— WebRTC screen stream —→ ПК2 (зритель)\n    │\n    └—— IPC canvas (5 fps) —→ Окно камер (faces)',
        spacing: { after: 300 }
      }),

      // --- 4. Структура проекта ---
      new Paragraph({ text: '4. Структура проекта', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({
        text: 'Все исходные файлы находятся в папке C:\\Users\\Hamster\\Documents\\NetTheater',
        spacing: { after: 200 }
      }),
      new Paragraph({ text: 'Описание файлов и папок:', heading: HeadingLevel.HEADING_2 }),

      new Paragraph({ text: 'main.js — Главный процесс Electron. Содержит:', spacing: { after: 40 } }),
      new Paragraph({ text: '  • Встроенный signalling сервер (Socket.IO)', spacing: { after: 40 } }),
      new Paragraph({ text: '  • IPC обработчики (копирование, экраны, IP, UPnP, cloud URL, панель)', spacing: { after: 40 } }),
      new Paragraph({ text: '  • setDisplayMediaRequestHandler для захвата экрана', spacing: { after: 40 } }),
      new Paragraph({ text: '  • UPnP клиент для открытия порта', spacing: { after: 40 } }),
      new Paragraph({ text: '  • Бридж IPC между главным окном и плавающей панелью', spacing: { after: 40 } }),
      new Paragraph({ text: '  • Константа CLOUD_SERVER_URL', spacing: { after: 100 } }),

      new Paragraph({ text: 'renderer/index.html — Страница приложения (стартовый экран + комната + модалки)', spacing: { after: 60 } }),
      new Paragraph({ text: 'renderer/app.js — Клиентский JavaScript:', spacing: { after: 40 } }),
      new Paragraph({ text: '  • WebRTC (peers map — multi-user до 5)', spacing: { after: 40 } }),
      new Paragraph({ text: '  • Socket.IO клиент', spacing: { after: 40 } }),
      new Paragraph({ text: '  • Управление UI (кнопки, PTT, режимы, модалки)', spacing: { after: 40 } }),
      new Paragraph({ text: '  • Плавающая панель (создание/закрытие, обновление состояния, приём действий)', spacing: { after: 40 } }),
      new Paragraph({ text: '  • i18n, настройки, release notes', spacing: { after: 100 } }),

      new Paragraph({ text: 'renderer/panel.html — HTML плавающей панели (кнопки 48×48 с SVG-иконками)', spacing: { after: 60 } }),
      new Paragraph({ text: 'renderer/panel.js — JavaScript плавающей панели (IPC bridge, PTT, состояние)', spacing: { after: 60 } }),
      new Paragraph({ text: 'renderer/faces.html — HTML окна камер участников', spacing: { after: 60 } }),
      new Paragraph({ text: 'renderer/faces.js — JavaScript окна камер (canvas-кадры, ползунки громкости, качество)', spacing: { after: 60 } }),
      new Paragraph({ text: 'renderer/reactions.js — Emoji-реакции на весь экран', spacing: { after: 60 } }),
      new Paragraph({ text: 'renderer/scrimer.html — Страница скримера (пасхалка)', spacing: { after: 60 } }),
      new Paragraph({ text: 'renderer/scrimer/ — PNG-картинки и MP3 для скримера', spacing: { after: 60 } }),
      new Paragraph({ text: 'renderer/i18n.js — Строки перевода RU/EN/ES, функции t()/setLang()/initLang()', spacing: { after: 60 } }),
      new Paragraph({ text: 'renderer/style.css — Тёмная тема (lavender/dark), все стили', spacing: { after: 60 } }),
      new Paragraph({ text: 'bot/index.js — Telegram бот + облачный signalling сервер (Render.com)', spacing: { after: 60 } }),
      new Paragraph({ text: 'bot/package.json — Зависимости для бота (socket.io, node-telegram-bot-api)', spacing: { after: 60 } }),
      new Paragraph({ text: '.github/workflows/release-to-telegram.yml — CI: уведомления о релизах в Telegram', spacing: { after: 60 } }),
      new Paragraph({ text: '.github/send_telegram.py — Python-скрипт отправки релизных уведомлений', spacing: { after: 60 } }),
      new Paragraph({ text: 'package.json — Основные зависимости, версия, скрипты сборки', spacing: { after: 60 } }),
      new Paragraph({ text: 'icon.ico — Иконка приложения (BMP-формат ICO, 16/32/48/256px, ensureAlpha)', spacing: { after: 60 } }),
      new Paragraph({ text: 'AGENTS.md — Гайд для AI-агента (opencode)', spacing: { after: 60 } }),
      new Paragraph({ text: 'scripts/gen-docs.js — Скрипт генерации этого документа', spacing: { after: 300 } }),

      // --- 5. Облачная часть ---
      new Paragraph({ text: '5. Облачный сервер и Telegram бот (Render.com)', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: 'Все серверные функции объединены в bot/index.js на Render.com.', spacing: { after: 200 } }),
      new Paragraph({ text: 'Адрес: https://tv-hamsters-bot.onrender.com', spacing: { after: 100 } }),

      new Paragraph({ text: '5.1. Что делает сервер', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: '• Сигналинг Socket.IO (create-room, join-room, offer, answer, ice-candidate, signal, chat-message, reaction)', spacing: { after: 40 } }),
      new Paragraph({ text: '• Telegram бот (node-telegram-bot-api): команды /start, /room, /help, /download', spacing: { after: 40 } }),
      new Paragraph({ text: '• Автосоздание комнаты при ключевых словах в групповых чатах', spacing: { after: 40 } }),
      new Paragraph({ text: '• Keep-alive ping каждые 10 минут (для предотвращения засыпания на бесплатном тарифе Render)', spacing: { after: 40 } }),
      new Paragraph({
        text: 'ВАЖНО: для обратной совместимости сервер дублирует peer-joined как user-joined. Старые и новые клиенты должны работать вместе.',
        spacing: { after: 200 },
        bold: true
      }),

      new Paragraph({ text: '5.2. Как поддерживать', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: '1. Зайти в https://dashboard.render.com', spacing: { after: 40 } }),
      new Paragraph({ text: '2. Войти через GitHub (outmilker1978)', spacing: { after: 40 } }),
      new Paragraph({ text: '3. Выбрать Web Service "tv-hamsters-bot"', spacing: { after: 40 } }),
      new Paragraph({ text: '4. Там можно:', spacing: { after: 40 } }),
      new Paragraph({ text: '   • Посмотреть логи (Logs)', spacing: { after: 40 } }),
      new Paragraph({ text: '   • Перезапустить (Manual Deploy → Deploy)', spacing: { after: 40 } }),
      new Paragraph({ text: '   • Обновить код (если изменить server/cloud.js в GitHub и push — Render перезапустит сам)', spacing: { after: 100 } }),

      new Paragraph({
        text: 'Важно: Render бесплатный, но сервер "засыпает" после 15 минут бездействия. При новом подключении просыпается за 5-15 секунд. Для постоянной работы (без засыпания) нужен платный тариф — $7/мес.',
        spacing: { after: 200 }
      }),

      new Paragraph({ text: '5.3. Как обновить URL в приложении', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: 'URL облачного сервера задаётся:', spacing: { after: 100 } }),
      new Paragraph({ text: '• bot/index.js — токен Telegram бота и порт', spacing: { after: 40 } }),
      new Paragraph({ text: '• renderer/app.js — начальное значение CLOUD_SERVER_URL (через IPC из main.js)', spacing: { after: 40 } }),
      new Paragraph({ text: '• docs/mobile/app.js — константа CLOUD для мобильной версии', spacing: { after: 40 } }),

      // --- 6. Сборка ---
      new Paragraph({ text: '6. Сборка .exe', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: 'Требования:', spacing: { after: 60 } }),
      new Paragraph({ text: '• Node.js v24 (установлен в C:\\Program Files\\nodejs)', spacing: { after: 40 } }),
      new Paragraph({ text: '• npm 11 (входит в Node.js)', spacing: { after: 40 } }),
      new Paragraph({ text: '• Все зависимости установлены (npm install)', spacing: { after: 100 } }),

      new Paragraph({ text: 'Процесс сборки:', heading: HeadingLevel.HEADING_2 },
        { spacing: { after: 60 } }),

      new Paragraph({ text: 'npm run build', spacing: { after: 40 } }),
      new Paragraph({
        text: '• prebuild: старый .exe из dist/ перемещается в dist/Archive/',
        spacing: { after: 40 }
      }),
      new Paragraph({
        text: '• electron-builder упаковывает app.asar в dist/win-unpacked/',
        spacing: { after: 40 }
      }),
      new Paragraph({
        text: '• Ошибка winCodeSign про симлинки — НЕ КРИТИЧНА (только подпись кода, не влияет на portable). packaging (appOutDir) уже прошёл к этому моменту.',
        spacing: { after: 60 }
      }),
      new Paragraph({
        text: '⚠ ВАЖНО: --prepackaged НЕ обновляет код — он перепаковывает уже существующий dist/win-unpacked. Всегда делайте полную сборку перед portable:',
        spacing: { after: 60 },
        bold: true
      }),
      new Paragraph({ text: 'npx electron-builder --prepackaged dist\\win-unpacked --win portable', spacing: { after: 40 } }),
      new Paragraph({
        text: 'Проверяйте: (Get-Item dist\\TV.Hamsters.*.exe).LastWriteTime должен быть после последнего изменения кода.',
        spacing: { after: 60 }
      }),

      new Paragraph({         text: 'Результат: dist\\TV Hamsters X.X.X.exe (autoname, новый номер при каждой сборке — для обхода Windows Defender)', spacing: { after: 100 } }),

      new Paragraph({
        text: 'ВАЖНО: Старый .exe автоматически архивируется (prebuild). Новое имя файла с версией помогает избежать блокировки Windows Defender. Если Defender блокирует — используйте очередной новый номер версии.',
        spacing: { after: 100 },
        bold: true
      }),

      // --- 6.1. Известные проблемы ---
      new Paragraph({ text: '6.1. Известные проблемы', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: '• let vs var между скриптами — каждый <script> в Electron — отдельный scope. Переменная через let не видна между скриптами. Используйте var для кросс-скриптовых переменных (currentLang, peers и т.д.).', spacing: { after: 40 } }),
      new Paragraph({ text: '• Screen share freeze — когда источник свёрнут, Chromium может не обновлять кадры. Ограничение браузера, не лечится.', spacing: { after: 40 } }),
      new Paragraph({ text: '• Yandex Browser — встроенный VPN/Turbo ломает P2P (STUN не видит реальный IP). Chrome без прокси — лучший вариант.', spacing: { after: 40 } }),
      new Paragraph({ text: '• WiFi роутеры — mesh-топология (5 участников = до 10 PC × N UDP портов) нагружает NAT-таблицу. Переключение одного участника на 4G/5G снижает нагрузку.', spacing: { after: 40 } }),
      new Paragraph({ text: '• winCodeSign-2.6.0.7z extraction fails — Cannot create symbolic link (libcrypto.dylib/libssl.dylib для macOS на Windows). Не влияет на сборку — packaging проходит, portable собирается.', spacing: { after: 40 } }),
      new Paragraph({ text: '• Модалки i18n — статичны в HTML (display: none), перевод только при вызове setLang(currentLang) при открытии.', spacing: { after: 40 } }),

      // --- 7. Разработка ---
      new Paragraph({ text: '7. Как продолжить разработку', heading: HeadingLevel.HEADING_1 }),

      new Paragraph({ text: '7.1. Запуск для отладки', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({
        text: 'npm start\nЗапускает Electron с встроенным сервером. Для отладки — F12 (DevTools).',
        spacing: { after: 200 }
      }),

      new Paragraph({ text: '7.2. Версионирование', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: 'Формат: X.Y.Z, где:', spacing: { after: 80 } }),
      new Paragraph({ text: 'X (Major) — архитектурные изменения + новая основная фишка. Пример: трансляция со звуком + голосовое общение; режим рации.', spacing: { after: 40 } }),
      new Paragraph({ text: 'Y (Minor) — добавление новых фич (ползунки громкости, выбор языка, плавающая панель).', spacing: { after: 40 } }),
      new Paragraph({ text: 'Z (Patch) — версия после тестирования и багфиксов.', spacing: { after: 40 } }),
      new Paragraph({ text: 'Y и Z могут быть двузначными (например, 1.12.34).', spacing: { after: 80 } }),
      new Paragraph({ text: 'Версия обновляется в package.json. Release notes — в renderer/index.html (блок release-list).', spacing: { after: 200 } }),

      new Paragraph({ text: '7.3. Важные моменты', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: '• При изменении server/cloud.js — push на GitHub, Render перезапустит автоматически.', spacing: { after: 60 } }),
      new Paragraph({ text: '• При изменении main.js или renderer/*.js/*.html — пересобрать .exe.', spacing: { after: 60 } }),
      new Paragraph({ text: '• Не собирать .exe без команды пользователя. Только готовить код.', spacing: { after: 60 } }),
      new Paragraph({ text: '• Не удалять i18n-ключи без необходимости.', spacing: { after: 60 } }),
      new Paragraph({ text: '• Описание программы писать для «хомячков» (без технических терминов).', spacing: { after: 60 } }),
      new Paragraph({
        children: [new TextRun({ text: 'ОБЯЗАТЕЛЬНО: обратная совместимость! Сервер шлёт и peer-joined, и user-joined. Старые и новые клиенты должны работать вместе. socket.io auto-fallback: WebSocket → HTTP long polling (для корпоративных сетей, блокирующих WebSocket).', bold: true })],
        spacing: { after: 300 }
      }),

      // --- 8. Версии ---
      new Paragraph({ text: '8. История версий', heading: HeadingLevel.HEADING_1 }),

      new Paragraph({ text: '1.8.2 — Испанский язык (Español). Оптимизация видео/аудио (32k, 960×540). Индикатор качества связи (цветная точка). Скример-пасхалка (/скример). Чат-уведомления при трансляции. Авто ICE restart при плохом качестве. Совместимость с Celeron.', spacing: { after: 40 } }),
      new Paragraph({ text: '1.8.0 — Плавающие окна, frameless drag, middle-click сброс. Реакции на весь экран. Три IPC-канала чата. EN-перевод (var). PTT правый клик. Полное нагрузочное тестирование.', spacing: { after: 40 } }),
      new Paragraph({ text: '1.7.2 — «Палата №» вместо «Код комнаты». Сценарии использования. Deep-link hamsters://. Ссылка на донаты (Boosty).', spacing: { after: 40 } }),
      new Paragraph({ text: '1.7.1 — Переименование в TV Hamsters. Исправление эха. Размер окна 480×680. Ползунок громкости микрофона. PTT с панели, flex-wrap 5 камер, модалка 3 колонки, авто-восстановление окон', spacing: { after: 40 } }),
      new Paragraph({ text: '1.7.0 — Нативный выбор окна (все окна включая свёрнутые), главное окно сворачивается при трансляции, плавающая панель как в главном окне, отдельное окно камер участников с ползунками громкости', spacing: { after: 40 } }),
      new Paragraph({ text: '1.6.1 — Плавающая панель управления (только кнопки, как в главном окне), исправление рации (не глушит собеседника), выбор окна с превью, подсказка о свёрнутых окнах, вход/выход без накопления, выход из рации любой кнопкой мыши', spacing: { after: 40 } }),
      new Paragraph({ text: '1.6.0 — Выбор окна при шаринге, компактный режим шарера, ползунки громкости, рация для всех (2 режима микрофона)', spacing: { after: 40 } }),
      new Paragraph({ text: '1.5.1 — Ярлык на рабочий стол, улучшенная кнопка копирования', spacing: { after: 40 } }),
      new Paragraph({ text: '1.5.0 — Multi-user (до 5), i18n EN/RU, настройки (режим окна + язык), история версий в Помощи, обновлённый About', spacing: { after: 40 } }),
      new Paragraph({ text: '1.4.2 — Меню Помощь → О программе, раздел О команде', spacing: { after: 40 } }),
      new Paragraph({ text: '1.4.1 — Версия в заголовке окна, PTT только у шарера', spacing: { after: 40 } }),
      new Paragraph({ text: '1.4.0 — Справка, монохромные иконки, очередь ICE кандидатов', spacing: { after: 40 } }),
      new Paragraph({ text: '1.3.0 — Облачный режим (Render.com), переключатель Локально/Интернет', spacing: { after: 40 } }),
      new Paragraph({ text: '1.2.2 — Исправление эха, повторное подключение', spacing: { after: 40 } }),
      new Paragraph({ text: '1.2.1 — Исправление сборки (включение nat-upnp)', spacing: { after: 40 } }),
      new Paragraph({ text: '1.2.0 — UPnP, внешний IP, 4-значные PIN', spacing: { after: 40 } }),
      new Paragraph({ text: '1.1.0 — Screen sharing в обе стороны', spacing: { after: 40 } }),
      new Paragraph({ text: '1.0.0 — Первая версия (LAN, встроенный сервер)', spacing: { after: 300 } }),

      // --- 9. Известные проблемы ---
      new Paragraph({ text: '9. Известные проблемы', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: '• Минимизированные окна не отображаются в списке выбора экрана (ограничение Windows Desktop Duplication API). Решение: развернуть окно перед выбором.', spacing: { after: 40 } }),
      new Paragraph({ text: '• Первое ICE-соединение иногда требует повторной попытки (авто-ретрай работает)', spacing: { after: 40 } }),
      new Paragraph({ text: '• winCodeSign не извлекается на Windows (только подпись кода — не критично для portable)', spacing: { after: 40 } }),
      new Paragraph({ text: '• Render.com бесплатный тариф — сервер засыпает после 15 мин бездействия (~5-15 сек на пробуждение)', spacing: { after: 40 } }),
      new Paragraph({ text: '• UPnP не работает с мобильными хотспотами и некоторыми роутерами (не влияет на облачный режим)', spacing: { after: 40 } }),
      new Paragraph({ text: '• Windows Defender может блокировать старый .exe при перезаписи (решение: новый номер версии)', spacing: { after: 300 } }),

      // --- 10. Команда ---
      new Paragraph({ text: '10. О команде', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: '• Разработчик: Безумный Хомяк "Outmilker"', spacing: { after: 60 } }),
      new Paragraph({ text: '• Идея: Хомимуми и Настя "Сеня" (Спасибо моим любимым хомячкам за вдохновение, которое пришло ко мне ночью, пока они не давали мне спокойненько спать...)', spacing: { after: 60 } }),
      new Paragraph({ text: '• Помощь в создании: Василька (огромное спасибо за помощь при разработке и тестированию)', spacing: { after: 60 } }),
      new Paragraph({ text: '• AI-ассистент: opencode (opencode.ai — тоже молодец)', spacing: { after: 60 } }),
      new Paragraph({ text: '• И вместе мы бригада "Ух!"... работаем до двух.... ночи)', spacing: { after: 60 } }),
    ]
  }]
});

const outPath = path.join(__dirname, '..', 'developer-docs', 'TV_Hamsters_Developer_Guide.docx');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outPath, buffer);
  console.log('Document created:', outPath);
  console.log('Size:', buffer.length, 'bytes');
}).catch(err => {
  console.error('Error:', err.message);
});
