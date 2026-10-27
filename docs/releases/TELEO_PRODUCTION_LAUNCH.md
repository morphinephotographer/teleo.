# TELEO — production launch на teleo.cc

Дата: 27 октября 2026. Версия: `v1.0.0` (первая production-метка; соответствует существующему `package.json` версии 1.0.0). Репозиторий и утверждённый интерфейс сохранены.

## Разрешение и исходное состояние

Владелец явно поручил production-запуск, публикацию, обычный push, merge по workflow репозитория и создание release tag. Аккаунт Wrangler совпадает с аккаунтом активной зоны `teleo.cc`. На старте:

- Worker `teleo-web`, заявленный в исходном корневом конфиге, не существует (API 10007); прежнего production deployment для rollback нет.
- Для `teleo.cc` нет A/AAAA/CNAME-ответов; `www.teleo.cc` возвращает NXDOMAIN. HTTPS не открывает приложение.
- Нет Workers routes/custom domains зоны teleo.cc и нет Pages-проектов аккаунта.
- Существующий staging `teleo-staging` работает отдельно. Его версия до запуска: `0deb1e24-1e6d-49c1-a7dd-9fd28987f422`, deployment `eb7c4f60-20f1-47d8-8bff-80a28b0f5a32`.
- OAuth Wrangler не разрешает читать общий DNS inventory и certificate packs через API (403). Публичный DNS и Workers/custom-domain inventory проверены. Привязка будет выполнена через Workers custom domains с проверкой конфликтов, без перезаписи посторонних записей.
- Главная ветка GitHub — существующая `codex/teleo-native-web-v1`. Правил PR в `.github` нет; production будет доставлен обычным PR/merge в эту ветку. Старые ветки и история сохраняются, force-push не используется.

## Схема публикации

Корневой `wrangler.jsonc` разворачивает существующий проект как Worker `teleo-web`: статические assets + тот же проверенный relay на одном origin. Production получает собственный ROOMS namespace и только создание SQLite-класса Room (v1); staging namespace не переносится и не изменяется. Новый frontend framework или проект не создавался.

`APP_ORIGIN=https://teleo.cc` задаёт единственный разрешённый API Origin. `www.teleo.cc` и обычный HTTP перенаправляются на основной HTTPS-адрес кодом 308 с сохранением пути/запроса; forwarded headers не определяют доверенный hostname. Workers.dev и preview URL production отключены. CSP разрешает только собственные соединения и data QR; нет cross-origin dev relay. Сохраняются no-referrer, nosniff, DENY и ограничения camera/microphone/geolocation. В production снимается staging noindex; staging по-прежнему noindex.

`X-Teleo-Commit` и `X-Teleo-Deployment` позволяют сопоставить публичный ответ с коммитом и версией Worker. WebSocket upgrade не пересоздаётся, его socket сохраняется. Build явно очищает `VITE_RELAY_URL`, чтобы QR и WSS использовали текущий production origin.

Wrangler в неинтерактивном режиме автоматически разрешает override DNS конфликтов. Поэтому production deploy runner требует терминал; публикация не должна молча перезаписать чужой origin/DNS. При конфликте перед продолжением нужны чтение и фиксация старой записи. Конфигурация затрагивает только `teleo.cc` и `www.teleo.cc`.

## Проверки и состояние публикации

Документ подготовлен перед публикацией. Итоговые идентификаторы и фактические публичные проверки будут внесены после выполнения. До внешней HTTPS-проверки статус LIVE не заявляется.

Проверенный кандидат готов к публикации:

| Проверка | Результат |
| --- | --- |
| TypeScript (web, relay, staging, production и worker tests) | Успешно |
| ESLint | Успешно |
| Unit/integration | 82/82, 9 файлов, 152,85 с |
| Полная браузерная регрессия | 134/134, 273,97 с |
| Production Worker, Chromium/WebKit/iPhone/iPad viewport | 32/32, 55,15 с |
| Production build + Wrangler dry-run | Успешно; APP_ORIGIN, ROOMS, ASSETS и version metadata проверены |
| Проверка frontend bundle на credential patterns | 0 совпадений; реальных `.env` нет, только `.env.example` |

В первоначальной локальной конфигурации Wrangler подставлял custom-domain hostname в запросы эмулятора, и строгий guard отвечал 404. Исправлен QA-конфиг: он использует тот же worker.ts, локальный APP_ORIGIN и отдельное локальное хранилище без custom-domain routes. Guard production не ослаблялся. После исправления все 32 сценария прошли. Функциональных падений в окончательных наборах нет.

Машинная сводка: [TELEO_PRODUCTION_TEST_RESULTS.json](TELEO_PRODUCTION_TEST_RESULTS.json). Просмотрены [desktop](screenshots/local-studio-desktop.png), [iPhone reader](screenshots/local-reader-iphone.png), [iPad/українська](screenshots/local-studio-ipad-uk.png), [пульт](screenshots/local-remote-text.png), [QR](screenshots/local-pairing-ipad.png), [iPhone Studio](screenshots/local-studio-iphone.png). Отражение текста на reader-снимке включено намеренно для проверки этой функции.

Локальные проверки включают полный unit/relay набор, существующую browser regression, отдельную production-сборку, четыре профиля браузера (desktop Chromium, desktop WebKit, iPhone и iPad viewport), CSP/Origin/redirect tests и dry-run конфигурации.

## Порядок выпуска

1. `npm run typecheck`, `npm run lint`, `npm test`, `npm run production:check`.
2. Полная browser regression и `npx playwright test --config playwright.production.config.ts`.
3. Визуальный просмотр снимков; проверка bundle на случайно включённые credentials.
4. Локальный проверенный коммит, обычный push release-ветки, PR и merge в главную ветку; получить точный merge SHA.
5. Из чистого checkout этого коммита выполнить в терминале `npm run deploy:production`. Домен и TLS создаются штатным Workers custom-domain механизмом Cloudflare.
6. Внешний HTTPS/TLS, assets/routes/reload, metadata, www redirect, сохранение сценария, языки, playback и отдельная HTTPS/WSS пара. Ни certificate bypass, ни подмена DNS для выдачи результата за публичный тест не допускаются.
7. При успешных проверках создать и отправить обычную аннотированную метку `v1.0.0` на опубликованный коммит. Итоговый отчёт записать отдельным коммитом без изменения runtime-кода.

## Rollback

Для следующих релизов, когда существует предыдущая production-версия, записать её ID и выполнить `npx wrangler rollback <previous-version-id> --config wrangler.jsonc`, затем повторить внешние проверки. Не удалять namespace, Room-класс или данные.

Для первого запуска предыдущего production-приложения нет. Если критические smoke-проверки не проходят после завершения DNS/TLS provisioning, снять только две newly-created Workers custom-domain привязки `teleo.cc`/`www.teleo.cc` у `teleo-web` (по записанным после публикации ID), восстановив исходное отсутствие веб-маршрута. Сохранить Worker и ROOMS namespace; не выполнять blanket Worker/DO/DNS deletion. Не менять staging и посторонние DNS-записи. Отдельно проверить, что Cloudflare managed-записи этих двух доменов сняты. Сертификаты при удалении custom domain могут остаться; не удалять посторонние сертификаты.

## Ограничения и данные

Автоматизированные мобильные viewport/WebKit проверки не являются физическим iPhone/iPad, камерой, VoiceOver или тестом Safari в фоне. Новая production-пара требует отдельного подтверждения на хосте; разрешённый preview временный и opt-in. Скрипты сохраняются в браузере, а не в облачной библиотеке. Библиотеки localhost, staging и teleo.cc изолированы по origin; перенос — явный TXT/JSON экспорт/импорт. Данные пользователя и секреты не переносились и не очищались. Native CloudKit, App Store, подпись Apple и физические HID-аксессуары не входят в этот web launch.

Технические основания: [Cloudflare Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), текущая локально установленная реализация Wrangler и фактические API/HTTPS проверки.
