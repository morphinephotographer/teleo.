# Teleo. — публикация согласованных изменений v3

По прямому разрешению владельца «опубликуй» выпущен проверенный коммит `b0e1d33390f343516a7a4804bf2e2d7801fade27` из ветки `codex/approved-controls-scroll-v3`.

- Production: https://teleo.cc/studio, Worker `teleo-web`, версия **`58b4993f-f74c-45b7-b50d-e84af332e8ed`**, подтверждено **100% трафика**.
- Staging: https://teleo-staging.your-subdomain.workers.dev/studio, версия `e82c051d-bde8-47e1-a912-ce7f5694b8ff`.
- Предыдущая рабочая production-версия для отката: `ccdbbb4c-40e5-432a-89fe-62ab11645b85`.
- Выпуск выполнен штатной командой `npm run deploy:production` из чистого закоммиченного состояния, в интерактивном терминале. Перед ним выполнены staging-проверка и production dry-run. Привязки доменов, архитектура, namespaces, миграции, версия пакета и пользовательские данные не изменены. GitHub push не выполнялся.
- Время Cloudflare readback: `2026-10-28T21:45:20.701Z` (28 октября 23:45:20 по Киеву).

## Проверки

| Проверка | Результат |
| --- | --- |
| Публичный staging: Chromium / WebKit / Firefox | **9/9 PASS**, 41,1 с |
| Публичный production: Chromium / WebKit / Firefox | **9/9 PASS**, 38,6 с |
| Production: маршруты, заголовки, версия, canonical redirect | **2/2 PASS**, Chromium / WebKit |
| SHA-256 публичных HTML / CSS / JS / service worker | **4/4 совпали** на staging и production |
| Повторная production-сборка при выпуске | **PASS**, все файлы побайтово совпали с проверенной staging-сборкой |
| Production dry-run и проверка типов | **PASS** |

Публичные функциональные сценарии повторяют проверки согласованного изменения: отсутствие воспроизведения в Editor, 13 элементов Reading в заданном порядке, неизменность SVG/геометрии верхней кнопки пульта, меню и сохранение настроек, клавиатурное удаление папок, ручное восстановление Welcome без дубликатов, реальное HTTPS/WSS-подключение, непрерывная шкала и прокрутка текста в обе стороны с согласованием координат при разном переносе, сохранение Play/Pause.

Проверка экранов пульта сохранила исходное пиксельное сравнение вне области прокручиваемого текста: 0 изменённых пикселей в каждом движке. Для публичной сборки тестовый измеритель координат собирается из того же исходного модуля и исполняется только в изолированных тестовых браузерах; сервер, приложение и CSP не изменяются. Заголовок CF-Connecting-IP не подменяется; выполнено по три создания комнаты на origin, действующие ограничения частоты сохранены.

Отдельно проверены `/`, `/studio`, `/remote`, `/help`, `/privacy`, `/sw.js`, защитные заголовки, отсутствие staging noindex и адресов localhost в CSP. `www.teleo.cc/studio?lang=ru` перенаправляется на canonical `teleo.cc` кодом 308 с сохранением пути и query. На всех проверенных ресурсах заголовки X-Teleo-Commit и X-Teleo-Deployment соответствуют коммиту и версии выше.

При загрузке assets Wrangler выполнил автоматические повторы и завершился успешно. Сверка публичных хешей использует браузерный HTTPS-канал: отдельная попытка Node HTTPS завершилась тайм-аутом. Служебный `_headers` обрабатывается Cloudflare и не является публичным файлом; HTML сверяется по каноническому `/`, поскольку `/index.html` перенаправляется. Эти особенности учтены в проверяющем инструменте; приложение не исправлялось и проверки файлов не ослаблялись.

## Снимки действующего production

Просмотрены снимки из успешного публичного прогона:

- [Reading — desktop](../screenshots/approved-v3-production-reading.png)
- [Reading — iPad/WebKit](../screenshots/approved-v3-production-ipad-reading.png)
- [Appearance / Editor](../screenshots/approved-v3-production-appearance.png)
- [Существующий пульт — WebKit](../screenshots/approved-v3-production-phone.png)

## Доказательства и ограничения

[Staging: публикация](evidence/approved-v3-publication/staging-deploy.txt) · [9 проверок staging](evidence/approved-v3-publication/staging-check.txt) · [Интерактивный production deploy](evidence/approved-v3-publication/production-deploy.txt) · [100% version readback](evidence/approved-v3-publication/production-deployment.txt) · [9 проверок production](evidence/approved-v3-publication/production-check.txt) · [Маршруты и заголовки](evidence/approved-v3-publication/production-routes.json) · [Хеши staging](evidence/approved-v3-publication/staging-assets.json) · [Хеши и идентификаторы production](evidence/approved-v3-publication/production-assets.json).

Физические iPhone/iPad, настоящий Safari и аппаратный R400 в этой публикации не проверялись. Chromium использует нативную эмуляцию touch, WebKit/Firefox — тестовые touch/scroll-события. Долгие отключения реальной сети, фоновый Safari и считывание QR камерой остаются отдельной ручной проверкой.

Для аварийного отката сохранён предыдущий version ID. Используется существующий процесс `wrangler rollback ccdbbb4c-40e5-432a-89fe-62ab11645b85 --config wrangler.jsonc` с повторной внешней проверкой. Откат не выполнялся. Namespace и пользовательские данные не удаляются.

Последующий коммит документации содержит только этот отчёт, доказательства и снимки; опубликованный исходный код остаётся `b0e1d33`.
