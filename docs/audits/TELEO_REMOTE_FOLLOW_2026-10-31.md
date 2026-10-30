# Remote follow and received script activation — 2026-10-31

Source: `43072ba418fbd965dcaaa649d202475d8e84e147`.
Production: `1ef287c4-aecb-403e-bf8c-6d60136926b5`.
Previous production: `0e17f9ca-0a54-481d-8d04-63515c3628c2`.

## Changes

- Remote frame interpolation preserves the preceding frame clock when a host packet arrives, eliminating the lost animation time at packet boundaries.
- Playback prediction tolerates up to 750 ms after the last packet (previously 250 ms, exactly the nominal packet interval). It remains bounded during a connection stall and authoritative pause/seek samples still replace prediction.
- A successfully saved new script sent from the remote is immediately selected on the host. Outgoing edits are flushed; the new script does not autoplay. Existing session replacement still requires host confirmation. Duplicate receipts do not select the script again; failed saves do not change selection.
- Settings sheet and inline settings close controls have circular hit targets and no border or box shadow.
- Updated new-script help and receipt text in English, Ukrainian and Russian.

Changed source files: `apps/web/src/remote-text-follow.ts`, `apps/web/src/main.tsx`, `apps/web/src/style.css`, `apps/web/src/i18n.ts`.
Changed tests: `tests/remote-text-follow.test.ts`, `tests/e2e/quick-send.spec.ts`.

## Validation

- Typecheck, ESLint, production build and Wrangler dry-run passed.
- 35 unit tests passed: remote follow, remote client, quick send, preview.
- 6 mobile browser scenarios passed: Chromium and iPhone WebKit profiles, EN/UK/RU. Includes frame-by-frame scroll advancement, circular borderless close control, new script activation on host and remote, original script replacement confirmation, save failure and retry deduplication.
- 34 current library/reader regressions passed in Chromium and WebKit.
- Legacy approval-v3 continuity tests were attempted in both browsers but stop at historical screenshot equality before their gesture checks (27,405 / 105,079 changed pixels). Those tests are not counted as passing and their baselines were not rewritten.
- Physical iPhone Safari and real network conditions were not tested. Browser emulation does not establish device-specific smoothness.
- Production route/security/release checks passed in Chromium and WebKit (2 tests). Published HTML, CSS, JS and service worker matched the local build and expected release headers (4 assets).

No changes to the relay protocol, message frequency, original scripts, document schema, website icon or unrelated editor/reader controls.
