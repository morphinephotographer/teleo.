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

## Follow-up: bottom spacing and symmetric actions

Source `bb48882e68681aa0f9a89e91949caa20b3ad1c48`, production `be36cd8b-30da-444f-b063-46cbb01d3d6b`; previous version `1e775391-c0ca-481e-bb50-5946eb96ea19`.

- Mobile editor actions are four equal 44px circular icon targets: duplicate, TXT download, versions and trash. Accessible translated names and titles retained. JSON export is hidden on mobile; desktop actions and JSON import remain available.
- Folder selector uses the available row width. Normal mobile layout uses dynamic viewport height; focused inputs retain visual viewport behavior for the keyboard. Removed outer bottom safe-area padding, retaining it inside the editor and reader so controls stay above the home indicator.
- Reader is positioned to the bottom of its container. Settings arrow has its own centered row; line buttons have an 8px gap. Added spacing around the timer/alignment area and before the main playback row.
- Typecheck, ESLint, build, dry-run, 2 mobile layout checks and 8 document/settings/desktop-reader regression checks passed. Screenshots visually reviewed for editor and expanded dock. No physical iPhone verification.

## Follow-up: installed window sizing and Welcome alignment

Source `a22ad5167a612b87fbc2a633bd0a0bd8360ac463`, production `daa34c51-f323-4899-8274-2332db5e1405`; previous production `be36cd8b-30da-444f-b063-46cbb01d3d6b`.

- Detect home-screen standalone mode using display-mode and navigator.standalone. On small installed windows, size the root chain to its containing web view with fill-available and percentage sizing; replace fixed shell/immersive reader positioning with absolute positioning. Keep visual viewport sizing while a focused input and a substantial viewport reduction indicate an open keyboard. Do not force physical screen.height or move controls outside the drawable web view.
- Playback expansion arrow now has a transparent background in normal, hover and active states.
- Welcome setting label and switch use an explicit full-width flex row. Explanation and Open Welcome occupy separate columns in the following row, preventing the switch from floating above its label.
- Typecheck, ESLint, production build and Wrangler dry-run passed. Eight mobile tests passed (normal mobile flow plus EN/UK/RU standalone-mode simulation in Chromium and WebKit); two settings viewport regression checks passed. Simulated keyboard shrink/restore and transparent arrow states are covered. Settled screenshots inspected after disabling transitional animations.
- Tests emulate the installed-mode signal and visual viewport reduction; they do not launch an actual iPhone home-screen app. No physical iPhone validation is available. The system-owned bottom strip described in https://bugs.webkit.org/show_bug.cgi?id=313800 may remain outside the drawable page. Do not claim this release proves removal of that native strip.
