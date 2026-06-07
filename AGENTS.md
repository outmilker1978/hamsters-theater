# Hamsters Theater — Гайд для агента

## Цель

Десктопное приложение для совместного просмотра видео онлайн: видеозвонок + трансляция экрана со звуком + голосовое общение. P2P mesh до 5 участников, i18n (RU/EN), облачный и локальный режимы. Портативный single .exe для Windows.

## Версионирование

Формат: `X.Y.Z` (например, `1.7.0`), Y и Z могут быть двузначными.

- **X (Major)** — существенные архитектурные изменения + появление основной «фишки». Пример: трансляция экрана со звуком + микрофон для общения во время просмотра; режим рации.
- **Y (Minor)** — добавление новых фич (ползунки громкости, выбор языка, плавающая панель).
- **Z (Patch)** — версия после тестирования и багфиксов.

## Архитектура

- **Electron 34** — нативное окно, IPC main↔renderer
- **Socket.IO** (сервер встроенный в main.js + облачный relay на Render.com)
- **WebRTC** (RTCPeerConnection) — P2P mesh: каждый участник соединяется с каждым напрямую
- **STUN** — Google Public STUN (stun.l.google.com:19302), TURN не используется
- **Облачный сервер**: `https://hamsters-theater-cloud.onrender.com` — только сигналинг (не ретранслирует медиа)
- **Локальный сервер**: встроенный HTTP+Socket.IO в main.js, порт 3000 (авто-fallback 3000+)

## Сборка

```bash
npm run build       # prebuild (архив) → electron-builder --win --x64
npm run build-portable  # из dist/win-unpacked → portable .exe
```

- Результат: `dist/Hamsters Theater X.Y.Z.exe`
- Старый .exe автоматически перемещается в `dist/Archive/`
- winCodeSign extraction fails на Windows (symlink issue) — не влияет на portable, только на подпись кода
- Новое имя файла при каждой сборке, чтобы избежать блокировки Windows Defender

## Основные фишки (для описания программы)

1. **Совместный просмотр через трансляцию экрана со звуком** — один хомячок транслирует экран (видео + аудио системы), остальные видят и слышат. Все могут общаться голосом через микрофон одновременно.
2. **Режим рации (Push-to-Talk)** — правый клик по микрофону → режим PTT. Зажать Пробел/кнопку → говорить. Отпустить → микрофон выключен. В обычном режиме микрофон работает постоянно. Выход из PTT — любой клик (левой/правой) по иконке микрофона.

## Ключевые решения

### UI/UX
- **Плавающая панель при трансляции** — frameless-окно 310×78, always-on-top, кнопки управления (камера, микрофон, рация, экран, выход). Те же SVG-иконки и размер кнопок (48×48), что в главном окне, тот же CSS.
- **Выбор окна для трансляции** — нативный диалог Chromium (navigator.mediaDevices.getDisplayMedia). Показывает ВСЕ окна, включая свёрнутые. Кастомный пикер удалён.
- **Главное окно** — сворачивается в панель задач при старте трансляции, восстанавливается при остановке.
- **Окно камер участников (faces)** — третье BrowserWindow (300×220, bottom-right, always-on-top, с заголовком). Показывает превью камер всех хомячков (canvas-кадры через IPC, 5 fps) + ползунки громкости. Создаётся при старте шаринга, закрывается при остановке.
- **Ярлык на рабочий стол** — через PowerShell (WScript.Shell). One-shot prompt при первом запуске новой версии.
- **Toast** — 4 секунды, copy button полупрозрачный без фона.
- **Хомячок** вместо «Участник» в подписях лиц.

### PTT (Push-to-Talk)
- `window.addEventListener` с `capture: true` для Space
- `startPTT()` — только включает local mic, НЕ трогает remoteStream (исправлено в 1.6.1)
- `stopPTT()` — только выключает local mic
- `startPTT()`/`stopPTT()` не шлют broadcastSignal (исправлено в 1.6.1)
- Тригеры: Space (глобально), кнопка PTT (mousedown/mouseup), кнопка микрофона (right-click → enter, left/right-click → exit)
- `setupPTT()` вызывается при init и после startCamera()

### Трансляция экрана
- `startScreenShare()` → `getDisplayMedia({video:true, audio:true})` (нативный диалог Chromium, показывает все окна)
- `doStartScreenShare(stream)` → создаёт `screenPC` для каждого пира, сворачивает главное окно, создаёт panel + faces window
- `stopScreenShare()` → закрывает screenPC, останавливает треки, закрывает panel + faces, восстанавливает главное окно

### Плавающая панель (panel)
- Второе BrowserWindow: frameless, transparent, alwaysOnTop, skipTaskbar, 310×78
- `panel.html` + `panel.js` — кнопки 48×48 с теми же SVG-иконками, что в главном окне, тот же CSS
- PTT: кнопка рации с меткой «Пробел», mousedown/mouseup
- IPC bridge: main renderer → main process → panel (state: micOn, camOn, pttActive, sharingScreen)
- IPC bridge: panel → main process → main renderer (actions: toggle-mic, toggle-cam, toggle-screen, open-ptt, close-ptt, leave)
- Создаётся при старте шаринга, закрывается при остановке/leave/will-quit
- Состояние обновляется каждые 500 мс через panel-timer

### Окно камер (faces)
- Третье BrowserWindow: 300×220, bottom-right, всегда поверх (alwaysOnTop), skipTaskbar: false, с заголовком
- `faces.html` + `faces.js` — показывает превью камер участников (canvas-кадры через faces-frames IPC, ~5 fps)
- Ползунки громкости для каждого участника, изменения шлются обратно через faces-volume IPC
- Создаётся при старте шаринга, закрывается при остановке/leave/will-quit/close

### Локальный режим
- `getLocalIP()` — три прохода: 1) Wi-Fi/wireless/беспроводная, 2) любой non-internal IPv4 без virtual адаптеров, 3) IPv4 last resort. Fallback `127.0.0.1`.
- `localAddress` = LAN IP (из get-local-ip), `myAddress` = public IP (из get-public-ip)
- copyAddress использует `localAddress` в локальном режиме
- Порт сервера auto-fallback (3000+), значение показывается в serverUrlInput

### Совместимость
- Сервер шлёт и `peer-joined`, и `user-joined` для старых клиентов
- socket.io auto-fallback: WebSocket → HTTP long polling

### Прочее
- Средний клик (button 1) → fullscreen toggle (window с capture: true)
- cleanupCall() очищает `#remote-faces` innerHTML, закрывает panel + faces, останавливает facesTimer, восстанавливает главное окно
- compact-overlay CSS удалён (заменён плавающей панелью + окном камер)

## Файловая структура

| Файл | Назначение |
|------|-----------|
| `main.js` | Main process: сервер, IPC, окно, меню, UPnP |
| `renderer/app.js` | Renderer: WebRTC, UI, PTT, экран, панель |
| `renderer/index.html` | HTML: модалки, landing, комната |
| `renderer/style.css` | Стили: тема (lavender/dark), layout, модалки |
| `renderer/i18n.js` | Локализация RU/EN |
| `renderer/panel.html` | Плавающая панель (HTML) |
| `renderer/panel.js` | Плавающая панель (JS) |
| `renderer/faces.html` | Окно камер участников (HTML) |
| `renderer/faces.js` | Окно камер участников (JS) |
| `package.json` | Версия, скрипты, dependencies, build config |
| `icon.ico` | Иконка (BMP-формат, 16/32/48/256px, ensureAlpha) |
| `AGENTS.md` | Этот гайд |

## Правила работы

1. **Не собирать .exe без команды пользователя.** Только готовить код.
2. **Перед сборкой** — архив старого .exe создаётся автоматически (prebuild-скрипт). Проверить `dist/Archive`.
3. **Release notes** — обновлять в `renderer/index.html` при каждой новой версии.
4. **Backward compatibility** — сервер обязан поддерживать старые клиенты. Дублировать сигналы.
5. **Не удалять i18n-ключи** без необходимости.
6. **Описание программы** — для «хомячков», без техтерминов. Фокус на главной фишке.
7. **Перед редактированием — прочитать** текущее содержимое файла.
8. **Не добавлять комментарии** в код без необходимости.

## История версий (кратко)

- **1.7.1** — Исправлены кнопки панели (onclick вместо DOMContentLoaded), PTT с панели (правая кнопка микрофона), исправлена кодировка PowerShell, уменьшен размер окна (680×520), возвращены ползунки громкости (починена CSS-ошибка), flex-wrap для 5 камер, модалка выбора окна — 3 колонки, авто-восстановление свёрнутых окон через PowerShell AppActivate
- **1.7.0** — Нативное окно выбора трансляции (Chromium getDisplayMedia, все окна включая свёрнутые), главное окно сворачивается при трансляции, отдельное окно камер участников внизу справа с ползунками громкости, плавающая панель как в главном окне
- **1.6.1** — Плавающая панель (только кнопки, те же иконки), исправление рации, выбор окна с превью, подсказка о свёрнутых окнах, вход/выход без накопления, выход из PTT любой кнопкой
- **1.6.0** — Выбор окна при шаринге, компактный режим шарера, ползунки громкости, рация для всех (2 режима микрофона)
- **1.5.1** — Ярлык на рабочий стол, улучшенная кнопка копирования
- **1.5.0** — Multi-user (до 5), i18n EN/RU, настройки, release notes
- **1.4.x** — Помощь, монохромные иконки, очередь ICE
- **1.3.0** — Облачный режим (Render.com), переключатель Локально/Интернет
- **1.2.2** — Исправление эха, повторное подключение
- **1.1.0** — Screen sharing, PTT
- **1.0.0** — Первая версия (LAN, встроенный сервер)
