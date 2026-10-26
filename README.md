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

Routes: `/`, `/studio`, `/remote`, `/help`, `/privacy`; `?lang=en|uk|ru`. Create a script, enter Read, Connect phone, open QR invitation in another browser context and approve on the host. Local QR URLs use loopback; a physical phone needs an approved reachable HTTPS/WSS staging deployment. Approved browser pairs automatically reconnect after short interruptions (25-second client budget / 30-second relay window), without replaying uncertain commands. Refreshing either page still requires new pairing. No automatic web↔native library synchronization. Back up via `.txt` / versioned JSON before clearing site data.

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
