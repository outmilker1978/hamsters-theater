# TV Hamsters — Полный технический гайд для разработчика

> Документ создан в рамках сотрудничества Product Owner (PO) и AI-ассистента.
> Все, что делали до этого момента, описано ниже. Этот документ заменяет несколько
> более мелких (AGENTS.md, developer-docs/README.md) и дополняет их актуальной
> информацией по ботам, сайту, интеграциям и текущим проблемам.

---

## 1. Проект в целом

| Параметр | Значение |
|----------|----------|
| Продукт | TV Hamsters — десктопное приложение для совместного просмотра видео онлайн |
| Платформа | Windows (portable single .exe) |
| Движок | Electron 34 |
| Сеть | WebRTC P2P mesh (до 5 участников) + Socket.IO сигналинг |
| Репозиторий | `github.com/outmilker1978/hamsters-theater` |
| Сайт | `tvhamsters.outmilk.online` (GitHub Pages, кастомный домен) |
| Владелец | Outmilk (outmilker1978 на GitHub) |
| email | outmilker@gmail.com |
| Текущая версия | 1.7.4 |
| Модель | Freemium (Free 5 users → Pro 20 → Business 100+) |
| Аналитика | Yandex.Metrica (счётчик 109746304) |

---

## 2. Сайт (GitHub Pages)

### 2.1. Адреса

| Назначение | URL |
|------------|-----|
| Основной сайт | `https://tvhamsters.outmilk.online/` |
| Блог | `https://tvhamsters.outmilk.online/blog.html` |
| GitHub Pages raw | `https://outmilker1978.github.io/hamsters-theater/` |

### 2.2. Хостинг

- **Платформа:** GitHub Pages (бесплатно)
- **Источник:** папка `/docs` в корне репозитория
- **Домен:** кастомный, привязан через файл `docs/CNAME` (содержит `tvhamsters.outmilk.online`)
- **DNS (reg.ru):**
  - CNAME `tvhamsters` → `outmilker1978.github.io`
  - A-запись `tvhamsters` → `185.199.108.153` (один из IP GitHub Pages)

### 2.3. Структура папки `docs/`

```
docs/
├── CNAME                     # Привязка кастомного домена
├── index.html                # Главная лендинг-страница (396 строк)
├── blog.html                 # Страница блога со списком релизов
├── join.html                 # Страница подключения к комнате
├── style.css                 # Стили (тёмная тема, фиолетовые акценты)
├── script.js                 # Логика: i18n, API GitHub, отправка формы
├── mobile/                   # Мобильный клиент (заглушка "Soon")
├── Screenshot_1.png          # Скриншоты приложения
├── Screenshot_2.png
├── Screenshot_3.png
├── icon.png                  # Иконка для сайта
├── icon256.png
├── article_pikabu.md         # Статья для Пикабу
├── article_dzen.md           # Статья для Дзен (черновик)
└── article_pikabu_dzen.md    # Комбинированная статья
```

### 2.4. Функционал сайта

- **Лендинг:** Hero → Features → Use Cases → Screenshots → Manual → Team → Contact → Download → Footer
- **Две локали:** Русский / English (переключение в хедере, сохраняется в localStorage ключ `tvh_lang`)
- **Форма обратной связи:** FormSubmit.co
  - Action: `https://formsubmit.co/ajax/f454d2a1c6f1ddb50020834507d9c29a`
  - Приходит на email: `outmilker@gmail.com`
  - Режим: AJAX (без перезагрузки, без редиректа)
- **SEO:** Open Graph, JSON-LD (SoftwareApplication), meta description, canonical
- **Аналитика:** Yandex.Metrica (счётчик `109746304`) на `index.html` и `blog.html`
- **Динамическая загрузка:** версия, размер файла, ссылка на скачивание и release notes — через GitHub Releases API
- **Release Notes:** форматирование из тела релиза GitHub (h1, h2, p; без эмодзи, без двоеточий в заголовках; английский перевод в `releaseNotesEN`)
- **Easter egg:** ссылка "испанский язык" — `tg://resolve?domain=happy_spanish` с HTTPS fallback

### 2.5. Зависимости сайта

Сайт полностью статический (HTML + CSS + JS). Единственная внешняя зависимость — FormSubmit для обратной связи. Шрифты — системные sans-serif.

---

## 3. Боты Telegram

### 3.1. @tv_hamsters_bot (он же TV Hamsters Bot)

| Параметр | Значение |
|----------|----------|
| **Username** | `@tv_hamsters_bot` |
| **Отображаемое имя** | TV Hamsters Bot |
| **Токен** | `8436143691:AAGoIli9sD4Y84Iy0gOOT3N6jsMmYLpL5vs` |
| **Где хранится токен** | GitHub Secret `TELEGRAM_BOT_TOKEN` |
| **Назначение** | Создание комнат для просмотра из чата Telegram |
| **Ссылка** | `t.me/tv_hamsters_bot` |
| **Код** | Папка `bot/` в корне репозитория |
| **Статус** | Работает |

**Что умеет:**
- Создаёт комнаты (команды /create, /start)
- Генерирует ссылки для подключения (`hamsters://` deep-link)
- Использует Socket.IO для взаимодействия с сервером

**Где используется в коде:**
- `bot/` — код самого бота
- `.github/workflows/release-to-telegram.yml` — токен через `secrets.TELEGRAM_BOT_TOKEN`
- `renderer/index.html`, `renderer/app.js` — donate links (Boosty / CloudTips)

### 3.2. @tvhamsters (канал)

| Параметр | Значение |
|----------|----------|
| **Тип** | Telegram Channel (не бот) |
| **Username** | `@tvhamsters` |
| **ID** | `-1003813372615` |
| **Название** | TV Hamsters |
| **Ссылка** | `t.me/tvhamsters` |
| **Назначение** | Новости, анонсы релизов, информация о продукте |
| **Статус** | Создан, но пустой (ни одного поста) |

**Текущая проблема:**
Бот `@tv_hamsters_bot` НЕ может отправить сообщение в канал. Ошибка: `Forbidden: bot is not a member of the channel chat`.

**Что было сделано для диагностики:**
- `getChat` на `@tvhamsters` — успешно, канал существует
- `getChatAdministrators` — `member list is inaccessible` (бот не админ)
- `getUpdates` — бот видит только личный чат с `outmilker` (id 162363099), никаких обновлений от канала
- Попытка использовать числовой id `-1003813372615` — та же ошибка 403
- GitHub secret `TELEGRAM_BOT_TOKEN` был пуст — исправлено, теперь содержит правильный токен

**Вероятные причины:**
1. В админы добавлен **другой** бот (возможно @tvhamsters_release_bot), не @tv_hamsters_bot
2. Бот был добавлен, но не подтвердил участие (некоторые каналы требуют, чтобы бот сначала был участником)
3. Канал создан через Telegram API (@tvhamsters_release_bot мог быть создателем)

**Для решения:**
- Удалить @tv_hamsters_bot из админов канала
- Снова добавить через **Добавить администратора** → найти `@tv_hamsters_bot` → дать права **Send Messages**
- Или: создать нового бота для постов в канал, его токен положить в отдельный GitHub secret

### 3.3. @tvhamsters_release_bot

| Параметр | Значение |
|----------|----------|
| **Username** | `@tvhamsters_release_bot` |
| **Токен** | НЕИЗВЕСТЕН |
| **Назначение** | Предположительно для релизов, но не задокументирован |
| **Статус** | Создан, но не используется / не интегрирован |

**Примечание:** упомянут пользователем, но автор не помнит, зачем создавал. Возможно, именно этот бот является админом канала `@tvhamsters`, а не `@tv_hamsters_bot`.

### 3.4. Сводка по ботам

| Бот | Токен | В GitHub Secrets | Назначение | Статус |
|-----|-------|------------------|------------|--------|
| @tv_hamsters_bot | `8436143691:...` | ✅ `TELEGRAM_BOT_TOKEN` | Создание комнат | Работает |
| @tvhamsters_release_bot | Неизвестен | ❌ Нет | Неизвестно | Не используется |

---

## 4. GitHub Actions

### 4.1. Release to Telegram

| Параметр | Значение |
|----------|----------|
| **Файл** | `.github/workflows/release-to-telegram.yml` |
| **Триггеры** | `release: [published]` + `workflow_dispatch` |
| **Назначение** | Автоматически постить о новом релизе в Telegram-канал |
| **Статус** | НЕ РАБОТАЕТ (бот не в канале) |

**Текущее состояние workflow (на момент передачи):**
```yaml
name: Release to Telegram
on:
  release:
    types: [published]
  workflow_dispatch:
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Send to Telegram
        run: |
          echo "=== Кто админы в канале ==="
          ADMINS=$(curl -s "https://api.telegram.org/bot${{ secrets.TELEGRAM_BOT_TOKEN }}/getChatAdministrators?chat_id=-1003813372615")
          echo "$ADMINS"
```

**Проблема:** После исправления пустого секрета, workflow всё ещё не может отправить сообщение, так как бот не является участником/админом канала. Текущая версия workflow — диагностическая (показывает админов). Требуется переписать на отправку форматированного сообщения о релизе.

---

## 5. Интеграции

### 5.1. Сайт ↔ GitHub Releases

**Механизм:** `docs/script.js` (строки 304-346) через GitHub API:
```
GET https://api.github.com/repos/outmilker1978/hamsters-theater/releases/latest
```

- Получает последний релиз
- Обновляет версию, ссылку на скачивание, размер файла
- Форматирует release notes
- Работает в рантайме (браузер пользователя)

**Ограничения:** GitHub API rate limit 60 запросов/час с IP пользователя. Для production нужно кеширование или прокси.

### 5.2. Сайт ↔ FormSubmit (обратная связь)

**Механизм:** `docs/script.js` строки 283-301, AJAX POST на FormSubmit.
- Verification code: `f454d2a1c6f1ddb50020834507d9c29a`

### 5.3. Сайт ↔ Telegram

На данный момент — только ссылки в хедере и подвале сайта (на канал и бота). Автоматической интеграции site→telegram нет.

### 5.4. Сайт ↔ Yandex.Metrica

Счётчик `109746304` вставлен в `index.html` (строки 40-41) и `blog.html`.

---

## 6. Текущие проблемы и TODO

### P0 (критично)
- **Telegram-канал пуст:** бот @tv_hamsters_bot не может постить в @tvhamsters. Нужно добавить бота в админы или найти/восстановить токен от другого бота
- **Workflow release-to-telegram не работает:** по той же причине

### P1 (важно)
- **Сайт и GitHub Releases:** rate limit API GitHub. Нужно кешировать данные или использовать GitHub Actions для генерации статического JSON
- **Мобильный клиент:** страница `docs/mobile/` — заглушка "Soon", нет реализации

### P2 (среднее)
- **Статья на Дзен:** черновик сохранён (`docs/article_dzen.md`), но не опубликован (требуется верификация телефона)
- **Сборка .exe:** winCodeSign extraction fails на Windows (symlink issue) — не критично для portable-сборки

### P3 (низкое)
- **Кастомная почта:** используется `outmilker@gmail.com`, вместо `@outmilk.online`
- **Юридическое лицо:** не зарегистрировано, проект ведётся как физическое лицо
- **Аналитика:** Yandex.Metrica установлена, но данных пока нет (ждём первую неделю)

---

## 7. Варианты развития (технические)

### 7.1. Telegram-бот для канала
Создать нового бота через @BotFather специально для постинга в канал. Токен хранить в GitHub Secret `TELEGRAM_CHANNEL_BOT_TOKEN` (отдельно от бота комнат). Это чище, чем использовать @tv_hamsters_bot.

### 7.2. Кеширование GitHub API
- **Вариант A:** Воркфлоу на GitHub Actions, который при push в master обновляет JSON-файл в `docs/` с информацией о последнем релизе
- **Вариант B:** Использовать деплой-хуки или GitHub Webhooks

### 7.3. Webhook от Telegram
Прикрутить Telegram Bot Webhook вместо polling. Сейчас бот комнат работает через polling (не указано в документации, но типично для простых ботов). Webhook надёжнее.

### 7.4. Интеграция FormSubmit → Telegram
При получении формы обратной связи с сайта, FormSubmit может отправлять уведомление в Telegram (через `sendMessage`). Сейчас письма приходят на email.

### 7.5. Мониторинг статуса ботов
Страница `/status.html` с простыми индикаторами: бот жив/мёртв, последний релиз, версия.

---

## 8. Быстрый старт для разработчика

```bash
# Клонирование
git clone https://github.com/outmilker1978/hamsters-theater.git
cd hamsters-theater

# Установка зависимостей
npm install

# Запуск в режиме разработки
npm start

# Сборка .exe
npm run build

# Сборка portable .exe
npm run build-portable
```

### Структура для быстрой навигации

```
hamsters-theater/
├── main.js                      # Electron main process + встроенный сервер
├── renderer/
│   ├── index.html               # Главное окно приложения
│   ├── app.js                   # Логика WebRTC, PTT, UI
│   ├── style.css                # Стили приложения
│   ├── i18n.js                  # Локализация RU/EN
│   ├── panel.html / panel.js    # Плавающая панель при трансляции
│   └── faces.html / faces.js    # Окно камер участников
├── bot/                         # Код Telegram-бота
├── server/                      # Облачный сервер (Render.com)
├── docs/                        # Сайт (GitHub Pages)
│   ├── index.html
│   ├── style.css
│   └── script.js
├── .github/workflows/
│   └── release-to-telegram.yml  # CI/CD: уведомление о релизе
└── package.json                 # Конфигурация и скрипты
```

### Ключевые ссылки

| Ресурс | URL |
|--------|-----|
| Репозиторий | https://github.com/outmilker1978/hamsters-theater |
| Сайт | https://tvhamsters.outmilk.online |
| GitHub Actions | https://github.com/outmilker1978/hamsters-theater/actions |
| Secrets | https://github.com/outmilker1978/hamsters-theater/settings/secrets/actions |
| Secrets: токен бота | `TELEGRAM_BOT_TOKEN` = `8436143691:AAGoIli9sD4Y84Iy0gOOT3N6jsMmYLpL5vs` |
| Канал Telegram | https://t.me/tvhamsters |
| Бот комнат | https://t.me/tv_hamsters_bot |
| Cloud-сервер | https://hamsters-theater-cloud.onrender.com |
| CloudTips | https://pay.cloudtips.ru/p/8485a55c |
| Boosty | https://boosty.to/outmilker |
| Yandex.Metrica | Счётчик 109746304 |
| Team email | outmilker@gmail.com |
| Домен (reg.ru) | outmilk.online |
