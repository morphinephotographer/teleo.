# QA report — 2026-10-26 (Europe/Kyiv)

This is a verified development checkpoint, **not acceptance of every v1.0 P0**. Implemented source, automated pass, manual/device pass, blocked and not tested are separate statuses. No production deployment, iCloud account access, hardware Bluetooth test or push occurred.

## Audit and environment

Dedicated empty repository `~/Documents/ChatGPT/Teleo`, initial branch main, no user changes, no remotes. No v0.2 source/UI references found in workspace or Downloads. Read all 332 lines of the supplied `teleo_codex_task_v1_1.md` (master revision 1.1) before editing; retained as PRODUCT_SPEC_V1.md. Work branch `codex/teleo-native-web-v1`.

Node 24.22.1 / npm 11.19.1, Xcode 27.1 (27A9275), Swift 6.4, iOS SDK 27.1/macOS SDK 27.0. Minimum deployment iOS 17/macOS 14. Simulator iOS 27.0. Only task-specific build caches under `/private/tmp` and a dedicated `Teleo-QA-iPhone` Simulator were used; no unrelated project/simulator was modified.

## Automated commands and results

| Command | Observed result |
|---|---|
| `npm run typecheck` | Passed; frontend/domain/tests and separate Worker tsconfig |
| `npm run lint` | Passed ESLint |
| `npm run build` | Passed Vite production build; bundled dictionaries + generated offline service worker |
| `npm test` | Final result recorded below; real Miniflare/workerd, not a simulated relay |
| `npm run test:e2e` | Final result recorded below; Chromium desktop and iPhone-sized Chromium viewport (not real Safari) |
| `swift test --package-path apps/apple --scratch-path /private/tmp/teleo-swift-build` | **10 passed**: 8 core/storage/conformance + 2 real TLS-PSK transport tests |
| `npm install --package-lock-only --cache /private/tmp/teleo-npm-cache` audit | 0 known vulnerabilities after dependency updates |

Native builds executed (both **BUILD SUCCEEDED**):

```sh
xcodebuild -project apps/apple/Teleo.xcodeproj -scheme Teleo-macOS -configuration Debug -destination 'platform=macOS,arch=arm64' -derivedDataPath /private/tmp/teleo-derived CODE_SIGNING_ALLOWED=NO build
xcodebuild -project apps/apple/Teleo.xcodeproj -scheme Teleo-iOS -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /private/tmp/teleo-derived-ios CODE_SIGNING_ALLOWED=NO build
```

No Swift compile warnings in final builds. Xcode emits a tooling warning that AppIntents metadata extraction is skipped because the app does not use AppIntents; there is no AppIntents feature in scope. Earlier SwiftData key-path concurrency warnings were removed by changing checkpoint fetching to actor-local filtering/sorting. Source currently builds in Swift 5 language mode with complete concurrency checking; core/remotes package uses Swift 6.

Native UI test executed:

```sh
xcodebuild -project apps/apple/Teleo.xcodeproj -scheme Teleo-iOS -configuration Debug -destination 'platform=iOS Simulator,id=90947FFD-AE10-4907-A47B-314FC53AF4DE' -derivedDataPath /private/tmp/teleo-derived-ios -resultBundlePath /private/tmp/teleo-ios-ui-final.xcresult CODE_SIGNING_ALLOWED=NO test
xcrun xcresulttool get test-results summary --path /private/tmp/teleo-ios-ui-final.xcresult
```

**1 test passed, 0 failed, 0 skipped**, independently confirmed in xcresult. It creates/edits a native script, enters immersive reader, verifies Play/Pause and exit. It uses an in-memory test library. Screenshot: [native iOS reader](screenshots/native-ios-reader.png). Later formatting and Unicode glyph-range fix were compiled on both platforms; the iOS UI pass predates that small layout fix, so it is not proof of every final layout variant.

macOS UI runner: both unsigned and ad-hoc signed attempts **FAILED before test bootstrap**: `Early unexpected exit … Test crashed with signal kill before establishing connection`. Signed command:

```sh
xcodebuild -project apps/apple/Teleo.xcodeproj -scheme Teleo-macOS -configuration Debug -destination 'platform=macOS,arch=arm64' -derivedDataPath /private/tmp/teleo-derived -resultBundlePath /private/tmp/teleo-macos-ui-signed.xcresult CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM= test
```

No macOS XCTest UI pass is claimed. The built application itself launched successfully via native UI automation: created `teleo. QA — native Mac`, entered English/Ukrainian/emoji text, observed Saved on this device, opened a separate native reader window, observed Play→Pause and advancing numeric reading position, visually inspected it, then exited reader. This is a **manual/UI pass for that local path**, not hardware/iCloud coverage. The QA sample remains in the local native library; no user content was deleted.

## Coverage

- TS engine: equal time-based distance at 60/120 Hz, 50ms stall cap, pause/resume, bounds, countdown, paragraphs, invalid commands, idempotent play/pause.
- Web storage: exact Unicode/newlines/empty text, long text, validated version/preferences, revisions/restore, tombstones, retention and folder detachment. Browser e2e: create/edit/title/duplicate/delete/import/export/reload and versions. A local recovery journal protects pending edits when localStorage is available.
- i18n: full typed key parity for EN/UK/RU, regional detection, manual choice, refresh, storage-disabled switch, html lang/metadata, language change during editing/playing without changing script text. Five routes × three locales × two sizes have screenshots. Actual linguistic review and VoiceOver remain not tested.
- HID: synthetic browser keys and keyboard domain context/repeat/IME/modifier tests; two-button learning/conflict and actual dispatcher behavior. Native mapping unit tests and focused adapter source, but physical hardware not tested.
- Relay: real host/controller sockets in separate browser contexts; approval/commands/ACK/revoke. Miniflare runtime covers hibernation eviction/reconstruction, replay suppression, simultaneous one-use invite admission, deny/revoke, Origin, bad auth/role/fields, stale ACK, message/creation rate limits and actual 120-second expiry. No mock successful network responses.
- Offline: production app shell is cached, text persists after offline reload, all three bundled UI languages switch offline. An initial failure exposed Vary: Origin cache matching; fixed with ignoreVary only for same-origin precached static resources.
- Swift: portable Unicode + shared JSON fixture, time math, commands, mapping/presets, replay/revoke/expiry gate, real on-disk SwiftData reopen/revisions/tombstone, and real same-Mac TLS encrypted command/ACK/revoke. Wrong PSK cannot enroll and setup times out safely after 8 seconds. This is not physical iPhone↔Mac proof.

## P0 / phase status

| Area | Implementation | Automated | Physical / external |
|---|---|---|---|
| A: dedicated repo, rules, architecture | Implemented | Inspected | N/A |
| B: portable model + web/native reader | Implemented | Domain tests + both builds pass | Local Mac UI path passed; physical iPhone not tested |
| C: IndexedDB + SwiftData + recovery/import/export | Implemented local; CloudKit-compatible configuration present | Web + local SwiftData reopen passed | Real CloudKit **blocked: owner signing/container/devices** |
| C: folders/tombstones/revisions | Implemented | Storage tests passed | Divergent CloudKit conflict/deletion not tested |
| D: web/native keyboard adapters, profiles | Implemented | Synthetic web + Swift mapping passed | Physical HID **not tested** |
| E: browser QR + Stateful Durable Object relay | Implemented | Real local sockets/hibernation/expiry passed | Public HTTPS/WSS **not deployed/not tested** |
| E: native Bonjour + TLS-PSK local remote | Implemented with private invitation paste | Same-Mac TLS tests passed | Bonjour/iPhone permissions/firewall/offline LAN **not tested** |
| E: bounded seamless reconnect | **Not implemented**; fail-closed revoke + new invitation | Fail-closed path tested | Release gap |
| F: complete web UI language dictionaries and offline shell | Implemented | Desktop/mobile Chromium passed | iPhone Safari/VoiceOver not tested |
| F: docs + Cloudflare config | Implemented | Typecheck/build/local relay passed | Deployment needs explicit approval |

## Manual hardware and account matrix

| Device / scenario | Input / transport | Result |
|---|---|---|
| Local Mac, native editor/reader | Native UI, no physical clicker | **Passed** limited create/edit/read/play/exit path |
| iPhone 18 Pro Simulator, iOS 27 | XCTest UI, no hardware HID | **Passed** 1 UI scenario |
| Physical iPhone, portrait/landscape, wake release | Native app + hardware keyboard | **Not tested** |
| Mac + external Bluetooth presentation clicker/pedal | Delivered HID events | **Not tested**; model/accessory unspecified |
| iPhone + Bluetooth clicker/pedal | Delivered HID events | **Not tested**; model/accessory unspecified |
| Mac + iPhone signed into same iCloud account | Create/edit/offline divergence/delete/sign-out/quota | **Blocked / not tested** |
| Physical iPhone + Mac, no internet | Bonjour + authenticated TLS, approval/ACK/revoke/sleep/denial | **Not tested** |
| Browser Mac + physical phone on public domain | HTTPS QR / WSS | **Not deployed / not tested** |
| VoiceOver, Reduce Motion, multiple displays | OS accessibility / scaling | **Not tested**, except semantic web controls and focus in automation |

## Remaining release work, in order

1. Owner configures Apple Team, both App IDs, the same real private CloudKit container, entitlements, remote notifications and schema; run the full physical two-device sync/conflict/deletion/account transition matrix. No claim of cloud delivery before this gate.
2. Run physical iPhone↔Mac Bonjour/TLS, Bluetooth HID, permission-denial, sleep/wake and iPhone Safari/WakeLock/fullscreen checks. Native invitation handoff is secure manual paste, not QR scanning. Native learning cancel/test timeout and hardware key-repeat/focus deserve device QA.
3. Implement bounded secure reconnect for both transports with explicit per-session resume authorization; current fresh-invitation policy is safe but below requested reconnect scope. Improve remote observed-state updates when local playback changes without a remote request (current controller shows its latest command ACK, not continuous progress).
4. Resolve macOS XCTest UI runner bootstrap kill in this host/Xcode environment; keep the independent local app/manual path evidence separate.
5. CloudKit quota-specific UX and reliably observed remote-change status, conflict scenarios and actual upgrade migration from a future prior schema need signed integration testing. No destructive migrations are used; only schema v1 exists today.
6. Owner reviews translations/SEO indexing and approves staging/production Cloudflare deployment. Verify actual CSP/headers/DNS/TLS and public WSS. No download link exists until there is a real signed distribution.

## Final checkpoint

Exact final test counts, commit and repository state are appended after final checks. No remote is configured; **nothing pushed**. Build artifacts, logs, browser traces, credentials and native user data are excluded from Git. Screenshots include only generated QA copy.

Final automated web checkpoint: **30/30 Vitest tests passed** (2 files, ~121 seconds, including actual expiry, simultaneous invitation admission and hibernation); **28/28 Playwright tests passed** (desktop + mobile, including real QR remote in every locale); typecheck, lint and production build passed. **10/10 Swift tests passed** (8 core/storage + 2 TLS). Native help/privacy text was added after the UI scenarios and checked by final platform builds. Physical/manual gaps above remain open.

Final lint initially included Wrangler's generated nested `.wrangler/tmp` bundles; ESLint now ignores `**/.wrangler/**`. Re-run typecheck and lint passed. Formatting check passed. Final platform builds passed after all native source changes. Git commit uses an explicit automation author (`Codex <codex@localhost>`) because this empty repository has no configured user identity; no global Git identity was changed.

During preview teardown, Vite HMR logs exposed a duplicate createRoot warning on source replacement. The entry point now reuses its root through Vite hot-data; final typecheck/lint/build passed after this dev-only lifecycle fix. Production feature test counts above predate this root-reuse-only change.
