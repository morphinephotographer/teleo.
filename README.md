# teleo.

Your words. Your pace.

A private browser teleprompter in English, Ukrainian and Russian, plus native SwiftUI iPhone and macOS clients. This repository contains working local clients and two independent phone-control transports. **It is not a production release:** real CloudKit two-device sync, physical HID accessories, physical native iPhone→Mac LAN still require the owner/device verification described in [QA](docs/QA_REPORT.md).

## Run the web client and real local relay

Prerequisites: Node 24+, npm, macOS or supported Node development host.

```sh
npm ci
npm run relay  # terminal 1: Cloudflare Durable Object, port 8787
npm run dev    # terminal 2: http://127.0.0.1:5173
```

Both `/` and `/studio` open the workspace after a skippable, once-per-tab-session brand intro (bypassed with reduced motion). The library collapses; reading has a floating control dock; settings use an accessible modal sheet. TXT/JSON storage and remotes retain their existing contracts. [Design and UI verification](docs/audits/TELEO_UI_REDESIGN_REPORT.md).

Routes: `/`, `/studio`, `/remote`, `/help`, `/privacy`; `?lang=en|uk|ru`. Create a script, enter Read, Connect phone, open QR invitation in another browser context and approve on the host. Loopback pairing shows a real QR and invitation link explicitly labeled as same-Mac only; neither can connect a physical iPhone. For a physical phone use the explicit trusted HTTPS LAN workflow below or the approved HTTPS/WSS staging deployment. Approved browser pairs automatically reconnect after short interruptions (25-second client budget / 30-second relay window), without replaying uncertain commands. Refreshing either page still requires new pairing. No automatic web↔native library synchronization. Back up via `.txt` / versioned JSON before clearing site data.

```sh
npm run typecheck
npm run lint
npm test                 # includes real 120-second expiry + DO hibernation test
npm run build
npx playwright install chromium
npm run test:e2e         # starts local dev/relay + built preview at 5174
```

The production service worker caches the app shell and all UI translations after an initial successful visit. Offline editing is available after caching. Deployment is prepared in `wrangler.jsonc` and `services/remote-relay/wrangler.jsonc`; **production deployment and production DNS mutation have not been performed**. [Cloudflare instructions](docs/CLOUDFLARE_DEPLOYMENT.md).

## Native iPhone and Mac

Prerequisites: Mac with Xcode 15+ capable of iOS 17/macOS 14 APIs; development verified with Xcode 27.1 / Swift 6.4. Open `apps/apple/Teleo.xcodeproj`, choose `Teleo-iOS` or `Teleo-macOS`. No external Swift packages. Project regeneration: `python3 scripts/generate-xcode.py` (do not run over intentional manual Xcode changes without reviewing its generator).

```sh
swift test --package-path apps/apple --scratch-path /private/tmp/teleo-swift-build
xcodebuild -project apps/apple/Teleo.xcodeproj -scheme Teleo-macOS -configuration Debug -destination 'platform=macOS,arch=arm64' -derivedDataPath /private/tmp/teleo-derived CODE_SIGNING_ALLOWED=NO build
xcodebuild -project apps/apple/Teleo.xcodeproj -scheme Teleo-iOS -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /private/tmp/teleo-derived-ios CODE_SIGNING_ALLOWED=NO build
```

Shared schemes include UI tests. Choose an available iPhone simulator ID using `xcrun simctl list devices available`, then run xcodebuild with `-destination 'platform=iOS Simulator,id=YOUR_ID' test`. UI tests launch an in-memory library using `--teleo-ui-test`, never the owner's saved library. macOS UI test runners need at least ad-hoc signing (`CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM=`); unsigned macOS binaries may be killed before test bootstrap. See QA for exact executed commands/results.

Both apps default to a persistent local SwiftData store and run without iCloud. CloudKit is explicitly enabled only after the owner sets Team, capabilities, shared container and Info.plist identifier. [Data/iCloud setup](docs/DATA_AND_ICLOUD.md). No real Team ID, provisioning profile or container ownership is invented. Native Bonjour/TLS-PSK pairing uses a securely transferred 120-second invitation; [remote instructions](docs/REMOTES_AND_PAIRING.md).

## Project guide

- [Master scope](docs/PRODUCT_SPEC_V1.md), [decisions](docs/DECISIONS.md), [architecture](docs/ARCHITECTURE.md)
- [Data and iCloud](docs/DATA_AND_ICLOUD.md), [portable fixtures](contracts/README.md)
- [Localization](docs/WEB_LOCALIZATION.md), [pairing](docs/REMOTES_AND_PAIRING.md), [security](docs/SECURITY.md)
- [Deployment](docs/CLOUDFLARE_DEPLOYMENT.md), [verification and release gaps](docs/QA_REPORT.md)

No accounts, subscriptions, AI, recording, public sharing or Android. System fonts only. Never commit credentials, Xcode user state or personal scripts.

## Phone-test staging

The isolated staging Worker combines built assets and the real relay on one origin. `npm run staging:check` builds and dry-runs it without publishing; `npm run staging:local` serves it at port 8788. `npm run test:staging` checks routes/security/real pairing locally. After owner-approved publication, set `TELEO_STAGING_URL` to the returned workers.dev URL and rerun `npm run test:staging` against public HTTPS/WSS. [Setup and physical phone checklist](docs/CLOUDFLARE_DEPLOYMENT.md#isolated-phone-test-staging-worker). No Apple Developer Team is required.

Verified public staging: [Open teleo. Studio](https://teleo-staging.your-subdomain.workers.dev/studio). Published with owner approval on 2026-10-26; 10 public HTTPS/WSS/layout checks passed. The owner confirmed physical iPhone browser pairing and all controller buttons on 2026-10-26. The owner also confirmed automatic reconnection after a physical iPhone connection interruption and confirmed that explicit revoke disconnects without automatic return. Exact browser/version, outage duration and background/sleep behavior remain unverified. teleo.cc is not published by this staging deployment.

Localhost and the public staging hostname have separate browser libraries. Use .txt/JSON import/export for manual transfer, or create a new disposable script for phone testing.

Public redesign checks after an authorized staging update:

```sh
TELEO_STAGING_URL=https://teleo-staging.your-subdomain.workers.dev npx playwright test --config playwright.redesign-staging.config.ts
```

These exercise intro, responsiveness, persistence and modal/reader interactions in independent generated test libraries. They do not certify physical iOS keyboard/VoiceOver or hardware remotes.

## Previous v0.3.1 Studio and phone Text preview (public staging)

Wide Studio integrates Playback / Text / Appearance settings beside the editor. All dropdowns use one accessible top-layer system, with a styled native fallback for older browsers. That release has a central Play/Pause, curved clipped speed wings, rectangular paragraph controls and Remote / Text / Settings tabs. Text stays private until separate host permission; allowed previews are temporary relay forwards and phone memory, not a cloud library. Edit mode keeps a paired session for live revisions; explicit Exit/Revoke ends it. No iPhone Taptic support is invented. [UI audit](docs/audits/TELEO_V03_UI_AUDIT.md), [protocol/privacy](docs/design/TELEO_REMOTE_V03.md).

```sh
TELEO_V031_URL=https://teleo-staging.your-subdomain.workers.dev npx playwright test --config playwright.v031-staging.config.ts
```

Public room creation is limited to 10/minute/IP. The v0.3.1 UI cohort creates six rooms; the separate API-only security cohort creates two. Do not run additional room-creating public suites inside the same quota window. Local tests use isolated synthetic development clients only.

## v0.6 approved remote and Studio fixes

The phone now follows the approved dark two-state reference: live permissioned text, monochrome seek timeline, circular playback/speed controls, paragraph buttons and a three-slider quick typography sheet. The single top-right gear opens advanced settings. Host-confirmed commands reuse existing pairing/ACKs; private text remains opt-in. Studio has aligned SVG chevrons, centered import, shared shape tokens, custom folder/deletion dialogs and an inline action toolbar. QR pairing is a separately closable dialog that dismisses only after approved readiness.

[Approved layout](docs/design/TELEO_REMOTE_APPROVED_V06.md) · [Pairing/sync](docs/engineering/TELEO_PAIRING_AND_SYNC_V06.md) · [Audit/results](docs/audits/TELEO_UI_AUDIT_V06.md).

This iteration is local-only: no deployment or remote push is authorized. The existing public staging continues to run the preceding release until a separate authorized deployment.

## Previous approved four-screen UI and HTTPS LAN

The previous approved remote reference is `design-references/02_APPROVED_REMOTE_FOUR_STATES.png`; the v0.6.1 text-sheet requirements below supersede its six-item quick menu. The bottom button opens the approved six-item menu; the gear opens full-screen categorized settings and timer/typography details. Studio operational controls now live in the bottom toolbar, with an icon-only countdown immediately after text width. The obsolete three-dot navigation is removed; public routes remain.

`npm run dev` remains loopback-only. `npm run dev:lan` explicitly binds a chosen private interface with a trusted certificate, an isolated loopback HTTPS relay and an exact-origin allowlist. It does not modify certificate trust, firewall, DNS or public deployments. See [connection diagnosis and LAN setup](docs/TELEO_REMOTE_CONNECTION_FIX.md) before testing an iPhone. This iteration's local LAN HTTPS/WSS clients ran on the Mac; physical iPhone scanning remains unverified.

[Implementation](docs/TELEO_UI_IMPLEMENTATION.md) · [Visual/functional QA](docs/TELEO_VISUAL_QA.md) · [Individual test results](docs/TELEO_TEST_RESULTS.md).

## Current v0.6.1 alignment and QR pairing

Studio's **bottom toolbar** and the remote's bottom text sheet share one accessible, icon-only Left / Center / Right capsule. The phone sheet retains all three typography sliders. The single top-right gear retains advanced settings. Alignment uses the existing authenticated command/state/ACK transport, exact enum validation and host authority; it persists with the script without restarting playback or resetting the reading position.

Pairing always generates a real QR from the current one-use invitation, with loading, rendering-error and regeneration states. Closing the dialog preserves the pending session; only authorized connection automatically dismisses it. Loopback (`127.0.0.1`, `localhost`, `::1`) is **same-Mac testing only**: on an iPhone, loopback refers to the iPhone itself. For a physical phone, open the same reachable HTTPS LAN or authorized HTTPS staging origin on both devices. A local source change does not update public staging or transfer local scripts.

[Implementation, QA, screenshots and limitations](docs/audits/TELEO_V061_ALIGNMENT_QR_FIX.md). v0.6.1 source commit `3896ec2` was published to the existing staging Worker with owner approval on 2026-10-27; six public HTTPS/WSS checks passed in Chromium/WebKit. No remote push was performed. [Publication and physical iPhone checklist](docs/audits/TELEO_V061_STAGING_DEPLOYMENT.md).
