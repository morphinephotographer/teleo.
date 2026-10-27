> Historical verification of the preceding release. The v0.6.1 alignment/text-sheet and localhost QR behavior supersedes the corresponding UI descriptions: [current audit](audits/TELEO_V061_ALIGNMENT_QR_FIX.md).

# Результаты отдельных автоматических тестов

Итоговая проверка teleo., 27 октября 2026. Каждый ряд — фактический результат репортера. Повторные наборы пересекаются по продуктовым сценариям; количества между ними не суммируются как уникальные функции. Тестовые профили и тексты изолированы от личной библиотеки.

## Vitest / relay

76/76 PASS.

| Файл и тест | Результат | мс |
|---|---|---:|
| tests/control.test.ts — v0.6 approved controls keeps legacy commands and rejects missing, unexpected or out-of-range values | passed | 1.390041999999994 |
| tests/control.test.ts — v0.6 approved controls allowlists typography and secondary preferences with exact types and bounds | passed | 0.3245410000000106 |
| tests/control.test.ts — v0.6 approved controls transfers only numeric/boolean control metadata and preserves old state compatibility | passed | 0.432124999999985 |
| tests/control.test.ts — v0.6 approved controls derives finite estimated time from actual scroll distance and existing 40px/s speed model | passed | 0.5403749999999832 |
| tests/domain.test.ts — elapsed-time engine moves equally at 60 and 120 Hz | passed | 2.6877079999999864 |
| tests/domain.test.ts — elapsed-time engine caps stalls and preserves pause/resume | passed | 0.29554100000001426 |
| tests/domain.test.ts — elapsed-time engine ends cleanly, restarts and skips paragraphs | passed | 0.18920800000000781 |
| tests/domain.test.ts — elapsed-time engine clamps speed and validates all commands | passed | 0.5067920000000186 |
| tests/domain.test.ts — elapsed-time engine uses idempotent play/pause and bounded countdown | passed | 0.4500840000000039 |
| tests/domain.test.ts — portable storage roundtrips Unicode, RTL, empty lines and empty scripts | passed | 9.540999999999997 |
| tests/domain.test.ts — portable storage rejects invalid schema, limits and preference types | passed | 2.4357499999999845 |
| tests/domain.test.ts — portable storage saves, revises, restores and retains tombstones | passed | 14.816624999999988 |
| tests/domain.test.ts — portable storage bounds revisions and safely removes folders | passed | 12.035792000000015 |
| tests/domain.test.ts — keyboard adapter excludes typing and non-reader contexts | passed | 0.19420900000000074 |
| tests/domain.test.ts — keyboard adapter excludes repeat | passed | 0.08199999999999363 |
| tests/domain.test.ts — keyboard adapter excludes isComposing | passed | 0.049458000000015545 |
| tests/domain.test.ts — keyboard adapter excludes metaKey | passed | 0.03145799999998644 |
| tests/domain.test.ts — keyboard adapter excludes ctrlKey | passed | 0.03462500000000546 |
| tests/domain.test.ts — keyboard adapter excludes altKey | passed | 0.02691600000002836 |
| tests/domain.test.ts — keyboard adapter normalizes delivered HID codes | passed | 0.054666999999994914 |
| tests/domain.test.ts — localization en has complete nonempty key parity | passed | 0.2705829999999878 |
| tests/domain.test.ts — localization uk has complete nonempty key parity | passed | 0.20041700000001583 |
| tests/domain.test.ts — localization ru has complete nonempty key parity | passed | 0.32183400000002393 |
| tests/domain.test.ts — localization detects regional languages, overrides and fallback | passed | 0.14104100000002973 |
| tests/domain.test.ts — reads canonical cross-platform fixture | passed | 0.11670799999996007 |
| tests/drafts.test.ts — completion of an older write keeps the newer recovery draft and Saving state | passed | 14.55966699999999 |
| tests/drafts.test.ts — an older completion cannot acknowledge a newer already queued write | passed | 0.9828749999999786 |
| tests/drafts.test.ts — failed stale writes cannot overwrite a newer queued snapshot | passed | 0.9146660000000111 |
| tests/drafts.test.ts — a latest failed draft stays recoverable and can be retried | passed | 0.5838750000000346 |
| tests/drafts.test.ts — destructive operations require successful durable writes, while recovery stays retryable | passed | 1.0715829999999755 |
| tests/feedback.test.ts — unsupported browsers expose no vibration capability and never throw | passed | 4.950749999999971 |
| tests/feedback.test.ts — a supported API is optional and a throwing API cannot block the action | passed | 0.9194159999999556 |
| tests/pairing-origin.test.ts — never offers a physical-phone QR for http://127.0.0.1:5173 | passed | 0.8957499999999925 |
| tests/pairing-origin.test.ts — never offers a physical-phone QR for https://localhost:5183 | passed | 0.0972500000000025 |
| tests/pairing-origin.test.ts — never offers a physical-phone QR for http://[::1]:5173 | passed | 0.07262500000000216 |
| tests/pairing-origin.test.ts — never offers a physical-phone QR for http://127.1.2.3:5173 | passed | 0.09416699999999878 |
| tests/pairing-origin.test.ts — requires trusted HTTPS on LAN and uses the actual reachable origin | passed | 0.13275000000000148 |
| tests/preview.test.ts — rejects private text by default and clears text, title and partial chunks on revocation | passed | 1.237792000000013 |
| tests/preview.test.ts — accepts only matching session, permission epoch and increasing relay sequence | passed | 0.20616699999999355 |
| tests/preview.test.ts — assembles bounded snapshots and never mixes script revisions | passed | 0.1839170000000081 |
| tests/preview.test.ts — a new session resets ordering but stale permissions cannot revive revoked content | passed | 0.30316699999997354 |
| tests/preview.test.ts — validates exact shapes, versions, chunk bounds, numeric positions and content limits | passed | 0.2184169999999881 |
| tests/preview.test.ts — content revision changes with edits or script identity; paragraph offsets preserve Unicode | passed | 8.595500000000015 |
| tests/preview.test.ts — authoritative position has multiplier units and rejects stale state or invalid speed | passed | 0.7599580000000401 |
| tests/preview.test.ts — oversized or pathological paragraph snapshots are declined without retaining private data | passed | 0.5175830000000019 |
| tests/relay.test.ts — real Durable Object runtime rejects missing/foreign Origin and wrong routes | passed | 22.76166699999999 |
| tests/relay.test.ts — real Durable Object runtime approval, ACK, replay suppression and hibernation restore | passed | 260.440417 |
| tests/relay.test.ts — real Durable Object runtime one invitation admits exactly one simultaneous controller | passed | 50.696541000000025 |
| tests/relay.test.ts — real Durable Object runtime denies and invalidates invitation permanently | passed | 54.27862499999992 |
| tests/relay.test.ts — real Durable Object runtime does not revoke authenticated host when invalid outsider closes | passed | 45.27770900000007 |
| tests/relay.test.ts — real Durable Object runtime never sends content-bearing commands, rejects invalid role and preapproval | passed | 46.02545900000018 |
| tests/relay.test.ts — real Durable Object runtime rejects stale ACK and closes session | passed | 55.47600000000011 |
| tests/relay.test.ts — real Durable Object runtime limits messages and creation rate | passed | 75.290708 |
| tests/relay.test.ts — real Durable Object runtime expires real one-use invitations after 120 seconds | passed | 120123.07454199999 |
| tests/relay.test.ts — bounded authorized reconnect resumes controller after hibernation; preserves replay ledger and asks for fresh state | passed | 162.8612909999938 |
| tests/relay.test.ts — bounded authorized reconnect can replace a stale host socket without its late close revoking the new host | passed | 76.10079199999745 |
| tests/relay.test.ts — bounded authorized reconnect rejects invite replay, wrong resume key, and resume before approval | passed | 108.24304100000882 |
| tests/relay.test.ts — bounded authorized reconnect revocation while a peer is offline invalidates its resume key | passed | 69.18566600000486 |
| tests/relay.test.ts — bounded authorized reconnect expires the real 30-second recovery window and rejects the saved capability | passed | 30156.083415999994 |
| tests/relay.test.ts — resumes both peers after a real runtime restart using durable hashes and deadlines | passed | 172.95966700001736 |
| tests/relay.test.ts — permission-scoped ephemeral text preview defaults off, requires host consent, forwards bounded content and never stores body/title | passed | 167.15379200002644 |
| tests/relay.test.ts — permission-scoped ephemeral text preview rejects controller permission escalation and controller-authored text | passed | 111.783792000002 |
| tests/relay.test.ts — permission-scoped ephemeral text preview revokes delivery immediately and rejects stale consent epochs after re-grant | passed | 139.22058300001663 |
| tests/relay.test.ts — permission-scoped ephemeral text preview rejects oversized chunks and requests fresh host content after hibernation | passed | 193.19866699998965 |
| tests/relay.test.ts — v0.6 numeric controls on the existing authenticated channel forwards seek/typography once, ACKs authoritative metadata, and keeps text denied | passed | 118.9907499999972 |
| tests/relay.test.ts — v0.6 numeric controls on the existing authenticated channel rejects unknown preference names and malformed typed state | passed | 55.84887499999604 |
| tests/remote-client.test.ts — browser reconnect lifecycle uses independent in-memory resume capability and never replays an uncertain command | passed | 26.98170799999997 |
| tests/remote-client.test.ts — browser reconnect lifecycle stops after the 25-second retry budget even if the server never responds | passed | 0.9027090000000157 |
| tests/remote-client.test.ts — browser reconnect lifecycle does not retry terminal close 1008 | passed | 0.3502500000000168 |
| tests/remote-client.test.ts — browser reconnect lifecycle does not retry terminal close 4000 | passed | 0.3461669999999799 |
| tests/remote-client.test.ts — browser reconnect lifecycle does not retry terminal close 4001 | passed | 0.27049999999997 |
| tests/remote-client.test.ts — browser reconnect lifecycle explicit close cancels recovery and stale handlers cannot mutate a new session | passed | 0.32954200000000355 |
| tests/remote-client.test.ts — browser reconnect lifecycle blocks offline commands, times out unacknowledged requests and rejects stale state | passed | 0.4300840000000221 |
| tests/remote-client.test.ts — browser reconnect lifecycle never attempts automatic recovery before host approval | passed | 0.24066699999997354 |
| tests/remote-client.test.ts — a replaced peer invalidates pending ACKs even without a preceding reconnecting event | passed | 0.267832999999996 |
| tests/remote-client.test.ts — closing while room creation is in flight cannot open a late background socket | passed | 2.577500000000043 |

## Полный desktop/mobile Chromium

126 PASS; skipped=0, flaky=0; 272.3 с.

| Проект / файл / тест | Результат | мс |
|---|---|---:|
| desktop / approved.spec.ts / en: approved four screens, operational dock and synchronization | passed | 9810 |
| desktop / approved.spec.ts / uk: approved four screens, operational dock and synchronization | passed | 9557 |
| desktop / approved.spec.ts / ru: approved four screens, operational dock and synchronization | passed | 9074 |
| desktop / approved.spec.ts / expired invitation clears QR/link and renewal allocates a fresh invite | passed | 1949 |
| desktop / approved.spec.ts / room creation failure is reported as unreachable without a stale invitation | passed | 868 |
| desktop / approved.spec.ts / a queued typography gesture is cancelled when the host switches scripts | passed | 2573 |
| mobile / approved.spec.ts / en: approved four screens, operational dock and synchronization | passed | 9536 |
| mobile / approved.spec.ts / uk: approved four screens, operational dock and synchronization | passed | 9356 |
| mobile / approved.spec.ts / ru: approved four screens, operational dock and synchronization | passed | 9552 |
| mobile / approved.spec.ts / expired invitation clears QR/link and renewal allocates a fresh invite | passed | 1496 |
| mobile / approved.spec.ts / room creation failure is reported as unreachable without a stale invitation | passed | 463 |
| mobile / approved.spec.ts / a queued typography gesture is cancelled when the host switches scripts | passed | 2049 |
| desktop / audit.spec.ts / en: complete final wordmark survives disabled CSS animations | passed | 1230 |
| desktop / audit.spec.ts / uk: complete final wordmark survives disabled CSS animations | passed | 835 |
| desktop / audit.spec.ts / ru: complete final wordmark survives disabled CSS animations | passed | 1036 |
| desktop / audit.spec.ts / failed save blocks folder deletion and preserves the latest draft | passed | 4490 |
| desktop / audit.spec.ts / failed trash write cannot silently delete a script after Cancel | passed | 2268 |
| desktop / audit.spec.ts / a queued typography frame cannot change a newly selected script playhead | passed | 3230 |
| mobile / audit.spec.ts / en: complete final wordmark survives disabled CSS animations | passed | 700 |
| mobile / audit.spec.ts / uk: complete final wordmark survives disabled CSS animations | passed | 628 |
| mobile / audit.spec.ts / ru: complete final wordmark survives disabled CSS animations | passed | 746 |
| mobile / audit.spec.ts / failed save blocks folder deletion and preserves the latest draft | passed | 4131 |
| mobile / audit.spec.ts / failed trash write cannot silently delete a script after Cancel | passed | 2122 |
| mobile / audit.spec.ts / a queued typography frame cannot change a newly selected script playhead | passed | 2444 |
| desktop / compact.spec.ts / en: compact studio keeps editing and settings inside the viewport | passed | 4044 |
| desktop / compact.spec.ts / uk: compact studio keeps editing and settings inside the viewport | passed | 4041 |
| desktop / compact.spec.ts / ru: compact studio keeps editing and settings inside the viewport | passed | 4058 |
| mobile / compact.spec.ts / en: compact studio keeps editing and settings inside the viewport | passed | 3807 |
| mobile / compact.spec.ts / uk: compact studio keeps editing and settings inside the viewport | passed | 3839 |
| mobile / compact.spec.ts / ru: compact studio keeps editing and settings inside the viewport | passed | 3891 |
| desktop / offline.spec.ts / production assets: all locales and scripts work offline | passed | 1605 |
| mobile / offline.spec.ts / production assets: all locales and scripts work offline | passed | 1270 |
| desktop / product.spec.ts / en: all routes, mobile overflow and metadata | passed | 1555 |
| desktop / product.spec.ts / en: editor persists, language switch preserves text, remote safety | passed | 2327 |
| desktop / product.spec.ts / uk: all routes, mobile overflow and metadata | passed | 1630 |
| desktop / product.spec.ts / uk: editor persists, language switch preserves text, remote safety | passed | 2550 |
| desktop / product.spec.ts / ru: all routes, mobile overflow and metadata | passed | 1549 |
| desktop / product.spec.ts / ru: editor persists, language switch preserves text, remote safety | passed | 2425 |
| desktop / product.spec.ts / first visit regional detection and manual override | passed | 5079 |
| desktop / product.spec.ts / storage-disabled language remains usable | passed | 857 |
| desktop / product.spec.ts / en: real relay, independent phone, approval, ACK and revoke | passed | 1861 |
| desktop / product.spec.ts / uk: real relay, independent phone, approval, ACK and revoke | passed | 2305 |
| desktop / product.spec.ts / ru: real relay, independent phone, approval, ACK and revoke | passed | 1974 |
| desktop / product.spec.ts / library CRUD, import/export and version restore | passed | 1371 |
| desktop / product.spec.ts / physical remote two-button learning, conflict and reader dispatch | passed | 1492 |
| mobile / product.spec.ts / en: all routes, mobile overflow and metadata | passed | 1513 |
| mobile / product.spec.ts / en: editor persists, language switch preserves text, remote safety | passed | 1799 |
| mobile / product.spec.ts / uk: all routes, mobile overflow and metadata | passed | 1547 |
| mobile / product.spec.ts / uk: editor persists, language switch preserves text, remote safety | passed | 1981 |
| mobile / product.spec.ts / ru: all routes, mobile overflow and metadata | passed | 1532 |
| mobile / product.spec.ts / ru: editor persists, language switch preserves text, remote safety | passed | 1801 |
| mobile / product.spec.ts / first visit regional detection and manual override | passed | 4491 |
| mobile / product.spec.ts / storage-disabled language remains usable | passed | 655 |
| mobile / product.spec.ts / en: real relay, independent phone, approval, ACK and revoke | passed | 1452 |
| mobile / product.spec.ts / uk: real relay, independent phone, approval, ACK and revoke | passed | 1515 |
| mobile / product.spec.ts / ru: real relay, independent phone, approval, ACK and revoke | passed | 1484 |
| mobile / product.spec.ts / library CRUD, import/export and version restore | passed | 1316 |
| mobile / product.spec.ts / physical remote two-button learning, conflict and reader dispatch | passed | 1385 |
| desktop / reconnect.spec.ts / en: real controller reconnect, current host state and revoke | passed | 4450 |
| desktop / reconnect.spec.ts / uk: real controller reconnect, current host state and revoke | passed | 4134 |
| desktop / reconnect.spec.ts / ru: real controller reconnect, current host state and revoke | passed | 3652 |
| desktop / reconnect.spec.ts / host reconnect keeps script and playback; unconfirmed command is not replayed | passed | 2609 |
| desktop / reconnect.spec.ts / prolonged relay outage stops retries and preserves the local reader | passed | 22932 |
| mobile / reconnect.spec.ts / en: real controller reconnect, current host state and revoke | passed | 3837 |
| mobile / reconnect.spec.ts / uk: real controller reconnect, current host state and revoke | passed | 3508 |
| mobile / reconnect.spec.ts / ru: real controller reconnect, current host state and revoke | passed | 3797 |
| mobile / reconnect.spec.ts / host reconnect keeps script and playback; unconfirmed command is not replayed | passed | 1548 |
| mobile / reconnect.spec.ts / prolonged relay outage stops retries and preserves the local reader | passed | 22108 |
| desktop / redesign.spec.ts / intro resolves, dismisses automatically and never replays during navigation or reload | passed | 4357 |
| desktop / redesign.spec.ts / intro skip works by keyboard and restores application focus | passed | 698 |
| desktop / redesign.spec.ts / reduced motion bypasses intro; remote deep links are never covered | passed | 533 |
| desktop / redesign.spec.ts / session storage denial still permits skipping and internal navigation | passed | 631 |
| desktop / redesign.spec.ts / en: desktop, tablet and phone layouts preserve editing and prompting | passed | 11537 |
| desktop / redesign.spec.ts / uk: desktop, tablet and phone layouts preserve editing and prompting | passed | 11594 |
| desktop / redesign.spec.ts / ru: desktop, tablet and phone layouts preserve editing and prompting | passed | 12036 |
| desktop / redesign.spec.ts / settings sheet traps focus, persists preferences and Escape preserves reader | passed | 1430 |
| desktop / redesign.spec.ts / viewport fullscreen fallback, collapsible library and simulated keyboard resize | passed | 1031 |
| mobile / redesign.spec.ts / intro resolves, dismisses automatically and never replays during navigation or reload | passed | 4291 |
| mobile / redesign.spec.ts / intro skip works by keyboard and restores application focus | passed | 424 |
| mobile / redesign.spec.ts / reduced motion bypasses intro; remote deep links are never covered | passed | 509 |
| mobile / redesign.spec.ts / session storage denial still permits skipping and internal navigation | passed | 594 |
| mobile / redesign.spec.ts / en: desktop, tablet and phone layouts preserve editing and prompting | passed | 12373 |
| mobile / redesign.spec.ts / uk: desktop, tablet and phone layouts preserve editing and prompting | passed | 12473 |
| mobile / redesign.spec.ts / ru: desktop, tablet and phone layouts preserve editing and prompting | passed | 12290 |
| mobile / redesign.spec.ts / settings sheet traps focus, persists preferences and Escape preserves reader | passed | 1678 |
| mobile / redesign.spec.ts / viewport fullscreen fallback, collapsible library and simulated keyboard resize | passed | 1056 |
| desktop / staging.spec.ts / staging serves assets, security headers and strict same-origin API routing | passed | 157 |
| desktop / staging.spec.ts / en: production assets and real phone relay share the staging origin | passed | 2199 |
| desktop / staging.spec.ts / uk: production assets and real phone relay share the staging origin | passed | 2057 |
| desktop / staging.spec.ts / ru: production assets and real phone relay share the staging origin | passed | 3035 |
| desktop / staging.spec.ts / empty library stays beside its sidebar at medium window width | passed | 229 |
| mobile / staging.spec.ts / staging serves assets, security headers and strict same-origin API routing | passed | 155 |
| mobile / staging.spec.ts / en: production assets and real phone relay share the staging origin | passed | 2521 |
| mobile / staging.spec.ts / uk: production assets and real phone relay share the staging origin | passed | 2493 |
| mobile / staging.spec.ts / ru: production assets and real phone relay share the staging origin | passed | 3622 |
| mobile / staging.spec.ts / empty library stays beside its sidebar at medium window width | passed | 398 |
| desktop / v031.spec.ts / en: every host picker and contextual menu selects and dismisses | passed | 6197 |
| desktop / v031.spec.ts / uk: every host picker and contextual menu selects and dismisses | passed | 6294 |
| desktop / v031.spec.ts / ru: every host picker and contextual menu selects and dismisses | passed | 6214 |
| desktop / v031.spec.ts / picker positioning at every required viewport; outside/Escape and dark sheet fallback | passed | 9007 |
| desktop / v031.spec.ts / en: real private preview, round controls, revisions, revoke and reconnect | passed | 5382 |
| desktop / v031.spec.ts / uk: real private preview, round controls, revisions, revoke and reconnect | passed | 5683 |
| desktop / v031.spec.ts / ru: real private preview, round controls, revisions, revoke and reconnect | passed | 5587 |
| mobile / v031.spec.ts / en: every host picker and contextual menu selects and dismisses | passed | 7857 |
| mobile / v031.spec.ts / uk: every host picker and contextual menu selects and dismisses | passed | 7978 |
| mobile / v031.spec.ts / ru: every host picker and contextual menu selects and dismisses | passed | 7845 |
| mobile / v031.spec.ts / picker positioning at every required viewport; outside/Escape and dark sheet fallback | passed | 9822 |
| mobile / v031.spec.ts / en: real private preview, round controls, revisions, revoke and reconnect | passed | 6524 |
| mobile / v031.spec.ts / uk: real private preview, round controls, revisions, revoke and reconnect | passed | 6286 |
| mobile / v031.spec.ts / ru: real private preview, round controls, revisions, revoke and reconnect | passed | 6413 |
| desktop / v06.spec.ts / en: approved remote, private pairing, seek and host typography | passed | 8328 |
| desktop / v06.spec.ts / en: custom folder dialogs, toolbar and shared menu alignment | passed | 2204 |
| desktop / v06.spec.ts / uk: approved remote, private pairing, seek and host typography | passed | 6956 |
| desktop / v06.spec.ts / uk: custom folder dialogs, toolbar and shared menu alignment | passed | 2186 |
| desktop / v06.spec.ts / ru: approved remote, private pairing, seek and host typography | passed | 8025 |
| desktop / v06.spec.ts / ru: custom folder dialogs, toolbar and shared menu alignment | passed | 2226 |
| desktop / v06.spec.ts / empty/edited script, stale target, private control and persisted typography | passed | 2425 |
| desktop / v06.spec.ts / JSON import/export validation, centered import and folder associations survive deletion | passed | 2825 |
| mobile / v06.spec.ts / en: approved remote, private pairing, seek and host typography | passed | 10835 |
| mobile / v06.spec.ts / en: custom folder dialogs, toolbar and shared menu alignment | passed | 3035 |
| mobile / v06.spec.ts / uk: approved remote, private pairing, seek and host typography | passed | 9192 |
| mobile / v06.spec.ts / uk: custom folder dialogs, toolbar and shared menu alignment | passed | 2932 |
| mobile / v06.spec.ts / ru: approved remote, private pairing, seek and host typography | passed | 8860 |
| mobile / v06.spec.ts / ru: custom folder dialogs, toolbar and shared menu alignment | passed | 2831 |
| mobile / v06.spec.ts / empty/edited script, stale target, private control and persisted typography | passed | 2361 |
| mobile / v06.spec.ts / JSON import/export validation, centered import and folder associations survive deletion | passed | 2627 |

## Адресный Chromium / WebKit

24 PASS; skipped=0, flaky=0; 54.9 с.

| Проект / файл / тест | Результат | мс |
|---|---|---:|
| approved-chromium / approved.spec.ts / en: approved four screens, operational dock and synchronization | passed | 9376 |
| approved-chromium / approved.spec.ts / uk: approved four screens, operational dock and synchronization | passed | 9582 |
| approved-chromium / approved.spec.ts / ru: approved four screens, operational dock and synchronization | passed | 8861 |
| approved-chromium / approved.spec.ts / expired invitation clears QR/link and renewal allocates a fresh invite | passed | 1864 |
| approved-chromium / approved.spec.ts / room creation failure is reported as unreachable without a stale invitation | passed | 859 |
| approved-chromium / approved.spec.ts / a queued typography gesture is cancelled when the host switches scripts | passed | 2558 |
| approved-webkit / approved.spec.ts / en: approved four screens, operational dock and synchronization | passed | 10867 |
| approved-webkit / approved.spec.ts / uk: approved four screens, operational dock and synchronization | passed | 11021 |
| approved-webkit / approved.spec.ts / ru: approved four screens, operational dock and synchronization | passed | 10362 |
| approved-webkit / approved.spec.ts / expired invitation clears QR/link and renewal allocates a fresh invite | passed | 3138 |
| approved-webkit / approved.spec.ts / room creation failure is reported as unreachable without a stale invitation | passed | 932 |
| approved-webkit / approved.spec.ts / a queued typography gesture is cancelled when the host switches scripts | passed | 2785 |
| approved-chromium / audit.spec.ts / en: complete final wordmark survives disabled CSS animations | passed | 1166 |
| approved-chromium / audit.spec.ts / uk: complete final wordmark survives disabled CSS animations | passed | 792 |
| approved-chromium / audit.spec.ts / ru: complete final wordmark survives disabled CSS animations | passed | 1116 |
| approved-chromium / audit.spec.ts / failed save blocks folder deletion and preserves the latest draft | passed | 4439 |
| approved-chromium / audit.spec.ts / failed trash write cannot silently delete a script after Cancel | passed | 2268 |
| approved-chromium / audit.spec.ts / a queued typography frame cannot change a newly selected script playhead | passed | 3453 |
| approved-webkit / audit.spec.ts / en: complete final wordmark survives disabled CSS animations | passed | 1474 |
| approved-webkit / audit.spec.ts / uk: complete final wordmark survives disabled CSS animations | passed | 1091 |
| approved-webkit / audit.spec.ts / ru: complete final wordmark survives disabled CSS animations | passed | 1149 |
| approved-webkit / audit.spec.ts / failed save blocks folder deletion and preserves the latest draft | passed | 4889 |
| approved-webkit / audit.spec.ts / failed trash write cannot silently delete a script after Cancel | passed | 2753 |
| approved-webkit / audit.spec.ts / a queued typography frame cannot change a newly selected script playhead | passed | 4536 |

## Сравнение goldens без update

12 PASS; skipped=0, flaky=0; 56.8 с.

| Проект / файл / тест | Результат | мс |
|---|---|---:|
| desktop / v031.spec.ts / en: every host picker and contextual menu selects and dismisses | passed | 6605 |
| desktop / v031.spec.ts / uk: every host picker and contextual menu selects and dismisses | passed | 6355 |
| desktop / v031.spec.ts / ru: every host picker and contextual menu selects and dismisses | passed | 6273 |
| mobile / v031.spec.ts / en: every host picker and contextual menu selects and dismisses | passed | 8231 |
| mobile / v031.spec.ts / uk: every host picker and contextual menu selects and dismisses | passed | 7833 |
| mobile / v031.spec.ts / ru: every host picker and contextual menu selects and dismisses | passed | 7876 |
| desktop / v06.spec.ts / en: approved remote, private pairing, seek and host typography | passed | 9215 |
| desktop / v06.spec.ts / uk: approved remote, private pairing, seek and host typography | passed | 7630 |
| desktop / v06.spec.ts / ru: approved remote, private pairing, seek and host typography | passed | 7513 |
| mobile / v06.spec.ts / en: approved remote, private pairing, seek and host typography | passed | 10850 |
| mobile / v06.spec.ts / uk: approved remote, private pairing, seek and host typography | passed | 8428 |
| mobile / v06.spec.ts / ru: approved remote, private pairing, seek and host typography | passed | 8952 |

## Финальная визуальная правка и переходы

12 PASS; skipped=0, flaky=0; 51.6 с.

| Проект / файл / тест | Результат | мс |
|---|---|---:|
| desktop / approved.spec.ts / en: approved four screens, operational dock and synchronization | passed | 7938 |
| desktop / approved.spec.ts / uk: approved four screens, operational dock and synchronization | passed | 7845 |
| desktop / approved.spec.ts / ru: approved four screens, operational dock and synchronization | passed | 7833 |
| mobile / approved.spec.ts / en: approved four screens, operational dock and synchronization | passed | 9422 |
| mobile / approved.spec.ts / uk: approved four screens, operational dock and synchronization | passed | 9473 |
| mobile / approved.spec.ts / ru: approved four screens, operational dock and synchronization | passed | 9544 |
| desktop / v031.spec.ts / en: every host picker and contextual menu selects and dismisses | passed | 6547 |
| desktop / v031.spec.ts / uk: every host picker and contextual menu selects and dismisses | passed | 6244 |
| desktop / v031.spec.ts / ru: every host picker and contextual menu selects and dismisses | passed | 6198 |
| mobile / v031.spec.ts / en: every host picker and contextual menu selects and dismisses | passed | 8034 |
| mobile / v031.spec.ts / uk: every host picker and contextual menu selects and dismisses | passed | 8042 |
| mobile / v031.spec.ts / ru: every host picker and contextual menu selects and dismisses | passed | 7802 |

## Все пункты quick menu и fullscreen fallback

6 PASS; skipped=0, flaky=0; 37.7 с.

| Проект / файл / тест | Результат | мс |
|---|---|---:|
| approved-chromium / approved.spec.ts / en: approved four screens, operational dock and synchronization | passed | 9119 |
| approved-chromium / approved.spec.ts / uk: approved four screens, operational dock and synchronization | passed | 8853 |
| approved-chromium / approved.spec.ts / ru: approved four screens, operational dock and synchronization | passed | 8518 |
| approved-webkit / approved.spec.ts / en: approved four screens, operational dock and synchronization | passed | 11899 |
| approved-webkit / approved.spec.ts / uk: approved four screens, operational dock and synchronization | passed | 11164 |
| approved-webkit / approved.spec.ts / ru: approved four screens, operational dock and synchronization | passed | 10921 |

## Короткие экраны и landscape

6 PASS; skipped=0, flaky=0; 33.1 с.

| Проект / файл / тест | Результат | мс |
|---|---|---:|
| desktop / v06.spec.ts / en: approved remote, private pairing, seek and host typography | passed | 8745 |
| desktop / v06.spec.ts / uk: approved remote, private pairing, seek and host typography | passed | 6921 |
| desktop / v06.spec.ts / ru: approved remote, private pairing, seek and host typography | passed | 7629 |
| mobile / v06.spec.ts / en: approved remote, private pairing, seek and host typography | passed | 11358 |
| mobile / v06.spec.ts / uk: approved remote, private pairing, seek and host typography | passed | 9054 |
| mobile / v06.spec.ts / ru: approved remote, private pairing, seek and host typography | passed | 9168 |

## Дополнительные выполненные проверки

| Проверка | Результат |
|---|---|
| TypeScript web/relay/staging | PASS |
| ESLint | PASS |
| Vite build | PASS |
| Wrangler staging deploy --dry-run | PASS, без публикации |
| HTTPS LAN route, exact-origin preflight, foreign-origin 403 | PASS |
| HTTPS/WSS LAN room/auth/approval/command/ACK/revoke — два клиента на Mac | PASS |
| Core Image: точная ссылка текущего room из QR 260px/M/quiet-zone-4 | PASS |
| Настоящий Safari 27.0.1, quick menu / timer detail, без подключённого телефона | Визуально проверено |
| Физический iPhone / камера / Taptic / VoiceOver / Bluetooth HID | НЕ ПРОВЕРЕНО |

## Финальный порядок toolbar и обновление визуальных эталонов

12 PASS, skipped=0, flaky=0; 55.2 с.

| Проект / файл / тест | Результат | мс |
|---|---|---:|
| desktop / approved.spec.ts / en: approved four screens, operational dock and synchronization | passed | 9048 |
| desktop / approved.spec.ts / uk: approved four screens, operational dock and synchronization | passed | 8601 |
| desktop / approved.spec.ts / ru: approved four screens, operational dock and synchronization | passed | 8629 |
| mobile / approved.spec.ts / en: approved four screens, operational dock and synchronization | passed | 10209 |
| mobile / approved.spec.ts / uk: approved four screens, operational dock and synchronization | passed | 10500 |
| mobile / approved.spec.ts / ru: approved four screens, operational dock and synchronization | passed | 10256 |
| desktop / v031.spec.ts / en: every host picker and contextual menu selects and dismisses | passed | 6922 |
| desktop / v031.spec.ts / uk: every host picker and contextual menu selects and dismisses | passed | 6666 |
| desktop / v031.spec.ts / ru: every host picker and contextual menu selects and dismisses | passed | 6566 |
| mobile / v031.spec.ts / en: every host picker and contextual menu selects and dismisses | passed | 8059 |
| mobile / v031.spec.ts / uk: every host picker and contextual menu selects and dismisses | passed | 8097 |
| mobile / v031.spec.ts / ru: every host picker and contextual menu selects and dismisses | passed | 7960 |

## Финальный toolbar: обычное сравнение и Play из редактора

12 PASS, skipped=0, flaky=0; 54.4 с.

| Проект / файл / тест | Результат | мс |
|---|---|---:|
| desktop / approved.spec.ts / en: approved four screens, operational dock and synchronization | passed | 8952 |
| desktop / approved.spec.ts / uk: approved four screens, operational dock and synchronization | passed | 8632 |
| desktop / approved.spec.ts / ru: approved four screens, operational dock and synchronization | passed | 8755 |
| mobile / approved.spec.ts / en: approved four screens, operational dock and synchronization | passed | 10413 |
| mobile / approved.spec.ts / uk: approved four screens, operational dock and synchronization | passed | 10376 |
| mobile / approved.spec.ts / ru: approved four screens, operational dock and synchronization | passed | 10267 |
| desktop / v031.spec.ts / en: every host picker and contextual menu selects and dismisses | passed | 6546 |
| desktop / v031.spec.ts / uk: every host picker and contextual menu selects and dismisses | passed | 6335 |
| desktop / v031.spec.ts / ru: every host picker and contextual menu selects and dismisses | passed | 6246 |
| mobile / v031.spec.ts / en: every host picker and contextual menu selects and dismisses | passed | 8055 |
| mobile / v031.spec.ts / uk: every host picker and contextual menu selects and dismisses | passed | 7955 |
| mobile / v031.spec.ts / ru: every host picker and contextual menu selects and dismisses | passed | 7867 |

## Контрольные снимки окончательной панели

2 PASS, 24.9 с; исходный код 74768ea, эталоны не обновлялись.

| Проект / файл / тест | Результат | мс |
|---|---|---:|
| desktop / redesign.spec.ts / ru: desktop, tablet and phone layouts preserve editing and prompting | passed | 12684 |
| desktop / v031.spec.ts / picker positioning at every required viewport; outside/Escape and dark sheet fallback | passed | 8662 |
