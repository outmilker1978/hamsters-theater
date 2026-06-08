const LOCALES = {
  ru: {
    'app.title': 'TV Hamsters',
    'landing.subtitle': 'Смотрите видео вместе, будто вы рядом',
    'landing.your_address': 'Ваш адрес:',
    'landing.server_placeholder': 'Адрес сервера (IP:порт)',
    'landing.create_room': 'Создать комнату',
    'landing.or': 'или',
    'landing.code_placeholder': 'Введите код комнаты',
    'landing.join_room': 'Подключиться к комнате',
    'mode.local': 'Локально',
    'mode.cloud': 'Через Интернет',
    'mode.local_placeholder': 'Адрес сервера (IP:порт)',
    'mode.cloud_placeholder': 'Адрес облачного сервера',
    'room.screenshare_empty': 'Экран не транслируется',
    'room.screenshare_hint': 'Нажмите «Поделиться экраном», чтобы начать',
    'room.you': 'Вы',
    'room.code_label': 'Код комнаты:',
    'tooltip.camera': 'Камера',
    'tooltip.mic': 'Микрофон / Рация (правой кнопкой мыши)',
    'tooltip.mic_ptt': 'Рация: Пробел',
    'tooltip.share': 'Поделиться экраном',
    'tooltip.share_disabled': 'Экран уже транслируется',
    'tooltip.ptt': 'Зажмите Пробел, чтобы говорить',
    'tooltip.leave': 'Покинуть комнату',
    'error.no_peer': 'Нет подключения к собеседнику',
    'sourcepicker.title': 'Выберите окно для трансляции',
    'sourcepicker.no_preview': 'Нет превью',
    'sourcepicker.restore_hint': 'Разверните окно и нажмите заново',
    'error.no_screens': 'Экраны не найдены',
    'error.camera_unavailable': 'Камера недоступна',
    'error.server_lost': 'Потеря связи с сервером',
    'error.room_not_found': 'Комната не найдена',
    'error.room_full': 'Комната заполнена (макс. 5)',
    'error.enter_code': 'Введите код комнаты',

    'toast.copied': 'Код скопирован в буфер обмена',
    'help.about': 'О программе',
    'help.release_notes': 'История версий',
    'help.settings': 'Настройки',
    'help.desc': 'TV Hamsters — смотрите фильмы, сериалы и видео вместе, будто вы рядом. Один включает трансляцию экрана со звуком, остальные видят видео и слышат голоса всех участников. Можно обсуждать происходящее в реальном времени, хохотать и комментировать — как в настоящем кинотеатре, только онлайн.',
    'help.killer_feature': '<b>Рация (Push-to-Talk)</b> — нажми правой кнопкой мыши по микрофону, чтобы включить режим рации. Зажми <b>Пробел</b> или кнопку — говори. Отпусти — микрофон выключится. В обычном режиме микрофон работает постоянно.',
    'help.how_title': 'Как это работает',
    'help.how_text': 'Видео и голос передаются напрямую между хомячками — быстро и без задержек. Для соединения используется облачный сервер, он помогает найти друг друга и настроить связь. В одной комнате может быть до 5 участников.',
    'help.modes_title': 'Режимы работы',
    'help.mode_local': 'Локально — для использования в одной сети (через роутер).',
    'help.mode_cloud': 'Через Интернет — использует облачный сервер. Не требует открытия портов.',
    'help.buttons_title': 'Кнопки управления',
    'help.btn_camera': 'включить / выключить камеру',
    'help.btn_mic': 'включить / выключить микрофон',
    'help.btn_screen': 'показать свой экран всем',
    'help.btn_leave': 'покинуть комнату',
    'help.btn_ptt': 'нажать и говорить (Push-to-Talk)',
    'help.team_title': 'О команде',
    'help.team_dev': 'Разработчик: Безумный Хомяк "Outmilker"',
    'help.team_idea': 'Идея: Хомимуми и Настя "Сеня" (Спасибо моим любимым хомячкам за вдохновение, которое пришло ко мне ночью, пока они не давали мне спокойненько спать...)',
    'help.team_testers': 'Помощь в создании: Василька (огромное спасибо за помощь при разработке и тестированию)',
    'help.team_ai': 'AI-ассистент: opencode (opencode.ai — тоже молодец)',
    'help.team_final': 'И вместе мы бригада "Ух!"... работаем до двух.... ночи)',
    'tooltip.copy': 'Копировать адрес',
    'copy.server_prefix': 'Сервер: ',
    'settings.window_mode': 'Режим окна',
    'settings.window_normal': 'Обычный',
    'settings.window_fullscreen': 'Полный экран',
    'settings.window_minimized': 'Свернуть',
    'settings.language': 'Язык / Language',
    'settings.language_ru': 'Русский',
    'settings.language_en': 'English',
    'settings.shortcut': 'Рабочий стол',
    'settings.shortcut_btn': 'Создать ярлык на рабочем столе',
    'settings.shortcut_created': 'Ярлык создан на рабочем столе',
    'settings.shortcut_failed': 'Ошибка создания ярлыка',
    'shortcut.prompt_title': 'Ярлык на рабочий стол',
    'shortcut.prompt_text': 'Создать ярлык TV Hamsters на рабочем столе для быстрого запуска?',
    'shortcut.yes': 'Да, создать',
    'shortcut.no': 'Нет',
    'shortcut.dont_ask': 'Больше не спрашивать',
    'shortcut.reminder': 'Вы всегда можете создать ярлык через Настройки → Рабочий стол',
    'menu.file': 'Файл',
    'menu.file.quit': 'Выход',
    'menu.settings': 'Настройки',
    'menu.settings.fullscreen': 'Полный экран',
    'menu.settings.dev_tools': 'Инструменты разработчика',
    'menu.settings.window_lang': 'Режим окна и язык...',
    'menu.help': 'Помощь',
    'menu.help.about': 'О программе',
    'menu.help.release_notes': 'История версий',
  },
  en: {
    'app.title': 'TV Hamsters',
    'landing.subtitle': 'Watch videos together, side by side',
    'landing.your_address': 'Your address:',
    'landing.server_placeholder': 'Server address (IP:port)',
    'landing.create_room': 'Create room',
    'landing.or': 'or',
    'landing.code_placeholder': 'Enter room code',
    'landing.join_room': 'Join room',
    'mode.local': 'Local',
    'mode.cloud': 'Internet',
    'mode.local_placeholder': 'Server address (IP:port)',
    'mode.cloud_placeholder': 'Cloud server address',
    'room.screenshare_empty': 'No screen sharing',
    'room.screenshare_hint': 'Press "Share screen" to start',
    'room.you': 'You',
    'room.code_label': 'Room code:',
    'tooltip.camera': 'Camera',
    'tooltip.mic': 'Mic / PTT (right mouse button)',
    'tooltip.mic_ptt': 'PTT: Space',
    'tooltip.share': 'Share screen',
    'tooltip.share_disabled': 'Screen is being shared',
    'tooltip.ptt': 'Hold Space to talk',
    'tooltip.leave': 'Leave room',
    'error.no_peer': 'No peer connected',
    'sourcepicker.title': 'Choose a window to share',
    'sourcepicker.no_preview': 'No preview',
    'sourcepicker.restore_hint': 'Restore the window and try again',
    'error.no_screens': 'No screens found',
    'error.camera_unavailable': 'Camera unavailable',
    'error.server_lost': 'Lost connection to server',
    'error.room_not_found': 'Room not found',
    'error.room_full': 'Room is full (max 5)',
    'error.enter_code': 'Enter room code',

    'toast.copied': 'Code copied to clipboard',
    'help.about': 'About',
    'help.release_notes': 'Release Notes',
    'help.settings': 'Settings',
    'help.desc': 'TV Hamsters — watch movies, shows, and videos together as if you were in the same room. One person shares their screen with sound, everyone sees the video and hears all voices in real time. Laugh, comment, discuss — just like at the cinema, only online.',
    'help.killer_feature': '<b>Push-to-Talk (PTT)</b> — right-click the mic button to enter PTT mode. Hold <b>Space</b> or the button to speak. Release to mute. In normal mode the mic stays on continuously.',
    'help.how_title': 'How it works',
    'help.how_text': 'Video and voice go directly between hamsters — fast and without delays. A cloud server helps find each other and set up the connection. Up to 5 participants per room.',
    'help.modes_title': 'Modes',
    'help.mode_local': 'Local — for use within the same network (via router).',
    'help.mode_cloud': 'Internet — uses a cloud server. No port forwarding required.',
    'help.buttons_title': 'Controls',
    'help.btn_camera': 'toggle camera on / off',
    'help.btn_mic': 'toggle microphone on / off',
    'help.btn_screen': 'share your screen with everyone',
    'help.btn_leave': 'leave the room',
    'help.btn_ptt': 'hold to talk (Push-to-Talk)',
    'help.team_title': 'Team',
    'help.team_dev': 'Developer: Безумный Хомяк "Outmilker"',
    'help.team_idea': 'Idea: Хомимуми and Настя "Сеня" (thanks for the inspiration... that came while you kept me awake)',
    'help.team_testers': 'Development help: Василька (huge thanks for development and testing help)',
    'help.team_ai': 'AI assistant: opencode (opencode.ai — good job too)',
    'help.team_final': 'And together we are the "Ukh!" crew... working till two.... in the morning)',
    'tooltip.copy': 'Copy address',
    'copy.server_prefix': 'Server: ',
    'settings.window_mode': 'Window mode',
    'settings.window_normal': 'Normal',
    'settings.window_fullscreen': 'Full screen',
    'settings.window_minimized': 'Minimize',
    'settings.language': 'Language',
    'settings.language_ru': 'Русский',
    'settings.language_en': 'English',
    'settings.shortcut': 'Desktop',
    'settings.shortcut_btn': 'Create desktop shortcut',
    'settings.shortcut_created': 'Shortcut created on desktop',
    'settings.shortcut_failed': 'Failed to create shortcut',
    'shortcut.prompt_title': 'Desktop Shortcut',
    'shortcut.prompt_text': 'Create a TV Hamsters shortcut on your desktop for quick launch?',
    'shortcut.yes': 'Yes, create',
    'shortcut.no': 'No',
    'shortcut.dont_ask': "Don't ask again",
    'shortcut.reminder': 'You can always create a shortcut via Settings → Desktop',
    'menu.file': 'File',
    'menu.file.quit': 'Quit',
    'menu.settings': 'Settings',
    'menu.settings.fullscreen': 'Full Screen',
    'menu.settings.dev_tools': 'Developer Tools',
    'menu.settings.window_lang': 'Window mode and language...',
    'menu.help': 'Help',
    'menu.help.about': 'About',
    'menu.help.release_notes': 'Release Notes',
  }
};

let currentLang = localStorage.getItem('nt_lang') || 'ru';

function t(key) {
  return LOCALES[currentLang]?.[key] || LOCALES['ru']?.[key] || key;
}

function setLang(lang) {
  if (!LOCALES[lang]) return;
  currentLang = lang;
  localStorage.setItem('nt_lang', lang);
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
  });
  document.querySelectorAll('[data-tooltip-i18n]').forEach(el => {
    el.setAttribute('data-tooltip', t(el.getAttribute('data-tooltip-i18n')));
  });
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });
  document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
}

function initLang() {
  setLang(currentLang);
}
