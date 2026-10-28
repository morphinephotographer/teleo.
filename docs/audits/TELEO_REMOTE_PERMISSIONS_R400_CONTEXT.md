# Teleo — phone preview permission and context-aware R400

2026-10-28. Branch `codex/remote-permissions-r400-context`, clean baseline `2c37a9e20ec7841b50ee6e3ef4a58d73c35c6f3d`. Read the complete supplied task. Initially delivered as verified local commit `4e068b91ab5e8705c8e453a14488e2dc43b6b531`; the owner's subsequent **«опубликуй»** explicitly authorized staging and production publication, recorded below. No push, new infrastructure, storage-schema or dependency changes.

## Implementation and privacy

- One compact permission toggle immediately below the QR in the existing pairing dialog. The old reading-settings control and separate host connection sheet were removed. Reopening the shared dialog uses the current connected state, without generating a new room, revoking authorization or displaying a stale one-use QR. Confirmed pairing still dismisses it automatically; manual close preserves the session.
- Inspection found no persisted preview preference in the baseline: only a session boolean initialized to false. The existing boolean is now backed by `teleo.previewAllowed`; missing/invalid values remain false. No user script/preference migration is performed. Explicit selection before authorization is saved but cannot publish content. A paired/reconnected host reapplies the choice through the existing relay permission message, epoch and receiver.
- Session permission acknowledgment remains authoritative for the existing HostPreview sender. Initial/stale grants that no longer match the user's choice cannot enable publishing. Revocation stops the sender synchronously, then the relay revokes permission and the phone receiver clears title, body, partial chunks and preview position. Future content/position messages remain gated; the relay never persists preview text. No second permission protocol or transport was added.
- Permission affects the phone preview only. Host Reader and standalone Reader keep their own display; Play/Pause, seek, speed and navigation work while the phone text is private. EN/UK/RU strings and UI-language persistence remain independent from script text.
- The local production stress matrix exposed disconnects in two Chromium rapid-command/reconnect cases. Inspection of the retained trace showed redundant initial permission messages and identical host states around acknowledgments. The host now reconciles the saved choice only when the initial relay grant differs, and uses one state signature for state requests, periodic snapshots and acknowledgments. Matching reconnect grants no longer republish twice. Relay message limits, authentication, ACK assertions and test burst size were not weakened. Full post-fix results are retained separately from the initial failed run.

## Context-aware R400

- Running PageUp/PageDown reuse the central speed actions and existing limits/grid/persistence. One press means one step; 35 repeat keydowns do not accelerate it. The existing Reader speed output is a polite live region; no new overlay.
- Paused arrows move one actual rendered line, then half-line steps from native repeated keydowns, bounded to one step per 80 ms. There is no autonomous scroll timer; lost keyup cannot leave a scroll loop running. Orphan/stale repeats are rejected (1500 ms initial window, 500 ms between repeat signals). This depends on the OS repeat delay/rate, not a claim of identifying the USB device.
- The existing engine position and semantic anchor are updated. Speed/countdown/script do not reset; resuming and typography reflow preserve the new place. Paragraph buttons on screen/phone keep their existing behavior.
- Keyup only cancels the matching hold. Blur, pagehide, document visibility/focus, another key, modal/editable input, profile/script/playback change and unmount cancel it. One authoritative keydown binding, cleaned up with release/lifecycle listeners. Native PageUp/PageDown/F5 defaults are prevented only in permitted scope.
- Period, trusted synchronous F5, browser-native Escape and authoritative fullscreenchange behavior are retained. No native helper, Karabiner, Bluetooth requirement or discovery/status assertion.

## Verification

| Check | Result |
| --- | --- |
| Full unit/integration suite | PASS — 147/147 in 13 files, including real relay expiry/security and 32 R400/fullscreen/lifecycle cases |
| Targeted Chromium/WebKit/Firefox | PASS — 36/36; actual DOM fullscreen, context arrows, paused holds, input conflicts, independent remote and EN/UK/RU permission tests |
| Complete desktop/mobile regression | PASS — 220/220; QR decoding, Welcome/data preservation, authenticated relay, reconnect, preview privacy, exact speed and layouts |
| Reader three-engine regression | PASS — 15/15, live typography, known-character anchors, mirror/orientation, rapid remote speed and reconnect |
| Local production Worker matrix | PASS — 32/32 on Chromium, WebKit, iPhone and iPad profiles after state/permission deduplication |
| Typecheck/lint/build and production dry-run | PASS — final staged-assets build, all TypeScript projects, ESLint and Wrangler dry-run; no publication |
| Chromium production stress stability | PASS — original rapid-command/reconnect case repeated 3/3 after the fix |
| Physical Safari/R400 | NOT RUN — manual acceptance required |

The permission browser cases inspect host-sent and phone-received preview frames, not just visible text: no content before authorization, no content/position transfer after revocation and subsequent edits/control commands, and only the new revision after regrant. Reopening the dialog creates no new room; pre-pair choice, true/false reload persistence and automatic pairing dismissal are exercised. QR/toggle bounds are checked together in one layout snapshot at 1440×900, 834×1112, 390×844 and 375×667. The host's old permission location is explicitly checked absent.

The QR geometry test initially measured two elements across an intermediate viewport resize. It now measures both rectangles in one browser layout snapshot and waits for settled geometry; no assertion was removed. Actual desktop/tablet/phone images are inspected. Existing QR decoder regression remains part of the full suite.

The paused-arrow case also tracks the same paragraph's position relative to the reading guide across a font-size change, after tapping/holding, interruption and resume. A larger pixel offset alone is not the only reflow assertion.

The position-output assertion waits for the existing throttled Reader UI refresh after layout restoration; checking immediately after the CSS style commit read the preceding frame's displayed value. The actual paragraph/guide assertion remains separate and unchanged.

The final implementation was rechecked with 147/147 unit/integration, 36/36 targeted browsers, 220/220 full browser regression and the 3/3 production stress repeat. No automated failures remain. The separate 15/15 Reader cohort and 32/32 local production matrix are also retained above. These results preceded the separately authorized public publication; no remote Git push was performed.

```sh
npm test
npm run typecheck
npm run lint
npm run build:staging
npx playwright test -c playwright.r400.config.ts
npm run test:e2e -- --workers=3
npx playwright test -c playwright.reader.config.ts
npx playwright test -c playwright.production.config.ts --workers=2
npm run production:check
```

The commands above record local browser/relay verification. The last command is a dry-run, not publication. Local fixtures use isolated synthetic development clients; no public relay limits or credentials are changed. Tests use fresh contexts and disposable libraries, never the owner's browser library. Public checks are listed separately below.

Evidence: [unit/integration](evidence/context-r400/unit.txt), [focused unit cases](evidence/context-r400/unit-focused.txt), [three-engine target matrix](evidence/context-r400/browsers.txt), [complete final regression](evidence/context-r400/regression.txt), [Reader](evidence/context-r400/reader.txt), [initial production failure](evidence/context-r400/production-initial-failure.txt), [production recheck](evidence/context-r400/production-verified.txt), [repeated Chromium stress](evidence/context-r400/production-stability.txt), [build](evidence/context-r400/build.txt), [final build/typecheck/dry-run](evidence/context-r400/production-dry-run.txt), [lint](evidence/context-r400/lint.txt), [input checksum](evidence/context-r400/input-sha256.txt).

Actual running-app captures opened and inspected: [RU desktop QR](../screenshots/context-r400-chromium-ru-qr-1440x900.png), [WebKit tablet QR](../screenshots/context-r400-webkit-en-qr-834x1112.png), [UA small phone QR](../screenshots/context-r400-chromium-uk-qr-375x667.png), [paused reflow](../screenshots/context-r400-chromium-paused-reflow.png), [RU remote after revocation](../screenshots/context-r400-webkit-ru-revoked.png). These are disposable local sessions, not mockups or evidence of hardware testing. Historical release screenshots are restored after generated test runs.

## Remaining limitations

Physical R400 on actual Mac Safari/iPhone has not been tested by the agent. Automated Chromium/WebKit/Firefox fullscreen entry/exit, interruption and remote tests are not hardware certification. Use the [manual acceptance checklist](../LOGITECH_R400_SUPPORT.md). Slow OS repeat settings beyond the documented safety window require a new press. Native Safari may consume Escape; existing hidden-page pausing remains intentional.

## Authorized publication — 2026-10-28

- Deployed application source: `4e068b91ab5e8705c8e453a14488e2dc43b6b531`, unchanged after local verification; package version remains 1.2.0.
- Staging: `https://teleo-staging.your-subdomain.workers.dev`, version `94f7d72b-ade8-4a2c-8d40-647f700fc392`.
- Production: `https://teleo.cc/studio`, version `72bc431a-6fc2-4a09-8643-f3449b37778e`, confirmed at 100% traffic. Existing interactive `npm run deploy:production` used from a clean committed checkout. Previous version `d32f4a4f-5ac8-4462-bf8c-cb9915697a9c` retained for rollback; no rollback performed.
- Five build-file hashes match the staging-tested artifacts. Four served assets were also fetched and hashed on both public origins; production commit/version headers match. Existing bindings, origins, migration and domains retained; no DNS override, new infrastructure or GitHub push.
- Public staging: **45/45 PASS** — 3 EN/UK/RU permission cases (Chromium/WebKit/Firefox respectively), 15 Reader and 27 R400 cases.
- Initial production checks: 3/3 permission and 16/16 route/editor/security cases passed; Reader was 14/15 with a reproducible Firefox preview-follow failure. The original release was not declared fully verified. See the [follow-up correction and final publication record](TELEO_PREVIEW_FOLLOW_FIX.md).
- Public permission cohorts create nine rooms. An interval longer than 60 seconds separates that cohort from further room creation; Reader and R400 suites run sequentially. No synthetic Cloudflare IP headers are sent publicly, and the 10/minute/IP server limit remains unchanged.
- The follow-up documentation commit records publication only; the deployed application source remains the commit above.

## Changed files

- Runtime: `apps/web/src/main.tsx`, `r400.ts`, `ReaderDock.tsx`, `i18n.ts`, `style.css`.
- Tests: `tests/r400.test.ts`, `tests/e2e/r400.spec.ts`, `tests/e2e/remote-permissions.spec.ts`, `playwright.r400.config.ts`.
- Documentation: `README.md`, `docs/LOGITECH_R400_SUPPORT.md`, this audit, selected new `context-*.png` screenshots and test logs. Existing release evidence/screenshots are preserved.
