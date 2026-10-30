# Mobile layout — 2026-10-31

Published source: `d106e3b09df50102f47a9b5d53caee490ca1ddf1`.
Production Worker: `1e775391-c0ca-481e-bb50-5946eb96ea19`.
Previous Worker: `1ef287c4-aecb-403e-bf8c-6d60136926b5`.

## Result

- Modal close controls have equal 44px dimensions and circular backgrounds, no border/shadow. Initial focus goes to the dialog, avoiding the automatically focused close ring; keyboard focus remains visible when tabbing.
- iPhone editor has a fixed compact title field, flexible body field, wrapping document actions, compact spacing and reduced supporting controls at keyboard-sized heights. Root/body background, theme-color and color-scheme follow interface/reader appearance. Safe areas are retained for accessible controls.
- Send text uses the mobile viewport, prioritizes the textarea and compacts destination descriptions. Removed sheet animation that could produce a blank first frame in Safari.
- Mobile reader dock spans the screen, with speed left, play/pause center and rendered-line navigation right. Arrow reveals mirrors, typography, letter/line spacing, timer and focus controls. Dock remains usable while playing; desktop toolbar is retained.
- Letter spacing is stored as a separate local interface preference, leaving document schemas unchanged.
- Welcome can be opened/restored from settings without replacing drafts. Appearance/icon preferences no longer incorrectly count as document history and suppress first-use Welcome. Existing storage safeguards for returning/deleted/edited scripts remain.
- Added Apple home-screen web-app metadata; manifest retains standalone mode and /studio identity. No existing installation was altered.

## Checks

- Typecheck, ESLint, production build and Wrangler dry-run passed.
- 21 Welcome/follow unit tests passed, including UI preference versus document-history distinction.
- 2 focused mobile layout tests passed in Chromium and iPhone WebKit, including Welcome body, 390x844/320x568 button bounds and trial clicks, reduced viewport text area, rendered-line controls, typography and play/pause.
- 6 complete quick-send tests passed (EN/UK/RU, mobile Chromium and iPhone WebKit).
- 34 library/reader/settings regression tests passed (Chromium/WebKit), including settings with no scrolling.
- 2 production route/security/release checks passed. Live HTML, CSS, JS and service worker matched the local build and expected commit/deployment headers (4 assets).
- Screenshots inspected: editor, expanded reading controls, send sheet with circular borderless close control.
- During development some runs were interrupted by source reloads or overlapping output directories. Final runs above completed with frozen source and separate output directories. WebKit mobile viewport tests reload between device sizes to avoid stale emulated hit-test bounds after resizing; keyboard-size behavior is additionally checked without reloading.

## Platform limits

No physical iPhone verification was available. Browser emulation does not validate Safari chrome, actual keyboard accessory UI or iOS status bars. Safari browser tabs retain their address controls; launching a standalone home-screen installation removes the address bar. iOS can retain status indicators even for fullscreen manifests; these cannot honestly be promised hidden by website CSS.

References: https://webkit.org/blog/13878/ and https://bugs.webkit.org/show_bug.cgi?id=264220.

Changed implementation files: `apps/web/index.html`, `apps/web/src/ReaderDock.tsx`, `apps/web/src/main.tsx`, `apps/web/src/style.css`, `apps/web/src/ui.tsx`, `apps/web/src/welcome.ts`, `apps/web/src/i18n.ts`. Tests: `tests/welcome.test.ts`, `tests/e2e/mobile-layout.spec.ts`, `playwright.mobile-layout.config.ts`.
