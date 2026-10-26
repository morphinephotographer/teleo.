# QA report — 2026-10-26 (Europe/Kyiv)

**Current browser status:** public staging is deployed; the owner confirmed physical iPhone pairing and controller buttons on 2026-10-26. The owner also confirmed automatic reconnection after interruption and explicit revoke without automatic return on the physical iPhone; timings and network details are unspecified. Initial checkpoint details are retained below as history.

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

This table records the initial implementation checkpoint. Later dated follow-ups below supersede its deployment, reconnect and UI verification status; consult the final published redesign checkpoint for current web results.

| Area | Implementation | Automated | Physical / external |
|---|---|---|---|
| A: dedicated repo, rules, architecture | Implemented | Inspected | N/A |
| B: portable model + web/native reader | Implemented | Domain tests + both builds pass | Local Mac UI path passed; physical iPhone not tested |
| C: IndexedDB + SwiftData + recovery/import/export | Implemented local; CloudKit-compatible configuration present | Web + local SwiftData reopen passed | Real CloudKit **blocked: owner signing/container/devices** |
| C: folders/tombstones/revisions | Implemented | Storage tests passed | Divergent CloudKit conflict/deletion not tested |
| D: web/native keyboard adapters, profiles | Implemented | Synthetic web + Swift mapping passed | Physical HID **not tested** |
| E: browser QR + Stateful Durable Object relay | Implemented | Real local sockets/hibernation/expiry passed | Public HTTPS/WSS **not deployed/not tested** |
| E: native Bonjour + TLS-PSK local remote | Implemented with private invitation paste | Same-Mac TLS tests passed | Bonjour/iPhone permissions/firewall/offline LAN **not tested** |
| E: bounded reconnect | Browser implemented in follow-up; native still requires new pairing | Browser reconnect, outage and restart tested (see follow-up) | Physical/public network not tested |
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
| Browser host + physical iPhone on public staging | HTTPS / WSS browser controller | **Passed (owner-reported)** pairing and all controller buttons; model/OS/browser unspecified |
| VoiceOver, Reduce Motion, multiple displays | OS accessibility / scaling | **Not tested**, except semantic web controls and focus in automation |

## Remaining release work, in order

1. Owner configures Apple Team, both App IDs, the same real private CloudKit container, entitlements, remote notifications and schema; run the full physical two-device sync/conflict/deletion/account transition matrix. No claim of cloud delivery before this gate.
2. Run physical iPhone↔Mac Bonjour/TLS, Bluetooth HID, permission-denial, sleep/wake and iPhone Safari/WakeLock/fullscreen checks. Native invitation handoff is secure manual paste, not QR scanning. Native learning cancel/test timeout and hardware key-repeat/focus deserve device QA.
3. Native LAN still needs bounded secure reconnect. Browser reconnect and live numeric host state updates are implemented in the follow-up; physical/public-network validation remains required.
4. Resolve macOS XCTest UI runner bootstrap kill in this host/Xcode environment; keep the independent local app/manual path evidence separate.
5. CloudKit quota-specific UX and reliably observed remote-change status, conflict scenarios and actual upgrade migration from a future prior schema need signed integration testing. No destructive migrations are used; only schema v1 exists today.
6. Owner reviews translations/SEO indexing and approves staging/production Cloudflare deployment. Verify actual CSP/headers/DNS/TLS and public WSS. No download link exists until there is a real signed distribution.

## Final checkpoint

Exact final test counts, commit and repository state are appended after final checks. No remote is configured; **nothing pushed**. Build artifacts, logs, browser traces, credentials and native user data are excluded from Git. Screenshots include only generated QA copy.

Final automated web checkpoint: **30/30 Vitest tests passed** (2 files, ~121 seconds, including actual expiry, simultaneous invitation admission and hibernation); **28/28 Playwright tests passed** (desktop + mobile, including real QR remote in every locale); typecheck, lint and production build passed. **10/10 Swift tests passed** (8 core/storage + 2 TLS). Native help/privacy text was added after the UI scenarios and checked by final platform builds. Physical/manual gaps above remain open.

Final lint initially included Wrangler's generated nested `.wrangler/tmp` bundles; ESLint now ignores `**/.wrangler/**`. Re-run typecheck and lint passed. Formatting check passed. Final platform builds passed after all native source changes. Git commit uses an explicit automation author (`Codex <codex@localhost>`) because this empty repository has no configured user identity; no global Git identity was changed.

During preview teardown, Vite HMR logs exposed a duplicate createRoot warning on source replacement. The entry point now reuses its root through Vite hot-data; final typecheck/lint/build passed after this dev-only lifecycle fix. Production feature test counts above predate this root-reuse-only change.


## Follow-up: browser reconnect and outage resilience — 2026-10-26

This section supersedes the initial browser reconnect/state-update release gaps; native LAN reconnect remains open. No Apple Developer Team is required for this work. No native app signing, production deployment or DNS changes were attempted.

Implemented browser recovery: independent 256-bit per-role resume capabilities, tab-memory-only secrets / durable hashes, approved-session-only resume, 30-second relay grace, 25-second client budget / eight backoff attempts, per-socket IDs, stale-close suppression, durable replay ledger, monotonic state sequence and fresh numeric host snapshots. No automatic command retry/queue; unknown outcomes produce a localized EN/UK/RU warning. Explicit Revoke/exit/navigation cancels local recovery. Permanent relay failure never deletes text or stops local playback. If revoke cannot reach the relay during an outage, server authorization expires within its grace window; the offline host cannot execute remote commands.

New automated coverage: client fake-clock lifecycle/backoff/terminal closure/stale handlers/unknown ACKs; real workerd controller resume after hibernation, host socket replacement, invite replay/wrong resume/preapproval rejection, offline revoke and real 30-second grace expiry. Browser tests interrupt actual relay WebSocket connections through Playwright's transparent server connection routing (no fabricated success messages). The tests cover all three locales, both desktop/mobile viewports, host and phone recovery, uncertain-command suppression and prolonged outage. Separate local test IP headers avoid treating the whole suite as one rate-limited client; production limits are unchanged.

A first runtime attempt exposed an unsupported Worker constant export; it was corrected before passing tests. Browser tests also found a fast-replacement race in which a host resumes before its close event arrives; outstanding ACKs are now invalidated on the next connection epoch as well as on an explicit reconnecting event. Long-outage visual assertions reveal reader controls using normal pointer movement; controls auto-hide during playback and are not expected to stay visible for 25 seconds.

Final commands/results for this follow-up are recorded below after the final run. Earlier native/device verification statuses remain unchanged. New public HTTPS/WSS and physical phone-browser validation remain not tested.

The follow-up also verifies an actual Miniflare/workerd process restart using the same on-disk Durable Object store. If socket attachments disappear without close events, missing-role deadlines are recovered conservatively from durable last-observed frame timestamps; restart cannot silently extend authorization to the full one-hour session TTL. A delayed room-creation response cannot resurrect a socket after reader exit: creation is cancellable and has an 8-second deadline. Temporary runtime databases are isolated per test run and removed after tests.

Final follow-up results (2026-10-26):

| Command | Result |
|---|---|
| `npm run typecheck` | Passed frontend/domain/tests and Worker checks |
| `npm run lint` | Passed |
| `npm run build` | Passed production build; cached offline shell regenerated |
| `npm test` | **46 passed**, 3 files, 151.76 seconds; includes real 120-second invitation expiry, real 30-second recovery expiry, hibernation and runtime restart |
| `npm run test:e2e` | **38 passed**, 37.3 seconds; desktop + mobile Chromium, EN/UK/RU |
| Prettier check on changed TS/TSX files | Passed |
| Native builds/Swift tests | Not rerun for this browser-only change; earlier results above are historical |

Screenshots of the recovered controller are under `docs/screenshots/*-reconnected-controller.png` for all three languages and both viewports. Visual review of the mobile Russian controller found readable wrapped labels and accessible large controls; the page scrolls to the remaining controls. No production site, public WSS, physical iPhone/Safari, Apple signing or CloudKit verification is claimed for this follow-up.


## Follow-up: isolated Cloudflare staging — 2026-10-26

Prepared a separate teleo-staging Worker with actual ASSETS binding + the existing Room Durable Object implementation, same-origin /api/WSS, SPA deep links, enforced noindex/security headers and a self-only CSP. It has no production domain/DNS routes and a separate DO namespace. A dedicated staging build clears VITE_RELAY_URL so production relay configuration cannot leak into staging. Existing browser/native library boundaries remain unchanged.

`npx wrangler whoami` initially reported not authenticated. The owner subsequently explicitly approved OAuth login and publication of staging only; the official Wrangler browser login was started. No passwords/API tokens are requested in chat. Any successful publication/public verification is recorded separately below; local dry-run does not prove public deployment.

`npm run staging:check` passed: typecheck + Vite build + Wrangler bundle/assets/ROOMS binding dry-run. An initial sandbox attempt rejected a relative output path outside the workspace; the output path was corrected to the ignored workspace-local .staging-dry-run. No upload happened in dry-run.

`npm run test:e2e -- staging.spec.ts` passed **8/8** checks: desktop/mobile assets and security headers, no-Origin/foreign-Origin rejection including forged forwarding header, same-origin room creation, API-vs-SPA routing and independent browser phone pairing/commands/ACK/revoke in EN/UK/RU. Physical iPhone, public TLS/WSS and account deployment are separate from these local checks. Screenshots: docs/screenshots/*-staging-controller.png. Full-suite/public results follow below.

Cloudflare OAuth completed successfully after owner approval. `wrangler whoami` showed one account; `wrangler deployments list --name teleo-staging --config services/staging/wrangler.jsonc` returned code 10007 (Worker does not exist), so initial staging publication will not replace an existing Worker. Account identifiers/tokens are not added to source. The full local browser suite passed **46/46** checks, including the 8 staging checks. Public deployment results are recorded in a later checkpoint.

The first public check attempt failed because the local test harness sent synthetic CF-Connecting-IP UUID values to Cloudflare. Cloudflare rejected those requests; the real in-app browser loaded the published app successfully. The harness now injects isolated test addresses only on localhost and lets Cloudflare provide the real client address for public verification. No edge/security protections were disabled. This harness fix requires no Worker code change/redeployment.


### Verified public staging result

Owner-approved deployment succeeded: **https://teleo-staging.your-subdomain.workers.dev**, Cloudflare version **7d54f434-75e8-4995-a291-5769f7e20ab9**, application source checkpoint **5b59588**. Worker and ROOMS namespace are separate from production; no teleo.cc/api.teleo.cc DNS or custom routes were changed and no plan purchase occurred.

- `npm run typecheck`: passed, including staging entry/config.
- `npm run lint`: passed.
- `npm run staging:check`: passed production staging build + upload-free Wrangler dry-run.
- `npm run test:e2e`: **46/46 passed**, 42.8 seconds, local combined staging included.
- `TELEO_STAGING_URL=https://teleo-staging.your-subdomain.workers.dev npm run test:staging`: **8/8 passed**, 15.8 seconds, real public HTTPS/WSS and independent host/controller contexts, all three locales and desktop/mobile sizes.
- Earlier 46 Vitest tests were not rerun for this wrapper/configuration change; the shared relay source is unchanged from ad0bc37. Native tests/signing/CloudKit/hardware were not touched.

The public Studio was also opened in the in-app browser; its Russian library/empty state rendered correctly. Test screenshots contain only disposable QA copy. **Physical iPhone and Safari remain Not tested.** A public URL and automated mobile viewport are not a physical device pass. Owner can now create a disposable script on the Mac, open Read → Connect phone, scan with iPhone and approve on Mac.

A post-deployment visual review at 970px found that the empty-library panel wrapped below the sidebar. The grid now spans columns 2 through the last column, fitting both the two-column and three-column layouts. A medium-width browser regression test was added for desktop/mobile projects. After the fix, `npm run staging:check` passed and the full local suite passed **48/48**, 42.6 seconds. The next staging revision includes this CSS fix; initial public results above describe the earlier revision.

Final staging revision: **50366211-227f-4a80-879a-af4607c22dae**, application source **31f4a8d**, same workers.dev URL. After redeploying the one-line responsive grid fix, the public command `TELEO_STAGING_URL=https://teleo-staging.your-subdomain.workers.dev npm run test:staging` passed **10/10** checks in 17.1 seconds. This includes both medium-width layout regressions as well as the real HTTPS/WSS pairing checks. The final local full suite remains **48/48 passed**. Physical iPhone/Safari is still Not tested.


## Owner-reported physical iPhone acceptance — 2026-10-26

After testing the published staging, the owner reported in chat: “Проверил на айфоне, все работает, подключается как пульт и все кнопки работают должным образом”.

**Passed — owner-reported, not an additional agent-observed test:** a real iPhone connects as the browser remote and its displayed controller buttons work correctly. Context: public staging at https://teleo-staging.your-subdomain.workers.dev, latest recorded deployment 50366211-227f-4a80-879a-af4607c22dae. Exact iPhone model, iOS version, browser and network details were not supplied and are not inferred; in particular this is not labeled Safari-specific certification.

This supersedes earlier physical phone “Not tested” entries for this basic browser pairing/control path only. It does not verify native iPhone→Mac LAN, Bluetooth HID, CloudKit, background/sleep behavior, Wake Lock, orientation/accessibility or physical network interruption/reconnect. Explicit revoke/denial/expiry security behavior retains automated coverage; the report is not expanded into a separate physical security acceptance claim. No application code, deployment or automated test results changed for this documentation update.


### Physical iPhone automatic reconnect — owner report, 2026-10-26

Following the requested interruption test, the owner reported: “работает, отключается но потом переподключается автоматически”. **Passed (owner-reported):** the browser remote disconnects and subsequently reconnects automatically on the physical iPhone, in the existing public staging test context. This supersedes the earlier “physical network interruption/reconnect not tested” status for this reported scenario.

No exact outage duration, network transition, reconnect latency, iPhone/iOS/browser version or host playback continuity was reported; these are not inferred. Long outages, background/sleep, native LAN, HID, CloudKit and separate physical revoke/expiry checks retain their prior status. This is a documentation-only update; no deployment or automated test rerun was needed.


## Owner-confirmed revoke and reconnect action — 2026-10-26

The owner confirmed on the physical iPhone staging path that explicit access revocation breaks the connection and does not automatically reconnect. Exact device/OS/browser versions, observation duration and network details remain unspecified. This is owner-reported acceptance of that behavior, not a broader security audit.

Requested UX change: the host's terminal disconnected/unavailable panel now replaces Revoke with localized Reconnect (EN), Підключити знову (UK), Переподключить (RU). It creates a new one-use invitation, clears stale approval/QR state and still requires scanning/opening the new invite plus explicit host approval. Temporary reconnecting sessions retain Revoke so recovery can be cancelled. Revoked keys are never reactivated.

The regression test exposed an existing same-document navigation issue: opening a new /remote#pair invitation in an already used controller tab changed the fragment without starting a new session. The remote page now consumes invitations on hashchange as well as initial navigation and immediately removes the fragment. Locale/script state is preserved, listener cleanup is explicit, and the new session still awaits host approval. Tests now cover button replacement in all three locales, a fresh/different invitation, no automatic return of the old phone session, re-pairing in the same tab and subsequent command ACK.

`npx vitest run tests/domain.test.ts tests/remote-client.test.ts`: **31 passed**, including dictionary parity and client lifecycle. The relay/native sources are unchanged; their longer integration suites were not rerun for this UI change. Full browser/build/public results follow after execution. The user's attached photograph is not copied into the repository; screenshots contain generated QA copy only.

For this change, `npm run staging:check` passed (typecheck, production staging build, Wrangler dry-run), `npm run lint` passed and `npm run test:e2e` passed **48/48** in 41.6 seconds. This includes the new fresh-invitation/same-tab re-pairing checks on desktop and mobile.

Published UI source **f13b572** to the existing staging URL, Cloudflare version **20596440-d736-4994-8609-bd5300c7fa5f**. `TELEO_STAGING_URL=https://teleo-staging.your-subdomain.workers.dev npm run test:staging` passed **10/10** checks in 20.0 seconds. Public tests confirm the localized replacement button, fresh invitation, mandatory approval and successful control after reopening the new QR in the same phone tab. Screenshots of the terminal panel: docs/screenshots/desktop-reconnect-after-revoke.png and mobile-reconnect-after-revoke.png. Production domains/DNS were unchanged.

### Owner acceptance of the reconnect button — 2026-10-26

After the staging update, the owner reported that the change works. This records owner acceptance of the requested Reconnect action after access revocation; exact device/browser versions and individual re-pairing steps were not supplied. Automated fresh-invitation and mandatory-approval evidence remains recorded above.

## Compact monochrome web redesign — 2026-10-26

Implemented the owner's new visual references across the web routes: monochrome palette, rounded surfaces/pill actions, segmented navigation, viewport-sized studio, mobile panel navigation and a simplified phone controller with symbol/label buttons. Native UI is unchanged. Long content and expanded advanced settings remain reachable through internal scrolling; the connected controller is checked for no internal or document overflow. See WEB_UI.md for layout and haptic limitations.

Final verification: `npm run staging:check` passed typecheck, staging production build and Worker dry-run; `npm run lint` passed; `npx vitest run tests/domain.test.ts tests/remote-client.test.ts` passed **31/31**; `npm run test:e2e` passed **54/54** in **50.7 seconds**. New checks cover EN/UK/RU studio at 1440×800, 1024×700, 390×664, 320×568 and 844×390, plus real connected controllers at 320×568, 390×664 and 844×390. Existing HID automation now explicitly changes mobile panels before reading. Public deployment verification follows separately.

The controller requests optional 12 ms vibration only when the API exists; an instrumented browser check proves the call and subsequent command ACK, not physical vibration. iPhone Safari does not expose the standard vibration API; visual press feedback works without it. Physical acceptance of the redesigned UI and VoiceOver remain not tested. Screenshots contain generated QA text, not the owner's attached photos.

Published redesign source **7b5bf21** to the existing staging site, Worker version **e3e950a2-e15b-48c2-a701-d17218c4f183**. Public `TELEO_STAGING_URL=https://teleo-staging.your-subdomain.workers.dev npm run test:staging` passed **10/10** in **18.7 seconds**, including real HTTPS/WSS commands, viewport fit, optional vibration invocation, revocation and fresh invitation in the reused controller tab. Production DNS/routes were not changed.

## Complete website workspace redesign — 2026-10-26

The new owner brief supersedes the conventional homepage: `/` now opens the same workspace as `/studio`, following a skippable 3.45-second letter-convergence intro once per tab session. Reduced motion bypasses intro and remote deep links never show it. Added reusable SVG icon buttons, sliding segmented groups and a native dialog settings sheet; collapsible library, current script selector, editor metrics, reading preview, viewport reader/dock, local light/dark/system theme, adjustable guide and optional text dimming. The phone controller and native Apple UI are retained from the prior phase.

Baseline before changes: build and focused **31/31** Vitest tests passed; **54/54** browser tests passed in 52.0 seconds. Final local source: staging build/typecheck/dry-run and lint passed; **31/31** focused Vitest tests passed; **72/72** Playwright tests passed (reported 1.3 minutes). New viewport checks cover all requested desktop/tablet/phone sizes and landscape, session intro/skip, reduced motion, focus management, mirror, fullscreen fallback, persistence and simulated keyboard viewport resize. Desktop and iPhone emulation use Chromium; WebKit is not installed. Real Safari keyboard/chrome, VoiceOver and animation smoothness remain not tested on hardware. See docs/audits/TELEO_UI_REDESIGN_REPORT.md and docs/design for decisions, screenshots and limitations. Source protocols/storage schema/native apps are unchanged. Publication results follow separately.

### Follow-up discovered by public redesign checks

Initial parallel public runs failed because they shared Playwright trace/report output; this was a test-runner artifact collision, not a relay/security rejection. Local, staging-relay and staging-redesign suites now have independent output directories. Public viewport tests also exposed restoration of an older speed during rapid navigation. The autosave coordinator previously let an older completion clear newer recovery and display Saved prematurely. New `DraftWriter` keeps latest dirty snapshots separate from pending/in-flight writes, preserves newer recovery and prevents stale failures from overwriting newer queued edits. The stored schema and remote protocol are unchanged.

After the fix: **35/35** focused Vitest tests passed, including four controlled asynchronous save regressions; typecheck/lint/staging build/dry-run passed; focused redesign suite **18/18** passed (40.8 seconds); full local browser regression **72/72** passed again (reported 1.3 minutes). Initial failed public runs are not accepted as passes. Updated public results follow after redeployment.

Save-fix source c440ba6 passed public relay **10/10** (15.4 seconds) and redesign **18/18** (34.1 seconds). A final dark-system check then isolated the retained phone controller's white palette from the new automatic interface theme. Its black-on-white text is now explicitly asserted with dark media emulation. After this final CSS correction the full local **72/72** browser suite passed again (reported 1.3 minutes), with build/typecheck/dry-run/lint passed. Final staging version/public rerun follows.

### Final published redesign checkpoint

Application source **531a3ca**; Worker version **6d2438f8-99ea-4676-8b3c-0a181150b471**. Final public relay/security suite **10/10 passed** (13.5 seconds); final public redesign suite **18/18 passed** (35.6 seconds), including dark-system controller contrast and saved-speed regression. Final local full browser suite **72/72 passed**, focused unit suites **35/35 passed**, build/typecheck/dry-run/lint passed. All checks use generated isolated test content. Physical acceptance of this new UI is still not tested. See docs/audits/TELEO_UI_REDESIGN_REPORT.md and docs/design. Production DNS/routes unchanged; branch codex/teleo-premium-workspace.


## v0.3.1 integrated Studio and permissioned phone preview — 2026-10-26

The reviewed v0.3.1 brief is implemented in the existing workspace: integrated Playback/Text/Appearance settings, shared top-layer pickers/action menus, tested compatibility fallback, and Remote/Text/Settings phone UI with clipped semantic speed wings. Paragraph controls remain rectangles. The existing multiplier, storage format, command engine, intro, HID mapping and explicit pairing/revoke model are retained. Editing keeps an approved phone connected for live revisions and script switches; explicit Exit still revokes.

Preview is off by default and requires separate host consent for the paired session. Versioned bounded snapshots and compact position updates use the existing authenticated transport. Revocation/loss/expiry clear phone memory; bounded resume requests a fresh authoritative snapshot. Relay integration tests inspect actual test SQLite stores for absence of private title/body markers. WSS is transport encryption, not E2EE; authorized plaintext is processed transiently by the relay. Native Apple apps are unchanged.

Local verification: build/typecheck/staging dry-run/lint passed; full Vitest **64/64 passed** (six files, 153.22 seconds); final full Playwright **86/86 passed** (1.9 minutes), including six visual golden comparisons and existing regressions. Focused final visual verification and public deployment results follow. The initial sandboxed Miniflare listener failure and intermediate test-harness adaptations are documented in the audit, not counted as passes.

Reviewed generated screenshots and complete dropdown inventory are in docs/audits/TELEO_V03_UI_AUDIT.md; design/limits/schema in docs/design/TELEO_V03_DESIGN_SYSTEM.md and TELEO_REMOTE_V03.md. Chromium desktop/iPhone emulation only; physical iPhone/Safari/WebKit/Firefox/VoiceOver/Bluetooth and actual vibration are not certified by this iteration. Optional standard vibration is capability-gated; unsupported phone browsers show an explanation. No production domain/DNS changes.

### v0.3.1 final staging checkpoint — 2026-10-27

Deployed application source **19a2428**, Worker **cfbad529-2d5f-4c47-857b-a5b9a058a312**, at https://teleo-staging.your-subdomain.workers.dev. Focused local final visual checks **14/14 passed** (49.1 seconds). First public run had three seek/highlight test races (29/32): a previous phone paragraph command was still in flight when the test sought on the host. The harness now records the routed WSS frames themselves and waits for each exact command ID's ACK. It also positively verifies receipt of the default-denied permission frame before asserting no text delivery. No application change, relaxed assertion or snapshot update was needed.

Final public UI/real transport suite **32/32 passed** (58.6 seconds); separate public assets/Origin/security-header suite **2/2 passed** (2.7 seconds), total **34/34**. Final typecheck/lint passed after harness correction. Full local application regression remains **86/86**, full unit/relay **64/64**. Six golden snapshots were compared without updates. Generated final screenshots use v031-*; preceding release screenshots are preserved. Normal tablet editor and drawer were both visually reviewed. Branch codex/teleo-v031-studio-remote; protocol 07271df, UI 19a2428. Production/main/DNS unchanged. Physical acceptance of this new UI and standard vibration behavior remain to be tested on actual hardware.
