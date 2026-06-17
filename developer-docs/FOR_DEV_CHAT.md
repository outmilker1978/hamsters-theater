## Гайд для чата разработки

### Где всё лежит

**Репозиторий:** `github.com/outmilker1978/hamsters-theater`

**Сайт (GitHub Pages):** папка `docs/`
- `docs/index.html` — главная страница
- `docs/blog.html` — блог с релизами и статьёй "Как смотреть вместе без лагов"
- `docs/style.css` — стили
- `docs/script.js` — JS с переводами и Release API
- URL: `https://tvhamsters.outmilk.online/`

**Боты:**
- @tv_hamsters_bot — комнаты, токен в GitHub Secret `TELEGRAM_BOT_TOKEN`
- @tvhamsters — канал, ID `-1003813372615`
- @tvhamsters_release_bot — не используется, токен неизвестен

**GitHub Actions:** `.github/workflows/release-to-telegram.yml`
- Триггер: на новый релиз GitHub
- ✅ **Работает** (починен: добавлен `html.escape()` на release notes)

**Полный гайд:** `developer-docs/COMPREHENSIVE_GUIDE.md`

### На чём остановился

**Текущая версия:** 1.8.2

**Сделано и работает:**
- Сайт: лендинг, рус/англ/исп, форма связи, release notes с GitHub API
- GitHub Actions на деплой
- Донаты: Boosty + CloudTips
- Yandex.Metrica на сайте
- Release-to-Telegram: уведомления при публикации релиза работают
- Блог-статья "Как смотреть вместе без лагов" (RU/EN/ES) со скриншотами

**Что нужно доделать:**
1. GitHub API rate limit для release notes — кешировать через GitHub Actions
2. Обновить статьи на платформах (Pikabu, Dzen) под новую версию
