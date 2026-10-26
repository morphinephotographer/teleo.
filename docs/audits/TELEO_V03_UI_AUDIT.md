# TELEO v0.3.1 UI audit — 2026-10-26

## Inputs, baseline and scope

Read the complete pasted TELEO v0.3 request and TELEO_CODEX_V0.3.1_REVIEWED.md. The reviewed brief resolves scope/verification details. Both supplied PNG references were available in the conversation; the annotated outline guides the speed wings. Work is in the existing React/TS/Vite application, branch codex/teleo-v031-studio-remote, based on clean codex/teleo-premium-workspace at 4994744. No unrelated project or native app was rebuilt. Existing local storage format, intro, command model and bounded recovery are retained.

Baseline production build passed; existing browser regression **72/72 passed** (reported 1.3 minutes). The initial sandboxed `npm test` passed 35 focused tests but could not bind the Miniflare loopback listener, skipping 15 relay cases. This is recorded as a failed integration baseline, not a pass; later integration tests run with the required local-network permission.

## Complete menu/control inventory

All application dropdowns are now in apps/web/src/menus.tsx. No third-party picker exists. The only remaining native select is its explicit compatibility fallback.

| Instance / use | Original location / replacement | Functional evidence | Visual evidence |
| --- | --- | --- | --- |
| Current script, Studio header | main.tsx select → TeleoSelect | choose first/second document, title/body preserved | Studio and language-open screenshots |
| Language, Studio/help/privacy header | main.tsx language select → shared TeleoSelect | all three languages, saved preference, selection/Escape/focus | v031-*-{en,uk,ru}-language-open.png |
| Language, immersive reader | same language node, separate rendered instance | actual immersive popup, Escape preserves reader, select | v031-*-immersive-menu.png |
| Language, phone header | shared TeleoSelect | phone locale detection + same shared picker; explicit instance check in remote test | remote main/menu review |
| Library folder filter | main.tsx select → TeleoSelect | created folder selected/reset, filter intact | library/Studio screenshots |
| Per-script assigned folder | main.tsx select → TeleoSelect | assign/reset folder, bottom-edge positioning | Studio and contextual menu review |
| Countdown, integrated panel and narrow sheet | main.tsx select → TeleoSelect | 3 seconds/Off, keyboard arrows/Enter, nested sheet/Escape | viewport matrix and settings screenshots |
| Hardware profile, integrated panel/sheet | main.tsx select → TeleoSelect | Standard/Two-button/Custom, learning UI/HID regression | v031-*-*-mapping-open.png |
| Custom hardware action, conditional profile section | main.tsx select → TeleoSelect | long list, End/Enter, explicit action select | v031-*-*-mapping-open.png |
| Phone appearance, Settings tab | new TeleoSelect instance | select Dark, retains value, dark surface | v031-*-*-remote-menu.png |
| Application ellipsis/navigation | details/nav → TeleoMenu | open, Escape, Help selection, return Studio | shared action surface and host inventory case |
| Script actions: duplicate/export/version/delete | details/tools → TeleoMenu | each action retained in CRUD/export/version regression; Escape/focus | v031-*-*-actions-open.png |
| Settings modal sheet | existing native Sheet reused | focus containment, Escape, close/restore, popup above sheet | premium-*-settings.png + mobile mapping/menu |
| Physical remote accordion | details/summary retained, not an option picker | expanded in each locale, profile/action tests | mapping-open screenshots |
| Revision history panel | existing nonmodal bounded editor panel | open/close/restore in CRUD regression | existing revision coverage; no hidden option menu |
| Folder-name / delete confirmations | OS prompt/confirm retained | creation + CRUD confirmation | native OS dialogs are not claimed to have custom styling |
| Mode, settings tabs, alignment, reader appearance, interface theme, phone tabs | existing Segmented shared primitive | immediate settings/state/locale and phone-tab cases | Studio/remote/settings screenshots |

Speed presets remain an editable local list (not a hidden dropdown). No font-family/color/rich-format menu existed; no fake formatting controls were added. Smartphone preview permission and supported feedback are native semantic checkbox rows, not option menus. Pairing is the existing bounded reader panel with explicit host approval/revoke and a new separate preview-consent row.

## Visual and interaction review

Closed/open representatives are captured for every shared variant (select and action menu), plus unique long mapping, immersive and phone cases. All functional instances are exercised; identical instances do not require redundant golden images. Six reviewed Chromium golden images cover desktop language menus and the actual 390×844 remote composition in EN/UK/RU. The final browser run compares against those images without updating them.

Review identified/fixed: default OS-looking select surfaces; popup clipping in scrolling settings; asynchronous positioning using stale viewport dimensions; animation-midpoint screenshots (wait for full opacity and disable screenshot animations); white trigger text on the immersive reader’s light picker surface; missing action-menu fallback when Popover API is unavailable; long RU Playback tab copy (compact translated tab label); old generic remote button grid; accidental editing of a previous document while New script awaited a save; acknowledgement-delayed consent checkbox state; and cleanup of preview memory/outgoing chunks on explicit session termination/navigation. Separate Edit mode pauses but keeps the approved remote, enabling real live edits/script switches; explicit Exit still revokes. Deleting the final script ends the remote instead of leaving stale text/control.

Reviewed before/after artifacts: v031-before-studio.png and v031-before-remote.png preserve the preceding commit; after images use v031-* names. These compare design/behavior, not identical viewport pixel diffs. Generated QA content only; owner photos/private scripts are not copied.

## Protocol/security evidence

The relay extends the existing authenticated connection with opt-in preview v1. Command frames remain bounded/allowlisted. Host-only approval, default-off, consent epochs, sequence/revision checks, stale-data clearing, bounded chunks, peer reconnect and fresh snapshots are covered. Real test SQLite inspection confirms no private title/body markers are persisted. Production uses WSS; the relay sees approved plaintext during forwarding, so this is not end-to-end encryption. Privacy/help strings were updated in all locales. See TELEO_REMOTE_V03.md for exact limits/schema.

## Browser, viewport and known limits

Chromium desktop and iPhone emulation cover 1440×900, 1280×800, 1024×768, 834×1112, 390×844, 375×667 and 844×390, plus retained smaller compact sizes. WebKit/Firefox are not installed in the test runner. API-absence emulation verifies the native select and dialog-menu compatibility fallback in Chromium; actual OS picker appearance, VoiceOver and physical Safari keyboard/chrome/rotation remain manual checks. Emulation does not prove physical iPhone behavior, Bluetooth hardware, Taptic Engine or a frame-rate guarantee. Unsupported iPhone vibration is described honestly; the preference is only shown when a standard API exists.

The shell is fixed; editor/library/settings/Text scroll internally. Short phone views may scroll the primary remote panel to retain useful touch sizes. Text snapshots have explicit resource limits and an honest unavailable state. Native iCloud/Apple signing gates remain separate from this web change.

## Results

Local gates: `npm run typecheck`, `npm run lint`, staging production build and Worker dry-run passed. Full Vitest **64/64 passed**, six files, **153.22 seconds** (including 19 relay integration tests). Final full browser regression **86/86 passed**, **1.9 minutes**, including API-absence native-select/dialog fallback. Six visual golden images were verified without updating them. Baseline/intermediate failures are not accepted as passes.

Final visual review includes desktop Studio, tablet library drawer/editor, all EN/UK/RU language, mapping and action surfaces, dark settings, immersive language contrast, phone Remote/Text/Settings/appearance, and fallback action sheet. Review found screenshot capture preceding segmented transitions; focused evidence now waits until the selected capsule aligns with the actual active button. Historical screenshot files from preceding releases are preserved; new evidence uses v031-* paths. Staging source/revision and public results follow after publication.

Focused final visual verification: **14/14 passed** in **49.1 seconds**, including capsule-to-active-tab alignment before phone Text/Settings screenshots, corrected immersive trigger contrast and API-absence fallbacks. Application code did not change after the final 86-case run.

### Public verification follow-up — 2026-10-27

Published application source **19a2428**, Worker **cfbad529-2d5f-4c47-857b-a5b9a058a312**, to the existing authorized staging only. The first public UI run passed 29/32; three seek/highlight assertions raced with an in-flight earlier phone paragraph command. The test had clicked successive controls without waiting for that command's matching ACK, allowing real WSS latency to apply it after a host seek. The harness now observes routed client/server messages directly, forwards every frame unchanged, and waits for each command ID's ACK before the next action. Native page WebSocket frame events do not observe Playwright-routed sockets; the prior passive capture was insufficient, so a positive default-denied permission-frame assertion was added. Live UI/text assertions already used the real transport. No application/relay change or relaxed assertion is involved. Initial public failures remain recorded; final rerun results follow. Separate public asset/Origin/header checks passed **2/2** in **2.7 seconds**.

Final public rerun against the same application source/Worker: **32/32 passed**, **58.6 seconds**, including real ACKs, default-denied preview frames, live content/revisions/switches, seek/highlight, revoke/resume, visual golden comparisons, menus/fallbacks, intro and viewport regressions. Combined with the separate public security suite: **34/34 passed**. Final typecheck/lint passed after harness changes. Additional normal tablet editor screenshot v031-834-editor.png was captured and visually reviewed alongside the library drawer. No further application change or redeployment was needed.

Final release branch: `codex/teleo-v031-studio-remote`. Protocol commit `07271df`, verified deployed UI source `19a2428`; the follow-up evidence commit contains only tests, docs and generated QA screenshots. Native Apple signing/physical-device gates remain open and are not blockers for this web staging release. No production route, DNS, plan or main-branch changes.
