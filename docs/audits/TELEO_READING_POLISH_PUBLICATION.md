# Teleo. — публикация Welcome и обновлённого пульта

Владелец отдельно разрешил публикацию командой «опубликуй». Выпущен итоговый коммит **`e4fcb251df3b6ffdf238bedf76dd03d1b07f857c`** из `codex/remote-reading-polish`: исходная функциональность `5e56721` плюс проверенное исправление бюджета сообщений.

- Production: https://teleo.cc/studio, Worker `teleo-web`, версия **`ef94d8b5-ae38-4b60-934f-eb4fa7b3c8ba`**, подтверждено **100% трафика**.
- Staging: https://teleo-staging.your-subdomain.workers.dev/studio, итоговая версия `d6fda88b-1f48-4159-bef3-7d13e5c4a88e`.
- Время публикации по Киеву: **29.10.2026 01:06:36**.
- Предыдущая рабочая production-версия для отката: `58b4993f-f74c-45b7-b50d-e84af332e8ed` (приложение `b0e1d33`).

Выпуск выполнен штатным интерактивным `npm run deploy:production` из чистого коммита. Доменные привязки, namespaces, миграции и зависимости не менялись. Пользовательские правки и сохранённые настройки защищены существующим хранилищем. Нетронутый Welcome локализуется намеренно по заданию. GitHub push и удаление данных не выполнялись.

## Проверки окончательной версии

| Проверка | Результат |
| --- | --- |
| Локальные браузеры Chromium / WebKit / Firefox | **21/21 PASS** |
| Модульные проверки Welcome / управления / прокрутки / preview | **34/34 PASS**, 5 файлов |
| Публичный staging, три движка | **21/21 PASS** |
| Публичный production, три движка | **21/21 PASS** |
| Production: маршруты, заголовки, версия, www redirect | **2/2 PASS**, Chromium / WebKit |
| SHA-256 публичных HTML / CSS / JS / service worker | **4/4 совпали** на staging и production |
| Production-сборка, typecheck, lint | **PASS**; production-сборка побайтово совпала с проверенной staging-сборкой |

Публичные тесты используют реальные HTTPS/WSS, отдельные браузерные контексты и обычную клиентскую идентификацию, без подмены CF-Connecting-IP. Набор создаёт шесть комнат на origin, ограничения сервера сохранены. Проверены язык нетронутого Welcome, защита правок, удаление без повторного появления, восстановление, скрытие панели при Play и возврат при паузе, отдельная пауза сверху, корзина сценариев, настройки языка/тем, непрерывная перемотка, 18 pt в обоих просмотрах пульта, направляющая 35% → 60%, точность позиции менее двух символов, touch, приватность и переподключение.

Маршруты `/`, `/studio`, `/remote`, `/help`, `/privacy`, `/sw.js` возвращают ожидаемые ответы и защитные заголовки; X-Teleo-Commit и X-Teleo-Deployment совпадают с итоговым коммитом и версией на всех проверенных ресурсах. `www` возвращает 308 на canonical URL с сохранением пути/query. Служебный `_headers` обрабатывается Cloudflare, HTML сверяется по каноническому `/`.

## Исправление, найденное до production

Первый staging-кандидат `5e56721` прошёл 19/21 публичных сценариев. В Chromium тест повторно открывал popover до обновления aria-expanded; в WebKit при быстрой перемотке оборвалось соединение. Диагностика показала пик отправки хоста на границе лимита 20 сообщений/с. В исходном production в этот момент оставался предыдущий исправный выпуск.

В итоговом `e4fcb25` убраны дубли previewPosition после seek: позиция публикуется штатно с частотой 4 Гц, а пульт отправляет не более пяти команд перемотки в секунду. Кадровая интерполяция сохранена; лимит relay не повышался. Добавлен тест бюджета и более длительное перетаскивание. Открытие меню проверяется по фактической видимости; независимый жест начинается после завершения предшествующей анимации, без снятия проверок направления и точности.

После исправления выполнены полные успешные прогоны локально, на staging и в production. В production диагностический пик хоста составил **12–13 сообщений/с** во всех трёх движках. [Бюджет staging](evidence/reading-polish-publication/staging-message-budget.json) · [Бюджет production](evidence/reading-polish-publication/production-message-budget.json). Частичные исходные проверки не выдавались за успех: [начальный staging-прогон](evidence/reading-polish-publication/initial-staging-check.txt).

## Просмотренные снимки действующего сайта

- [Play: панель скрыта](../screenshots/reading-polish-live-playing.png)
- [Пауза: панель видна](../screenshots/reading-polish-live-paused.png)
- [iPad/WebKit](../screenshots/reading-polish-live-ipad.png)
- [Настройки языка и тем](../screenshots/reading-polish-live-settings.png)
- [Корзина сценария](../screenshots/reading-polish-live-trash.png)
- [Пульт/WebKit: 18 pt и направляющая](../screenshots/reading-polish-live-phone.png)

[Staging 21/21](evidence/reading-polish-publication/staging-check.txt) · [Production 21/21](evidence/reading-polish-publication/production-check.txt) · [Публикация](evidence/reading-polish-publication/production-deploy.txt) · [100% readback](evidence/reading-polish-publication/production-deployment.txt) · [Маршруты](evidence/reading-polish-publication/production-routes.json) · [Хеши и идентификаторы production](evidence/reading-polish-publication/production-assets.json).

## Ограничения и откат

Физические iPhone/iPad и аппаратный R400 в этой публикации не проверялись. Эмуляция WebKit не заменяет настоящий Safari, работу в фоне iOS и реальные перебои сети. Для уже открытых вкладок следует обновить страницы на Mac и телефоне.

Для аварийного отката сохранена версия `58b4993f-f74c-45b7-b50d-e84af332e8ed`; используется существующий `wrangler rollback <version> --config wrangler.jsonc` с повторной внешней проверкой. Откат не выполнялся. Последующий коммит отчёта не меняет опубликованное приложение `e4fcb25`.
