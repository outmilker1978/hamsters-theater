## Гайд для чата разработки

### Где всё лежит

**Репозиторий:** `github.com/outmilker1978/hamsters-theater`

**Сайт (GitHub Pages):** папка `docs/`
- `docs/index.html` — главная страница
- `docs/blog.html` — блог с релизами
- `docs/style.css` — стили
- `docs/script.js` — JS с переводами и Release API
- URL: `https://tvhamsters.outmilk.online/`

**Боты:**
- @tv_hamsters_bot — комнаты, токен `8776055170:AAE04...` лежит в GitHub Secret `TELEGRAM_BOT_TOKEN`
- @tvhamsters — канал, ID `-1003813372615`, пустой
- @tvhamsters_release_bot — назначение неизвестно, токен неизвестен

**GitHub Actions:** `.github/workflows/release-to-telegram.yml`
- Триггер: на новый релиз GitHub
- Сейчас не работает (бот не может писать в канал)

**Полный гайд:** `developer-docs/COMPREHENSIVE_GUIDE.md`

### На чём остановился

**Сделано и работает:**
- Сайт: лендинг, рус/англ, форма связи, release notes с GitHub API
- GitHub Actions на деплой
- Донаты: Boosty + CloudTips
- Yandex.Metrica на сайте

**Проблема (не решена):**
- Бот @tv_hamsters_bot НЕ может отправить сообщение в канал @tvhamsters
- Ошибка: `Forbidden: bot is not a member of the channel chat`
- Канал существует, бот добавлен в админы (по словам автора), но API говорит обратное
- Вероятно: в админы добавлен другой бот (@tvhamsters_release_bot?) или нужен новый бот для канала

**Что нужно доделать:**
1. GitHub API rate limit для release notes (кешировать)
