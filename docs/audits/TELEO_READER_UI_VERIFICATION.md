# Teleo v1.2 — Reader UI and exact speed verification

Local implementation, 2026-10-28. **Not a release or deployment authorization.**

Historical local feature record. This work was subsequently included in the separately authorized Teleo 1.2.0 publication; see the [R400 verification and production release record](LOGITECH_R400_VERIFICATION.md) for current public validation and source identity. The baseline/publication statements below describe the time of this original audit.

## Baseline and scope

- Baseline: `fd1c52b923ba413a8dc3a89314ff74cf6c0dd717`, branch `codex/teleo-native-web-v1`; working tree clean before this task.
- Work branch: `codex/reader-ui-speed-v12`. No push, remote tag, Cloudflare mutation or deployment performed.
- Production remains the previously released v1.0.2. This report describes local v1.2 feature work, not production verification.
- Read the complete supplied `TELEO_Codex.zip` package: README, implementation/start task, all five contract/review/QA documents. Inspected all eight reference PNGs. SHA-256 manifest retained in [evidence](evidence/v12/package-manifest.txt).
- Preserve existing Studio, inert lowercase wordmark, circular EN/UA/RU selector, library, Welcome, editor, persistence, QR authorization and consented preview. No storage schema migration or rewriting existing scripts.

## Reference reconciliation

| Reference | Applied to |
| --- | --- |
| 01_APPROVED_REMOTE_LATEST_FOUR_STATES | Paired remote connected / inline typography / current-text / reconnect states. Round speed and play; rounded rectangular paragraph controls; actual consented script title. |
| 02_APPROVED_REMOTE_PRIOR_TWO_STATES | Supplementary base composition only. Quick typography reserves space, keeps Play/Pause visible. |
| 03_CONCEPT_READING_MODES_CROSS_DEVICE | Reader desktop/tablet dock and minimal/expanded standalone phone controls. |
| 04_CONCEPT_LIVE_RESIZE_ALL_DEVICES | Live reserved typography area. Existing pixel units and ranges retained, no illustrative percentages or blue glow. |
| 05_CONCEPT_CROSS_DEVICE_FLOWS / 06_CONCEPT_EDITOR_READER_REMOTE | Distinct Studio, standalone Reader and paired Remote. Preserve approved editor. |
| 07_CONCEPT_QR_AND_LANGUAGE | Regression review only; real invitation/QR/security and shared locale component preserved. |
| 08_BASELINE_2026_10_27 | Historical baseline only; actual current before images captured locally. |

Generated captions/rings and invented connection data were not implemented. Reconnect after revocation opens the real existing connection instructions; it cannot restore a revoked capability without a new host invitation. Brief network loss still uses existing automatic authenticated recovery.

## Implemented states

- Desktop and tablet: compact bottom dock, Play/Pause, speed ±, paragraph navigation, `Aa`, direct mirror H/V, countdown/tools, timeline. `Aa` opens an inline region above the main controls. Size, spacing and width tabs share the same existing preference values and three visible alignment buttons.
- Standalone phone: viewport-filled Reader, minimal dock with Play/Pause + actual speed + expand. Expanded playback controls, typography and secondary tools reserve layout space; no backdrop or modal over the reading guide. Secondary content can scroll on short landscape screens. Pause remains directly operable after inactivity.
- Paired phone: verified connection indicator, opt-in real text/title, timeline, host-confirmed speed, primary playback and paragraph controls. Inline quick typography replaces paragraph-control space while retaining primary playback. Current-text mode is separate from standalone Reader. Disconnect closes quick/current-text state and exposes real reconnect instructions.
- Existing single advanced settings gear, locale selector, keyboard focus, reduced-motion behavior and accessibility labels retained. Newly exposed actions localized in EN/UK/RU.

## Speed contract

- Observed pre-change bounds **0.5–3.0×**, previous speed action step **0.25×**. Bounds preserved.
- `packages/protocol/speed.ts` centralizes exact integer-tenth stepping and truthful formatting. All web speed-up/down actions, keyboard/HID actions dispatching those commands, and paired relative actions use it. Native Swift mirrors this contract.
- Canonical display: `0.9×`, `1.0×`, `1.1×`, `1.2×`. Existing valid off-grid values remain exact until an explicit action: `.75 + → .8`, `.85 − → .8`. Presets/imports such as `1.25×` remain useful and unchanged. A preset-cycle HID action is not a speed-step action.
- Rate-only commands return without resetting playhead, playing state, countdown or the animation clock. Bounds disable buttons and suppress redundant queued bound actions.
- Remote sends authenticated relative commands with distinct IDs: FIFO, one in flight, at least 80 ms between sends, at most 50 unsent actions. ACK/state sequence validation prevents stale UI regression; delayed stale ACK still completes its queue entry. Relay's existing duplicate-ID handling remains authoritative. No optimistic speed is shown.
- Disconnect/timeout clears uncertain queued gestures; none are replayed after reconnect. Switching confirmed script target cancels unsent speed gestures. An already-sent untargeted relative command retains the existing protocol's current-host-target semantics.
- Remote typography retains 200 ms coalescing, flush on release/blur, cancel of pending draft on pointer cancellation/target change/disconnect. Host validates and returns actual shared state.

## Semantic reflow

`reading-anchor.ts` captures paragraph index + UTF-16 character offset (never splitting a surrogate pair), and that character's vertical displacement from the reading guide. It binary-searches paragraph and character geometry instead of measuring every character/paragraph per frame. The current plain paragraph rendering contract gives stable indices until edits; removed content clamps to the nearest remaining paragraph/character.

Before typography/dock changes, hold the semantic anchor through a drag; restore it after DOM layout and ResizeObserver changes, keeping playback movement in the calculation. A 400 ms quiet interval allows normal tracking to resume. Pause/manual scroll and explicit seek/paragraph commands retain their separate semantics. Empty content has zero duration and a disabled timeline.

Mirror V uses logical forward progress independently of physical inverted scroll coordinates, including playback, seek and paragraph controls. WebKit/Firefox require measurement after the transform has actually painted (two animation frames); tests caught and fixed the stale transformed range measurement. A second issue caught by tests was automatic browser scroll clamping during a dramatic font shrink; paused layout correction no longer treats that as user progress. Layout panels reserve real space, and control hitboxes never mirror.

## Verification

Browser emulation is not a physical-device claim. The baseline passed before implementation; discovered implementation and harness issues were fixed and rerun.

| Check | Status | Evidence |
| --- | --- | --- |
| Baseline typecheck/lint/build | PASS | [baseline build](evidence/v12/baseline-build.log) |
| Baseline unit/integration | PASS | [106 tests](evidence/v12/baseline-unit.log) |
| Baseline browser regression | PASS | [186 tests](evidence/v12/baseline-e2e.log) |
| Baseline native tests | PASS | [13 tests](evidence/v12/baseline-swift.log) |
| Current unit/integration | PASS | [115 tests, 12 files](evidence/v12/unit.log); real TTL/relay transport, queue/ordering/target cancellation and exact speed |
| Current Swift tests | PASS | [14 tests](evidence/v12/swift.log) (11 core + 3 transport) |
| macOS unsigned Debug build | PASS | [Xcode log](evidence/v12/macos-build.log) |
| iOS Simulator unsigned build | PASS | [Xcode log](evidence/v12/ios-build.log); no Developer Team required |
| Typecheck, lint, normal and same-origin staging builds | PASS | [typecheck](evidence/v12/typecheck.log), [lint](evidence/v12/lint.log), [build](evidence/v12/build.log), [staging build](evidence/v12/staging-build.log) |
| Three-engine Reader/remote suite | PASS | 15/15; Chromium, WebKit, Firefox, [log](evidence/v12/reader-browsers.log) |
| Final full browser regression | PASS | [196/196](evidence/v12/regression.log), desktop + touch/mobile projects; built same-origin staging fixture and offline assets included |
| Physical Safari/iPhone/HID/CloudKit | NOT RUN | browser engines and native compilation do not substitute for devices |
| Staging / production deployment | NOT RUN | local-only scope; no deployment performed |

Before/after images in `docs/screenshots/v12-*`. Final evidence links and limits follow after verification.

Regression investigation also caught mobile resize callback ordering: the breakpoint listener used to recapture already reflowed content. It now leaves the old anchor intact; a geometry signature restores it before the next animation tick/ResizeObserver pass. A manually changed scroll offset invalidates a held paused anchor, so a rapid scroll followed by alignment does not jump back. Pointer/wheel/touch and explicit navigation preserve their own control paths.

## Limits and interpretation

- Semantic anchors are maintained in the current Reader session; persistence still uses the existing preference and per-script position storage. This is not a new cloud-sync or persistent document-position format.
- Removing a paragraph or drastically shrinking content can make the old character physically unreachable. The nearest remaining content and actual scroll bounds win; no impossible pixel-perfect guarantee is claimed.
- Already-sent unscoped speed commands use the existing selected-host-script semantics. Unsent queued steps are cancelled when a changed script target is confirmed; no new wire-protocol capability was invented.
- Native clients received matching speed, multiplier labels and always-reachable Pause; this task did not replace their native settings UI with the browser dock. Full native localization and physical CloudKit/HID verification remain existing release gates in README/QA.
- The Vite development log's `Unknown Error: [object Event]` is also present in the baseline during the deliberately injected QR image-error fixture. Do not mistake that expected fault-injection diagnostic for a newly passing production guarantee. New Reader scenarios explicitly assert no page JS errors; normal builds succeed.

Visual review found that opening quick typography could leave the active remote paragraph outside its smaller viewport. Preview following now reacts to panel/typography changes. Delayed-ACK stress in WebKit also exposed a broadcast cache bug: periodic state last sent `1.1`, a later ACK confirmed `1.0`, then a local host action returned to `1.1`. The old state-only cache incorrectly suppressed that final publication. ACK and periodic state now share the last-published signature, so local reversals are broadcast without adding traffic or changing relay limits.


## Final visual review

Actual application captures, not generated UI mockups. Captured seven final viewports: **1440×900, 1280×800, 1024×768, 834×1112, 390×844, 375×667, 844×390**. Before captures cover six sizes and both real reader/paired-remote modes. Selected 53 original PNGs plus three overview contact sheets are retained; routine historical test screenshots were restored rather than replaced. The two approved remote snapshot baselines were deliberately updated for the new approved title/paragraph-button composition after viewing the actual differences.

- [Standalone Reader matrix](../screenshots/v12-overview-reader-matrix.png): desktop, both tablet orientations, phone sizes, landscape, minimal dock and maximum font. Opened and reviewed.
- [Paired remote four states](../screenshots/v12-overview-remote-states.png): actual connected, inline typography, current-text and revoked/reconnect states. Opened and reviewed; final quick view shows the active paragraph.
- [Before / minimal / typography phone comparison](../screenshots/v12-overview-phone-comparison.png). Opened and reviewed.
- [Desktop typography minimum](../screenshots/v12-after-reader-chromium-font-16.png), [default](../screenshots/v12-after-reader-chromium-font-default.png), [maximum](../screenshots/v12-after-reader-chromium-font-100.png).
- [WebKit small phone](../screenshots/v12-after-reader-webkit-reader-375x667.png), [Firefox phone](../screenshots/v12-after-reader-firefox-reader-390x844.png), [touch/mobile semantic anchor](../screenshots/v12-after-mobile-semantic-anchor.png).

No observed horizontal page overflow, hidden Pause, modal backdrop over live typography, or clipped primary controls in the reviewed layouts. Focus rings remain neutral. At extreme font/viewport combinations secondary content scrolls inside its control region; existing allowed font ranges are retained.

## Reproduce

Environment: Node **24.22.1**, Playwright **1.64.1**, Apple Swift **6.4**, Xcode **27.1 (27A9275)** on Apple Silicon macOS. Headless Chromium/WebKit/Firefox and Chromium touch/iPhone emulation; no physical-iPhone or native Safari-window result is claimed.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run build:staging
npx playwright test -c playwright.reader.config.ts
npm run test:e2e -- --workers=3
swift test --package-path apps/apple --scratch-path /private/tmp/teleo-v12-swift
```

Browser suites start local dev, relay, built preview and same-origin staging servers. Run suites sequentially: simultaneous runners sharing `reuseExistingServer` can lose servers when the owning runner exits. The local integration fixture's synthetic CF header is never used against hosted staging/production. Native build commands remain documented in README; exact build outputs accompany this report.

**Final outcome:** local implementation verified and committed on `codex/reader-ui-speed-v12`; no remote push/deploy. Local commit hash is supplied in the final handoff (`git log -1`), avoiding a self-referential hash inside the committed document.

## Changed files

- [README.md](../../README.md)
- [apps/apple/Shared/Reader.swift](../../apps/apple/Shared/Reader.swift)
- [apps/apple/Shared/TeleoApp.swift](../../apps/apple/Shared/TeleoApp.swift)
- [apps/apple/Sources/TeleoCore/Domain.swift](../../apps/apple/Sources/TeleoCore/Domain.swift)
- [apps/apple/Tests/TeleoCoreTests/CoreTests.swift](../../apps/apple/Tests/TeleoCoreTests/CoreTests.swift)
- [apps/apple/Tests/TeleoRemoteTests/TransportTests.swift](../../apps/apple/Tests/TeleoRemoteTests/TransportTests.swift)
- [apps/web/src/ReaderDock.tsx](../../apps/web/src/ReaderDock.tsx)
- [apps/web/src/RemoteController.tsx](../../apps/web/src/RemoteController.tsx)
- [apps/web/src/i18n.ts](../../apps/web/src/i18n.ts)
- [apps/web/src/main.tsx](../../apps/web/src/main.tsx)
- [apps/web/src/reading-anchor.ts](../../apps/web/src/reading-anchor.ts)
- [apps/web/src/remote.ts](../../apps/web/src/remote.ts)
- [apps/web/src/style.css](../../apps/web/src/style.css)
- [packages/protocol/domain.ts](../../packages/protocol/domain.ts)
- [packages/protocol/speed.ts](../../packages/protocol/speed.ts)
- [playwright.reader.config.ts](../../playwright.reader.config.ts)
- [tests/e2e/approved.spec.ts](../../tests/e2e/approved.spec.ts)
- [tests/e2e/audit.spec.ts](../../tests/e2e/audit.spec.ts)
- [tests/e2e/full-audit.spec.ts](../../tests/e2e/full-audit.spec.ts)
- [tests/e2e/helpers.ts](../../tests/e2e/helpers.ts)
- [tests/e2e/product.spec.ts](../../tests/e2e/product.spec.ts)
- [tests/e2e/reader-v12.spec.ts](../../tests/e2e/reader-v12.spec.ts)
- [tests/e2e/reconnect.spec.ts](../../tests/e2e/reconnect.spec.ts)
- [tests/e2e/redesign.spec.ts](../../tests/e2e/redesign.spec.ts)
- [tests/e2e/staging.spec.ts](../../tests/e2e/staging.spec.ts)
- [tests/e2e/v031.spec.ts](../../tests/e2e/v031.spec.ts)
- [tests/e2e/v06.spec.ts](../../tests/e2e/v06.spec.ts)
- [tests/e2e/v06.spec.ts-snapshots/approved-remote-closed-desktop-darwin.png](../../tests/e2e/v06.spec.ts-snapshots/approved-remote-closed-desktop-darwin.png)
- [tests/e2e/v06.spec.ts-snapshots/approved-remote-closed-mobile-darwin.png](../../tests/e2e/v06.spec.ts-snapshots/approved-remote-closed-mobile-darwin.png)
- [tests/e2e/v061.spec.ts](../../tests/e2e/v061.spec.ts)
- [tests/e2e/welcome.spec.ts](../../tests/e2e/welcome.spec.ts)
- [tests/remote-client.test.ts](../../tests/remote-client.test.ts)
- [tests/speed-v12.test.ts](../../tests/speed-v12.test.ts)
- [tsconfig.json](../../tsconfig.json)

Also: this report, `docs/audits/evidence/v12/` verification logs/manifest, and 56 selected `docs/screenshots/v12-*.png` originals/overview sheets. Historical screenshots outside this prefix were restored.

Verification log content is retained with trailing whitespace normalized; test output and results are unchanged.
