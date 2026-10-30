# Teleo.

Your words. Your pace.

A private browser teleprompter in English, Ukrainian and Russian, plus native SwiftUI iPhone and macOS clients. This repository contains working local clients and two independent phone-control transports. **Native release gates remain:** real CloudKit two-device sync, physical HID accessories, physical native iPhone→Mac LAN still require the owner/device verification described in [QA](docs/QA_REPORT.md).

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

The production service worker caches the app shell and all UI translations after an initial successful visit. Offline editing is available after caching. Production is live on `https://teleo.cc`, served by the same-origin Worker in root `wrangler.jsonc`. The split relay configuration is for local development; see the release records below. [Cloudflare instructions](docs/CLOUDFLARE_DEPLOYMENT.md).

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

Historical v0.6 implementation record: this iteration was initially local-only and was subsequently superseded by the authorized releases below.

## Previous approved four-screen UI and HTTPS LAN

The previous approved remote reference is `design-references/02_APPROVED_REMOTE_FOUR_STATES.png`; the v0.6.1 text-sheet requirements below supersede its six-item quick menu. The bottom button opens the approved six-item menu; the gear opens full-screen categorized settings and timer/typography details. Studio operational controls now live in the bottom toolbar, with an icon-only countdown immediately after text width. The obsolete three-dot navigation is removed; public routes remain.

`npm run dev` remains loopback-only. `npm run dev:lan` explicitly binds a chosen private interface with a trusted certificate, an isolated loopback HTTPS relay and an exact-origin allowlist. It does not modify certificate trust, firewall, DNS or public deployments. See [connection diagnosis and LAN setup](docs/TELEO_REMOTE_CONNECTION_FIX.md) before testing an iPhone. This iteration's local LAN HTTPS/WSS clients ran on the Mac; physical iPhone scanning remains unverified.

[Implementation](docs/TELEO_UI_IMPLEMENTATION.md) · [Visual/functional QA](docs/TELEO_VISUAL_QA.md) · [Individual test results](docs/TELEO_TEST_RESULTS.md).

## Current v0.6.1 alignment and QR pairing

Studio's **bottom toolbar** and the remote's bottom text sheet share one accessible, icon-only Left / Center / Right capsule. The phone sheet retains all three typography sliders. The single top-right gear retains advanced settings. Alignment uses the existing authenticated command/state/ACK transport, exact enum validation and host authority; it persists with the script without restarting playback or resetting the reading position.

Pairing always generates a real QR from the current one-use invitation, with loading, rendering-error and regeneration states. Closing the dialog preserves the pending session; only authorized connection automatically dismisses it. Loopback (`127.0.0.1`, `localhost`, `::1`) is **same-Mac testing only**: on an iPhone, loopback refers to the iPhone itself. For a physical phone, open the same reachable HTTPS LAN or authorized HTTPS staging origin on both devices. A local source change does not update public staging or transfer local scripts.

[Implementation, QA, screenshots and limitations](docs/audits/TELEO_V061_ALIGNMENT_QR_FIX.md). v0.6.1 source commit `3896ec2` was published to the existing staging Worker with owner approval on 2026-10-27; six public HTTPS/WSS checks passed in Chromium/WebKit. No remote push was performed. [Publication and physical iPhone checklist](docs/audits/TELEO_V061_STAGING_DEPLOYMENT.md).

## Original production web release — historical

Open [teleo.cc](https://teleo.cc). The original web release `v1.0.0`, source `1c3d9f3`, was published and verified by 24 public HTTPS/WSS smoke checks across Chromium, WebKit and iPhone/iPad viewports. Physical device verification of this production domain remains separate. `www` redirects to the canonical domain; staging is unchanged.

The production target is the existing root `wrangler.jsonc` / `teleo-web`, with same-origin assets and relay, an isolated ROOMS namespace, canonical `https://teleo.cc`, and a www redirect. Production validation: `npm run production:check`. After critical checks, use a clean checkout and an interactive terminal for `npm run deploy:production`; the build clears external relay overrides. Runtime response headers identify the deployed commit and Worker version.

[Launch status, checks, release tag and rollback](docs/releases/TELEO_PRODUCTION_LAUNCH.md). The historical split api.teleo.cc instructions are superseded by this same-origin production configuration.

## UI v0.7 / release 1.0.1

The host and iPhone remote share an inert `teleo.` wordmark and one 44px circular EN / UA / RU language control. A saved manual device preference wins over browser languages; URL language hints never reset it. The compact pairing dialog generates a real locally composited, high-correction QR with a small centered brand. Approval remains explicit, automatic dismissal waits for confirmed pairing, and preview permission/revoke remain in Connection settings.

`npx playwright test --config playwright.v07.config.ts` verifies Chromium, WebKit and Firefox, five viewport sizes, locale precedence, keyboard handling, QR decoding at rendered sizes, pending approval/expiry, copy, recovery and real independent controller synchronization. Public runs use `TELEO_V07_URL`; respect the existing 10 rooms/minute/IP quota and use bounded cohorts. No synthetic Cloudflare client-IP headers are sent to public Workers. [v0.7 audit and release evidence](docs/audits/TELEO_V07_BRAND_LOCALE_QR.md).

UI v0.7 was released on [teleo.cc](https://teleo.cc/studio) as release `v1.0.1`, deployed commit `186c4e7d826b73d64e62810ca70d635311354dcd`. Public post-deploy validation passed 36/36 scenarios after 22/22 staging checks. Full evidence, screenshots, limitations and rollback version are in the [v0.7 audit](docs/audits/TELEO_V07_BRAND_LOCALE_QR.md).

## Welcome onboarding (included in v1.0.2)

A genuine new, empty Studio library receives one localized **Welcome** script. Returning v1 libraries, existing/recovered/deleted scripts and handled onboarding suppress automatic insertion. Settings → Getting started preserves a persistent opt-out and explicit restore/open action; edits and saved script language remain user-controlled. [Conditions, migration, behavior, screenshots and test results](docs/features/TELEO_DEMO_ONBOARDING.md).

`npx playwright test --config playwright.welcome.config.ts` exercises fresh/legacy libraries, concurrent tabs, preferences, restoration, locale, reload and playback in Chromium and iPhone-profile WebKit. This feature is included in the v1.0.2 audit release. Current deployment identity and public verification are recorded in the audit verification report.


## v1.0.2 — Welcome and reliability audit — historical release

Published on [teleo.cc](https://teleo.cc/studio), source `ed6df817f6f53dae6ad266ee62374357a61239ef`, release tag `v1.0.2`. Public validation: **50/50 staging** and **62/62 production** scenarios. The production Worker version is `29f1cd38-6f4e-4374-8993-c3b7bfab0c20`.

The audit release preserves the approved interface and adds conflict-safe script saves/recovery, long-session replay protection, paused-position clamping, preview error handling, navigation cleanup and native transport lifecycle guards. Welcome retains first-install-only creation, all three languages, persistent opt-out and explicit restoration. User content is never translated on a UI-language change.

[Full code audit](docs/audits/TELEO_FULL_CODE_AUDIT.md) · [Verification, screenshots and deployment status](docs/audits/TELEO_FIX_VERIFICATION.md).

```sh
npx playwright test --config playwright.full-audit.config.ts
npx playwright test --config playwright.welcome.config.ts
npx playwright test --config playwright.v07.config.ts
```

Use separate browser cohorts when testing the public relay: room creation is limited to 10/minute/IP. Tests create isolated libraries and must never clear the owner's browser data. Production publication follows staging validation, a clean committed checkout and the existing interactive `npm run deploy:production` workflow. Native distribution, physical HID, native two-device LAN and CloudKit still require their separate device/signing checks.

## Reader v1.2 (included in the 1.2.0 release)

Reader typography now expands inside the playback dock and reserves space for the active text. On phones the minimal dock keeps Play/Pause visible; expand it for typography, timeline, paragraph controls, mirrors and countdown. Speed actions use exact 0.1× steps within 0.5–3.0×; valid legacy speeds and presets retain their actual values until explicitly adjusted. Paired remote typography and queued speed actions remain host-authoritative.

Cross-engine verification: `npx playwright test --config playwright.reader.config.ts` (installed Chromium, WebKit and Firefox). See [original local Reader verification and screenshots](docs/audits/TELEO_READER_UI_VERIFICATION.md). The subsequent authorized 1.2.0 publication is recorded below.

## v1.2.0 — initial Reader and Logitech R400 publication

Published on [Teleo.cc](https://teleo.cc/studio) on 2026-10-28 from source `9494aeafb766e352d3ffb54604860f66779d017f`. Production Worker version: `d32f4a4f-5ac8-4462-bf8c-cb9915697a9c`. Includes the Reader v1.2 improvements above and the R400 preset below. Scripts and existing preferences retain their storage; no migration or GitHub push. [Checks, screenshots, publication identity and hardware limitations](docs/audits/LOGITECH_R400_VERIFICATION.md).

## Logitech R400 keyboard preset

Reading settings → Physical remote → Profile → Logitech R400. Period toggles Play/Pause. PageUp/PageDown step speed while playing and scroll by rendered lines while paused. F5 enters Reader DOM fullscreen; native Escape exit is never converted to playback or Reader exit. Enable/disable and selection use existing local settings. No USB discovery, driver or Bluetooth requirement. [Current behavior and physical checklist](docs/LOGITECH_R400_SUPPORT.md) · [Original release record](docs/audits/LOGITECH_R400_VERIFICATION.md).

## LIVE update — phone preview permission and context-aware R400 arrows

Published on [Teleo.cc](https://teleo.cc/studio) on 2026-10-28 from corrected source `0396bba0b01cf5dc743aecfc8fdece4e1d8063b4`, Worker version `ccdbbb4c-40e5-432a-89fe-62ab11645b85`. The existing preview permission is in the QR/connection dialog, with a saved privacy-safe choice, immediate revocation and reuse of the relay's session/epoch authorization. Reopening connection settings preserves the active remote. R400 arrows change speed while playing and scroll by rendered lines on pause, with bounded native repeats and interruption cleanup. Firefox preview follow also reconciles font reflow. Approved v1.2 screens and user scripts are preserved. No GitHub push or storage migration. [Feature implementation](docs/audits/TELEO_REMOTE_PERMISSIONS_R400_CONTEXT.md) · [Correction, final public checks and screenshots](docs/audits/TELEO_PREVIEW_FOLLOW_FIX.md).


## Previous publication — approved controls and remote scrolling

Published on [Teleo.cc](https://teleo.cc/studio) from source `b0e1d33390f343516a7a4804bf2e2d7801fade27`, production Worker `58b4993f-f74c-45b7-b50d-e84af332e8ed` at 100% traffic. This release removes playback controls from Editor, adds the approved desktop/iPad Reading toolbar, separates Settings and Appearance popovers, places Welcome restoration in Library and adds folder hover/focus trash. The existing phone UI and top remote button are preserved; phone scrubbing and text scrolling synchronize continuous reading position. Public staging **9/9**, production functional **9/9**, route/header cohorts **2/2**, and served asset hashes **4/4** passed. No GitHub push or storage migration. [Publication evidence, live screenshots, rollback and device limitations](docs/audits/TELEO_APPROVED_V3_PUBLICATION.md).


## Current publication — Welcome and smooth remote reading

Published on [Teleo.cc](https://teleo.cc/studio) from `e4fcb251df3b6ffdf238bedf76dd03d1b07f857c`, Worker `ef94d8b5-ae38-4b60-934f-eb4fa7b3c8ba` at 100% traffic. Includes pristine Welcome localization, playback dock hide/show with a separate top Pause, script-row trash, language/themes in Settings, fixed 18 pt remote text and smooth guide-aligned scrolling. Pre-release staging found a message-budget issue; the final source removes duplicate position packets and bounds seeks to 5/s without changing server limits. Final checks: unit **34/34**, local browsers **21/21**, public staging **21/21**, public production **21/21**, route/header cohorts **2/2**, served assets **4/4**. [Publication evidence, live screenshots, rollback and device limitations](docs/audits/TELEO_READING_POLISH_PUBLICATION.md).


## Library panel — 2026-10-30

Published on [Teleo.cc](https://teleo.cc/studio) from source `7d3089ad06b433e56d92b686ab5d9a3f5e4c7047`, Worker `52224e49-4a54-452a-acaf-d512ae9182a7` at 100% traffic. Only the library panel was restyled to the approved dark reference: adjacent creation buttons, unfilled folders, document overflow menus, pinned trash and import/Open last actions. The editor, reader, header and remote design are preserved. Trash supports safe restoration and confirmed permanent deletion with the existing storage format. Local unit tests **172/172**, library browser checks **14/14** locally, **14/14** on staging and **14/14** on production; public routes/identity **2/2**. [Implementation, screenshots, validation and rollback](docs/audits/TELEO_LIBRARY_PANEL_2026-10-30.md).


Library interaction correction: live source `656eb9c4cacdc9495b2b7ad2b2d7103717cfe787`, Worker `77b38620-e412-4b94-ab91-2521963e4ffa` at 100% traffic. All folders now collapses the folder group, with no Welcome menu. Direct Rename/Trash buttons appear at the right edge of folder/document rows and remain keyboard/touch accessible. Script renaming preserves current text and selection. Public staging and production library checks each passed **20/20**. [Correction details and release evidence](docs/audits/TELEO_LIBRARY_PANEL_2026-10-30.md#follow-up-row-actions-and-folder-disclosure).
