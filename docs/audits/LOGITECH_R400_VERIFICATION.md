# Teleo 1.2.0 — Logitech R400 verification and publication

2026-10-28. Baseline `a1298fe4a493a3246708acbe5a5a902023a0e384` (verified local Design v1.2), clean working tree. Dedicated branch: `codex/logitech-r400-release`.

## Scope, evidence and authorization

Read the complete `CODEX_TASK.md`, README, QA matrix, evidence summary and full Safari v4 log from `TELEO_R400_CODEX_PACKAGE.zip`; verified every archive checksum. The archive task is byte-identical to the initially attached task. Standalone diagnostic HTML fixtures were not installed as production code. [Input manifest](evidence/r400/input-sha256.txt), [owner's original log](evidence/r400/user-safari-v4.txt).

The task package defaults to no deployment. The owner's separate chat instruction **«после этого запусти в продакшен сайт»** explicitly authorizes publication after implementation/QA, including the existing necessary staging gate. No GitHub push, force-push, DNS override, migration, credential change or new infrastructure is needed or authorized by this implementation.

Preflight: production `teleo-web` serves commit `ed6df817f6f53dae6ad266ee62374357a61239ef`, Cloudflare version `29f1cd38-6f4e-4374-8993-c3b7bfab0c20`. Preserve it as rollback. Existing Wrangler OAuth/account access verified; no credentials copied into the repository.

## Conflicts found before editing and chosen behavior

- Existing Escape unconditionally closed Reader/revoked its peer before editable/repeat checks. In the enabled R400 host preset, Escape is deliberately not handled; browser events determine fullscreen state. Standard Reader exit remains outside that preset and obeys scope/input safety.
- Existing fullscreen toggled CSS first and targeted `document.documentElement`. F5 now directly invokes the shared fullscreen entry helper on the **Reader section**, even if CSS expansion is already active. UI fullscreen entry/exit shares the same helper; unavailable entry retains CSS fallback and accurate feedback.
- Re-rendering previously rebound the main keydown listener at each frame. One stable binding now calls the latest handler and removes itself on unmount. Learning/testing, Standard/Two-button/Custom mappings remain in the same command path.
- Repeated PageDown/F5 cannot merely be ignored and left to browser defaults. The enabled, correctly scoped preset prevents their defaults but dispatches only the first press.
- Existing Play reinitialized an unfinished countdown on resume. The same central action now preserves a positive remaining countdown, while a new start still initializes the configured countdown. No separate R400 playback store or direct scroll implementation was added.
- Physical-remote help previously mentioned only Bluetooth. It now also describes USB receivers and explicitly avoids identifying the source device.

## Implementation

`r400.ts` is a small code-based mapping/scope adapter plus keyboard binding, reusing `keyboardSafe`. `reader-fullscreen.ts` tracks pending request tickets only; actual mode always comes from the document. Request is called synchronously, duplicate/stale results are guarded, and change/error listeners have lifecycle cleanup. `main.tsx` dispatches existing playback/paragraph commands, persists the existing settings, and adds the translated preset/help in the existing section. ReaderDock doesn't suppress Escape inside DOM fullscreen. No transport, storage schema, library, Welcome or approved v1.2 layout redesign.

This release also publishes the previously local v1.2 Reader/remote improvements from parent `a1298fe`; package release version is **1.2.0**. Native clients are unchanged in this R400 task. Public test harnesses never send synthetic Cloudflare IP headers; fresh isolated contexts never access the owner's stored library.

## Verification

| Check | Status | Result |
| --- | --- | --- |
| Input archive/evidence review | PASS | checksums matched; full owner log read |
| Baseline v1.2 | PASS | parent report: 115 unit, 196 regression, 15 three-engine Reader, 14 Swift; actual R400-settings before screenshots additionally captured |
| New R400/fullscreen unit tests | PASS | 25; mapping/layout, scoped/disabled/modifier guards, 35 repeats, shared engine preservation, single binding/cleanup, sync fullscreen entry, no-key exit, rejection/error/disposal |
| Full unit/integration | PASS | 140/140, 13 files; real relay/expiry tests included |
| Typecheck/lint/build | PASS | production build and Wrangler dry-run; no bindings, Origin or routes changed |
| R400 browser matrix | PASS | 24/24 in Chromium/WebKit/Firefox; real DOM fullscreen in all three, three locales, desktop/tablet/phone settings and paired remote |
| Complete browser regression | PASS | 212/212 desktop + touch/mobile; additional production-Worker matrix 32/32 across Chromium/WebKit/iPhone/iPad |
| Public staging | PENDING | existing `teleo-staging`, no infrastructure changes |
| Production + public post-deploy checks | PENDING | only after local and staging gates |
| Physical R400 against integrated app | NOT RUN | manual steps in support doc; supplied diagnostic log is separate owner evidence |
| Physical Safari/iPad/iPhone hardware certification | NOT RUN | automation is not hardware verification |

Headless real Fullscreen API entry/exit is tested separately from mocked denied/unsupported lifecycle integration. The mock case verifies no Escape event is needed and must not be reported as native browser or hardware proof. EN/UK/RU preset persistence and custom-mapping retention are checked, alongside unchanged 0.1× speed, live typography and authenticated iPhone control.

## Remaining limitations

USB origin cannot be identified from KeyboardEvent. Safari may consume Escape; R400 F5/Escape alternation can be out of phase with the browser. Hidden/background-page pausing remains intentional. Unsupported/denied API can use CSS expansion but is not claimed to be DOM fullscreen. Physical acceptance of the integrated app remains manual.

Publication identity, exact final pass counts, screenshot links and changed-file inventory will be recorded after gates complete.


## Local evidence and reproduction

[Unit/integration](evidence/r400/unit-results.txt) · [new unit cases](evidence/r400/unit-focused.txt) · [typecheck](evidence/r400/typecheck.txt) · [lint](evidence/r400/lint.txt) · [build](evidence/r400/build.txt) · [R400 browsers](evidence/r400/r400-browsers.txt) · [full regression](evidence/r400/regression.txt) · [local production](evidence/r400/production-local.txt) · [dry-run](evidence/r400/production-dry-run.txt) · [real fullscreen bounds](evidence/r400/fullscreen-geometry.txt).

```sh
npm test
npm run typecheck
npm run lint
npm run production:check
npx playwright test -c playwright.r400.config.ts
npm run test:e2e -- --workers=3
npx playwright test -c playwright.production.config.ts --workers=2
```

Actual screenshots opened/reviewed: [before desktop](../screenshots/r400-before-r400-chromium-1440x900.png), [new RU settings](../screenshots/r400-after-r400-chromium-ru-1440x900.png), [small phone](../screenshots/r400-after-r400-chromium-ru-390x844.png), [WebKit DOM fullscreen](../screenshots/r400-r400-webkit-dom-fullscreen.png), [fallback](../screenshots/r400-r400-webkit-fullscreen-fallback.png). Real fullscreen geometry verified as origin (0,0), full inner viewport dimensions and visible Play/Pause; screenshots wait for measurable settled layout. No new design palette, overlay or competing settings screen.

Known test-harness correction: locale URL hints do not override device language by design; locale cases now explicitly seed the existing manual preference. The initial EN-only harness expectation was corrected, with no change to app language semantics. Verification log trailing whitespace is normalized.
