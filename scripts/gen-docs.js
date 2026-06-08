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
        text: 'Версия продукта: 1.7.1',
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
        text: 'TV Hamsters — смотрите фильмы, сериалы и видео вместе, будто вы рядом. Один включает трансляцию экрана со звуком, остальные видят видео и слышат голоса всех участников. Можно обсуждать происходящее в реальном времени, хохотать и комментировать — как в настоящем кинотеатре, только онлайн.',
        spacing: { after: 200 }
      }),
      new Paragraph({
        text: 'Режим рации (Push-to-Talk): правый клик по микрофону → режим PTT. Зажать Пробел или кнопку — говорить. Отпустить — микрофон выключится. Выход из PTT — любой клик (левой/правой) по иконке микрофона. В обычном режиме микрофон работает постоянно.',
        spacing: { after: 200 }
      }),
      new Paragraph({
        text: 'Программа работает как через локальную сеть (LAN), так и через Интернет без необходимости настройки роутера. Для работы через Интернет используется облачный signalling-сервер на Render.com. Поддерживается до 5 участников в одной комнате.',
        spacing: { after: 300 }
      }),

      // --- 2. Технологии ---
      new Paragraph({ text: '2. Технологии', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: 'Стек:', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: '• Electron 34 — кросс-платформенная среда для десктопных приложений на веб-технологиях', spacing: { after: 60 } }),
      new Paragraph({ text: '• Socket.IO 4 — двунаправленная связь в реальном времени (signalling)', spacing: { after: 60 } }),
      new Paragraph({ text: '• WebRTC — передача видео/аудио/экрана (P2P, через STUN)', spacing: { after: 60 } }),
      new Paragraph({ text: '• desptopCapturer / getDisplayMedia — захват экрана (Windows)', spacing: { after: 60 } }),
      new Paragraph({ text: '• nat-upnp — автоматическое открытие портов на роутере (для LAN режима)', spacing: { after: 60 } }),
      new Paragraph({ text: '• Node.js v24 — среда выполнения JavaScript', spacing: { after: 60 } }),
      new Paragraph({ text: '• electron-builder 25 — сборка портативного .exe', spacing: { after: 60 } }),
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
        text: 'При старте трансляции экрана создаётся отдельное frameless-окно 260×56 с прозрачным фоном и always-on-top. Панель содержит только кнопки управления (камера, микрофон, рация, экран, выход) с теми же SVG-иконками, что в главном окне. Состояние обновляется через IPC каждые 500 мс. При остановке трансляции панель закрывается.',
        spacing: { after: 200 }
      }),
      new Paragraph({ text: '3.4. Схема', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({
        text: 'ПК1 (хост) ←—— видео/аудио (WebRTC P2P) ——→ ПК2 (гость)\n     │                                        │\n     └── сигналы (Socket.IO) ——→ Render.com ——→──┘\n\n(только в облачном режиме; в локальном сигналы идут напрямую)\n\nПК1 (шарер) ←—— IPC —→ Плавающая панель (always-on-top)\n    │\n    └—— WebRTC screen stream —→ ПК2 (зритель)',
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

      new Paragraph({ text: 'renderer/panel.html — HTML плавающей панели (кнопки с SVG-иконками)', spacing: { after: 60 } }),
      new Paragraph({ text: 'renderer/panel.js — JavaScript плавающей панели (IPC, состояние кнопок)', spacing: { after: 60 } }),
      new Paragraph({ text: 'renderer/i18n.js — Строки перевода RU/EN, функции t()/setLang()/initLang()', spacing: { after: 60 } }),
      new Paragraph({ text: 'renderer/style.css — Тёмная тема (lavender/dark), все стили', spacing: { after: 60 } }),
      new Paragraph({ text: 'server/cloud.js — Облачный signalling сервер для Render.com', spacing: { after: 60 } }),
      new Paragraph({ text: 'server/package.json — Зависимости для облачного сервера (только socket.io)', spacing: { after: 60 } }),
      new Paragraph({ text: 'package.json — Основные зависимости, версия, скрипты сборки', spacing: { after: 60 } }),
      new Paragraph({ text: 'icon.ico — Иконка приложения (BMP-формат ICO, 16/32/48/256px, ensureAlpha)', spacing: { after: 60 } }),
      new Paragraph({ text: 'AGENTS.md — Гайд для AI-агента (opencode)', spacing: { after: 60 } }),
      new Paragraph({ text: 'scripts/gen-docs.js — Скрипт генерации этого документа', spacing: { after: 300 } }),

      // --- 5. Облачная часть ---
      new Paragraph({ text: '5. Облачный сервер (Render.com)', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: 'Адрес: https://hamsters-theater-cloud.onrender.com', spacing: { after: 100 } }),
      new Paragraph({ text: 'Репозиторий: https://github.com/outmilker1978/hamsters-theater-cloud', spacing: { after: 200 } }),

      new Paragraph({ text: '5.1. Что делает облачный сервер', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: 'Сервер реализован в файле server/cloud.js. Его единственная задача — пересылать сигнальные сообщения между клиентами:', spacing: { after: 100 } }),
      new Paragraph({ text: '• create-room / room-created — создание комнаты с 4-значным PIN', spacing: { after: 40 } }),
      new Paragraph({ text: '• join-room / joined / room-users / user-joined — подключение к комнате (multi-user)', spacing: { after: 40 } }),
      new Paragraph({ text: '• offer / answer — обмен SDP (WebRTC)', spacing: { after: 40 } }),
      new Paragraph({ text: '• ice-candidate — передача ICE кандидатов', spacing: { after: 40 } }),
      new Paragraph({ text: '• signal — передача прикладных сигналов (screen-started/stopped, request-offer)', spacing: { after: 40 } }),
      new Paragraph({ text: '• disconnect — очистка комнаты при отключении', spacing: { after: 200 } }),
      new Paragraph({
        text: 'ВАЖНО: для обратной совместимости сервер дублирует peer-joined как user-joined. Старые и новые клиенты должны работать вместе.',
        spacing: { after: 200 },
        bold: true
      }),

      new Paragraph({ text: '5.2. Как поддерживать', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: '1. Зайти в https://dashboard.render.com', spacing: { after: 40 } }),
      new Paragraph({ text: '2. Войти через GitHub (outmilker1978)', spacing: { after: 40 } }),
      new Paragraph({ text: '3. Выбрать Web Service "hamsters-theater-cloud"', spacing: { after: 40 } }),
      new Paragraph({ text: '4. Там можно:', spacing: { after: 40 } }),
      new Paragraph({ text: '   • Посмотреть логи (Logs)', spacing: { after: 40 } }),
      new Paragraph({ text: '   • Перезапустить (Manual Deploy → Deploy)', spacing: { after: 40 } }),
      new Paragraph({ text: '   • Обновить код (если изменить server/cloud.js в GitHub и push — Render перезапустит сам)', spacing: { after: 100 } }),

      new Paragraph({
        text: 'Важно: Render бесплатный, но сервер "засыпает" после 15 минут бездействия. При новом подключении просыпается за 5-15 секунд. Для постоянной работы (без засыпания) нужен платный тариф — $7/мес.',
        spacing: { after: 200 }
      }),

      new Paragraph({ text: '5.3. Как обновить URL в приложении', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: 'URL облачного сервера задаётся в двух местах:', spacing: { after: 100 } }),
      new Paragraph({ text: '• main.js — константа CLOUD_SERVER_URL', spacing: { after: 40 } }),
      new Paragraph({ text: '• renderer/app.js — начальное значение CLOUD_SERVER_URL (перезаписывается из main.js через IPC)', spacing: { after: 40 } }),
      new Paragraph({ text: 'При сборке .exe нужно изменить в обоих файлах, затем пересобрать.', spacing: { after: 300 } }),

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
        text: '• Ошибка winCodeSign про симлинки — НЕ КРИТИЧНА (только подпись кода, не влияет на portable)',
        spacing: { after: 60 }
      }),
      new Paragraph({ text: 'Сборка портативного .exe (из подготовленного ht-win):', spacing: { after: 40 } }),
      new Paragraph({
        text: 'npx electron-builder --prepackaged "C:\\Users\\Hamster\\AppData\\Local\\Temp\\ht-win" --win portable',
        spacing: { after: 60 }
      }),

      new Paragraph({ text: 'Результат: dist\\TV Hamsters X.X.X.exe', spacing: { after: 100 } }),

      new Paragraph({
        text: 'ВАЖНО: Старый .exe автоматически архивируется (prebuild). Новое имя файла с версией помогает избежать блокировки Windows Defender. Если Defender блокирует — используйте очередной новый номер версии.',
        spacing: { after: 200 },
        bold: true
      }),

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

      new Paragraph({ text: '1.7.1 — Переименование в TV Hamsters. Исправление эха (applyConstraints-gain вместо AudioContext). Увеличен размер окна до 480×680. Ползунок громкости микрофона на панели лиц. Исправлены кнопки панели, PTT с панели, кодировка PowerShell, flex-wrap для 5 камер, модалка 3 колонки, авто-восстановление свёрнутых окон', spacing: { after: 40 } }),
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
      new Paragraph({ text: '• Идея: Хомимуми и Настя "Сеня" (спасибо за вдохновение... которое пришло ко мне, пока вы не давали мне спать)', spacing: { after: 60 } }),
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
