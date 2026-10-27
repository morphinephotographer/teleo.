# TELEO full code audit — 2026-10-27

Baseline: 1327b306 (Welcome), production 186c4e7d / v1.0.1. Dedicated branch codex/full-code-audit. Initial working tree clean; baseline screenshots are generated outputs, not user edits. User explicitly authorized production publication with this task.

Baseline: typecheck, lint, build PASS; Vitest 96/96; Playwright 174/174; Swift XCTest 10/10; npm audit zero vulnerabilities.

## Findings recorded before corrections — final status updated after verification

| ID | Severity | Location | Problem / reproduction / impact | Root cause / correction | Status |
|---|---|---|---|---|---|
| A01 | High | apps/web/src/storage.ts save; main.tsx recovery | Two tabs edit one script; stale save overwrites newer content or a tombstone. Startup recovery can do the same. | No optimistic concurrency check. Compare loaded baseline in the same transaction; preserve conflicting recovery as an idempotent separate copy. | FIXED |
| A02 | High | services/remote-relay/worker.ts command; TeleoCore/Domain.swift SessionGate | More than 1000 legitimate commands terminate/reject a session. | Fixed lifetime replay set cap. Persist relay IDs separately; native cap sized to existing rate/TTL, preserve replay protection. | FIXED |
| A03 | Medium | protocol/domain.ts Playback.tick; TeleoCore/Domain.swift | Pause at end, shrink content/viewport: position exceeds maximum. | Clamp only runs during playback/commands. Clamp every tick. | FIXED |
| A04 | Medium | main.tsx and RemoteController.tsx fullscreen exit | A rejected exitFullscreen promise is unhandled. | Missing catch on exit path. Handle exit failures without blocking editor/remote. | FIXED |
| A05 | Medium | host-preview.ts script compilation | Digest rejection is unhandled and phone may retain stale preview. | Async timer lacks error path. Revoke preview permission and notify host, with generation guard. | FIXED |
| A06 | Medium | main.tsx popstate | Browser Back can retain blocking settings/dialog overlays. | Route change omits transient-state cleanup. Dismiss overlays on both navigation paths. | FIXED |
| A07 | High | apple/Shared/NativeRemote.swift attach/receive | Callbacks from cancelled connection can revoke/stop a replacement session. | No connection identity guard on delayed MainActor tasks. Ignore obsolete callbacks. | FIXED |
| A08 | Low | README.md; public/_headers | Contradictory old production status and obsolete static CSP relay origin. | Historical rollout text not marked historical. Align with active release/same-origin policy. | FIXED |

Final verification: 106/106 unit/integration tests, 186/186 default browser cases, 18/18 new audit cases across three engines, 33/33 QR/locale cross-browser cases and 18/18 dedicated Welcome cases. Native: 13/13 XCTest and both application builds. See the verification report for commands, intermediate failures, screenshots and publication evidence.


## Detailed verification and disposition

A01 — High. A second tab uses a snapshot loaded before another tab edits or deletes the record. Timestamp ordering is insufficient: queued/recovery writes can be newer in time while based on older content. The write transaction now compares the complete observed record and rejects a mismatch before any put/revision write. DraftWriter retains the dirty draft and local recovery and shows a localized conflict message. Recovery validates each entry independently and writes an idempotent, separately identified copy when the stored original differs, including tombstones. Repeated reloads do not create further copies; original deletion remains intact. Manual Welcome restoration refreshes the selected record and guards edits during its async operation. Unit tests reproduce both stale edit and deleted-record overwrite on baseline, then verify preservation; actual two-page browser tests preserve both bodies across reload. No personal data was used.

A02 — High. At 1001 commands the relay threw and the native gate stopped accepting requests, so a legitimate reading session could expire prematurely. Individual durable replay keys retain protection for the entire existing 1-hour session; legacy room.seen remains readable for deployed rooms. No replay eviction or weakened rate/auth checks. Native replay capacity is 72,000, bounded by the existing 20 messages/sec and 3600-second session. Tests send 1005 real commands and verify every ACK plus first-ID replay rejection. The full suite caught a late-ACK handling regression in the first correction; the freshness guard was restored and the original hibernation/resume test and full 104-test suite then passed. Existing pending IDs remain the authoritative ACK freshness check.

A03 — Medium. Paused tick returned 850 even after maximum shrank to 100; browser scrollTop clamped while the engine state remained stale. Both engines now clamp each tick, retaining the existing dt cap, countdown, suspension and position behavior. Red→green TS/Swift tests cover paused shrink and empty layout; actual playback/typography/seek/browser resize remain covered by existing suites and the new matrix.

A04 — Medium. Three host paths and the remote exit path assumed exitFullscreen always resolves. Fault-injection tests reject that browser promise and assert no pageerror and working editor/remote. Exit state proceeds safely; the existing viewport fallback and enter-fullscreen behavior remain intact. Browser native fullscreen is permission dependent; denial is handled rather than forced.

A05 — Medium. HostPreview compiled inside an async timer without a catch. A digest failure could emit an unhandled rejection and leave the remote reading an old body. Current-generation failures now stop publishing, revoke through the existing host permission protocol (which clears the phone), and notify the host. Local script save continues. Obsolete generations cannot revoke a newer preview. Unit fault injection passes; real paired browser fault verification is included in the expanded audit suite.

A06 — Medium. popstate stopped playback/transport but retained settings/connection/action/history/immersive overlays. Shared route dismissal now removes these transient states, leaving drafts and persistent settings intact. App unmount also clears control/invite timers and transport callbacks. Browser test opens a destructive confirmation, navigates Back, asserts Help visible and no open modal; it does not delete the script.

A07 — High. Network callbacks enqueue MainActor work that may arrive after stop→host/connect. They mutated a new session because identity was not checked. Listener/connection/discovery callbacks now verify their originating session or object. New connections reset ACK/rate state. Reader's command callback no longer retains the containing view/remote; it captures only the reader model weakly and clears on disappearance. A real TLS loopback test fails with the original implementation (new invitation erased, next pair times out), passes with correction, and repeats replacement 3 times. Wrong PSK/approval/ACK/revoke tests remain passing.

A08 — Low. README had contradictory unmarked historical production status and static fallback headers allowed a no-longer-used API origin. Historical releases are labeled, current same-origin workflow and audit linked; fallback CSP now matches the active same-origin worker. Existing production security tests verify actual headers. No DNS/config route/secret changes.

### Deferred findings (not release blockers for the browser application)

| ID | Severity | Location | Evidence / impact / root cause | Correction / status / verification |
|---|---|---|---|---|
| A09 | Medium | apps/apple/Shared/TeleoApp.swift, Reader.swift, NativeRemote.swift | Native SwiftUI views/status messages contain English literals and have no EN/UK/RU catalog. Browser dictionaries are complete and typed; this limitation is specific to the native client. | **OPEN**. Requires a coordinated native localization/catalog and device UI review; changing all native copy during the browser reliability release risks the signed/device flows. Static review confirmed; no claim of native three-language completeness. |
| A10 | Low | apps/web/src/style.css; unused RemoteIllustration.tsx | Historical CSS layers redefine pairing/remote styles; the unused illustration and its rules remain. Current winning styles produce approved layouts. | **OPEN**. Separate visual-baseline-backed CSS consolidation recommended. Removing large old rule groups now is unnecessary for defect fixes; actual screenshot/functional checks protect current behavior. |

## Source coverage ledger

Reviewed active app and transport source, not just changed files:

- Web application: main.tsx (routing/editor/reader/pairing/settings/import/export), RemoteController.tsx, storage.ts, drafts.ts, welcome.ts, host-preview.ts, remote.ts, pairing-origin.ts, qr.ts, feedback.ts, Intro.tsx, useLocale.ts, i18n.ts, LanguageControl.tsx, Wordmark.tsx, AlignmentControl.tsx, ActionDialog.tsx, menus.tsx, ui.tsx, all style.css sections, index.html and public/_headers. RemoteIllustration.tsx is unreferenced legacy code.
- Shared contracts: packages/protocol/domain.ts, control.ts, preview.ts; contracts/script-v1.json and fixtures/tests checked for interoperability.
- Services: remote-relay/worker.ts, web-worker.ts, staging/worker.ts, production/worker.ts; root and per-service Wrangler/TS configs. Checked hashing, one-use/resume capabilities, strict Origin/host allowlists, TTL/revocation, ACK/sequence/pending/replay handling, message/frame/rate bounds, preview consent and non-persistence, alarms/hibernation/restart and public asset security.
- Apple: Sources/TeleoCore/Domain.swift and Storage.swift; Shared/NativeRemote.swift, Reader.swift, TeleoApp.swift, TeleoUITests.swift, Info.plist and both entitlements; Package.swift, Xcode project/schemes and core/transport test targets. No Team/container/provisioning fabricated.
- Build/ops: vite.config.ts (including generated offline service worker), all scripts/*.mjs, generate-xcode.py, package/lock, ESLint/Vitest/Playwright/TS configs, README and current deployment/release docs. Builds use pinned installed dependencies/lockfile; no unnecessary dependency added.
- Regression suite coverage includes playback/countdown/timing/suspension, seek/paragraphs/typography/alignment/mirroring, all translated routes/menus/settings, TXT/JSON/CRUD/folders/revisions, storage denial/recovery, Welcome, real WebSocket/DO restart/reconnect/revoke/expiry, and branded QR decoding. Test assertions validate persisted state/ACKs, not rendering alone.

## Security and performance assessment

No confirmed critical vulnerability or exposed secret found. Dependency audit: zero vulnerabilities. Existing protections retained: crypto-generated capabilities; hashed room tokens; TLS/WSS; exact Origin and production host; bounded JSON commands; role/approval/target validation; no unsolicited text preview; CSP/no-referrer/no analytics. Script bodies render as React text, with no dangerous HTML insertion. Public tests use actual browser TLS/DNS; no fake public client IP, insecure TLS, system network change or room quota bypass.

Baseline JS 370.54 kB / 115.21 kB gzip and CSS 52.16 kB / 10.77 kB gzip. Candidate remains a single modest application bundle; final sizes are recorded in verification. RAF is reader-scoped with cancellation, capped 50ms delta, UI refresh at 100ms and position persistence at 250ms; suspended tabs stop playback. Remote sliders already throttle at 200ms and transport has bounded pending commands. The relay fix avoids rewriting an ever-growing IDs array on each command; no new text storage or dependency added. No benchmark of physical iPhone thermal/memory usage or hour-long hardware session is claimed.

## Device and operational limitations

Physical iPhone Safari, VoiceOver, browser chrome/keyboard safe areas, Bluetooth HID, actual native Bonjour two-device LAN and CloudKit were not available for new-release certification. WebKit automation and real TLS loopback are specifically labeled. The owner previously tested older public pairing successfully, which does not certify this release. Old already-open browser tabs continue their cached JavaScript until reload; the client conflict guard applies once the new version is loaded. No server can retrofit local IndexedDB writes in an already-running old client. Existing revision history/recovery is preserved; important old drafts should be exported before closing tabs.


## Regressions caught during implementation

R01 (resolved): initial replay-key change classified a known but stale ACK as invalid instead of ignoring it. The existing hibernation/reconnect test failed (103/104 overall). The final implementation first recognizes the durable/legacy ID, then ignores ACKs absent from pending. Original strict assertions were retained; targeted and full runtime suites pass.

R02 (resolved; final browser stress run recorded separately): using portable JSON import validation directly for local recovery rejected existing TXT drafts longer than 2,000,000 characters, even though TXT input supports larger files. A new red unit test exposed this. Local recovery must validate metadata/preferences with a placeholder body, then preserve the original bounded local text; it must not impose a new import cap on existing local content. This is an implementation regression, not an additional pre-existing finding. The new 2,000,001-character unit case passes; browser tests assert complete text and IndexedDB persistence across two reloads.

The portable JSON v1 importer retains its existing 2,000,000-character per-script and 10MB bundle limits. Very large scripts can still be backed up as TXT; the audit does not silently truncate them or change saved user data to fit a portable format.


R03 (resolved; included in final regression run): the first optimistic guard compared arbitrary preference extension objects by reference. IndexedDB structured cloning made an unchanged imported extension look like a concurrent edit. The new test fails before correction; comparing the serialized preserved preference payload avoids false conflicts without stripping extension data. Plain known fields, script contents and timestamps remain checked in the same transaction.

Audit totals concern A01–A11; implementation regressions R01–R03 are tracked separately and are not counted as extra pre-existing defects.


### A11 — Medium — extreme single-word layout performance — OPEN

Location: apps/web/src/main.tsx textarea (around line 1700), apps/web/src/style.css editor text layout. Reproduction: recover a local TXT draft containing a single 2,000,001-character word and reload twice. The complete body persists, but this browser layout stress test took 28.4s in Chromium, 18.6s in WebKit and 1.4s in Firefox in the three-engine run; a mobile Chromium run took 52.2s. These are total automated case durations, not isolated rendering benchmarks. An overlapping no-trace probe also exceeded the normal 5-second initial-editor assertion. A separate managed-server no-trace result is recorded in verification.

Impact: extreme unbroken multi-megabyte content can make startup/reload slow; ordinary paragraph-based scripts and the approved UI remain covered by the normal timeouts. Root cause is the cost of laying out a huge controlled textarea/string, compounded by instrumentation; further profiling is needed before attributing all elapsed time to the application. Proposed correction: profile and bound/virtualize the very-large-document editor in a separate change with visual and data-loss tests. **OPEN**: no silent truncation, stricter limit on existing user text, or risky editor replacement introduced in this reliability release. The stress test uses an explicit 90-second case / 30-second initial-editor budget and still asserts every character and exactly one persisted record after reload.

## Final assessment

11 findings: Critical 0, High 3, Medium 6, Low 2. **8 FIXED**, **3 OPEN** (A09 native localization, A10 historical CSS/dead illustration, A11 extreme document performance). All confirmed High findings are fixed and verified. No remaining Critical/High release blocker identified. Browser release is eligible for staging→production publication under the owner's explicit authorization; signed native/device release gates remain separate.


Public staging validation: **50/50 PASS**, source b4f5708, Worker cf12781b-af35-4793-adba-b3b36c38b589. The web persistence/remote High findings are covered by public candidate checks and local runtime tests. The native connection High finding is verified by real TLS loopback regression and native builds; physical two-device native testing remains separate. Concrete commands/deployment evidence/screenshots are in TELEO_FIX_VERIFICATION.md. Production publication follows the owner's authorization and normal PR workflow.


## Production disposition — LIVE

Owner-authorized release **v1.0.2** published to https://teleo.cc/studio from merged source **ed6df817f6f53dae6ad266ee62374357a61239ef** ([PR #5](https://github.com/morphinephotographer/Teleo./pull/5)). Worker **29f1cd38-6f4e-4374-8993-c3b7bfab0c20**, deployment **906e07d4-f680-4a0e-9023-25b7d8cb980b**, 100% traffic; runtime headers and Cloudflare API agree. **62/62 public production scenarios PASS**, including exact release identity, security/Origin, EN/UK/RU persistence/playback, QR/WSS/consent/revoke, Welcome and new audit regressions. Native fixes are in Git and built/tested locally; no native distribution or physical-device claim. Known OPEN findings A09/A10/A11 remain explicit. Detailed results and rollback are in TELEO_FIX_VERIFICATION.md.
