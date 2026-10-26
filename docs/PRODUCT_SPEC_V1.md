# CODEX MASTER TASK — teleo. v1.0 (Web + native iPhone + native Mac)

**Date:** 2026-10-26
**Revision:** 1.1 — mandatory three-language website localization
**Language of implementation instructions / technical docs:** English
**Product:** **teleo.** (lowercase, trailing period)
**Tagline:** *Your words. Your pace.*
**Official domain:** `teleo.cc` — already purchased at Cloudflare Registrar by the product owner
**Priority platforms:** fully functional multilingual web teleprompter (EN / UK / RU), native iPhone app, native macOS app
**Out of scope:** Android (do not design or implement Android support now)

## 0. Mission, execution rules and expected outcome

Build a real, maintainable, testable teleprompter product, **not screenshots, a generic landing page, a WebView-wrapped iPhone app, or a collection of unfinished stubs**. Reuse any viable existing teleo. implementation, especially the prior web v0.2 specification and source. The iPhone and Mac apps must be native SwiftUI applications with a shared Swift core where appropriate, not two completely unrelated codebases. Prioritize excellent reading and scroll quality, reliable script storage, iCloud sync between the native apps, and real remote-control behavior.

Read this entire task before editing. Work autonomously through the phases in §15. If a requested feature cannot be verified or a credential/capability is missing, still complete independently testable work, provide a reproducible setup path, and report the exact blocker. Do **not** claim that signed-device CloudKit sync, hardware Bluetooth, domain deployment, App Store distribution, or real cross-device remote pairing works without evidence.

**Scope resolution:** The original teleo. was designed as a full web product. It remains a full web product. `teleo.cc` is **not just a download/marketing site**. The native iPhone and Mac apps are additional first-class clients. The entire website must support English, Ukrainian and Russian; this does not automatically expand native app localization scope. At v1.0, iCloud sync is required **between the two native Apple apps**, not automatically between native and the browser. Browser scripts remain locally stored unless the user explicitly imports or exports them. Never imply a single universal cloud library without implementing it.

**Features NOT requested for v1.0:** login/accounts for teleo., payment/subscriptions, AI, speech-follow/autoscroll, embedded video recording, public script sharing, native Android app. Do not create inert UI for these features.

## 1. Repository safety and initial reconnaissance (mandatory)

1. Print current working directory, relevant top-level files, Git branch/status and remotes. Confirm this is an existing teleo. project or an empty dedicated workspace. Never alter CHRONO, Gallery Drop, Morphine Gallery, Stay Awake, or any unrelated repositories.
2. If the current directory belongs to an unrelated project, **stop modifying it** and report the safest way to create/open a new teleo. workspace. If the workspace is empty, initialize a dedicated teleo. repository. If teleo. files exist, inspect them before choosing a stack.
3. Search for the original artifacts: `teleo_product_spec_v0.2.md`, `CODEX_TELEO_V0.2_TASK.md`, `docs/TELEO_PRODUCT_SPEC_V0.2.md`, and any UI reference files. Respect their existing UX requirements, except where this master task intentionally supersedes them. If they are absent, **this task is self-contained**; do not claim to have read missing files.
4. Preserve all uncommitted user changes. Use a separate branch, for example `codex/teleo-native-web-v1`. Never run destructive clean/reset or force-push; do not replace usable code unnecessarily. No user data deletion, no secrets in Git.
5. Inspect installed Xcode, simulator destinations, SDKs, Node tooling and any Cloudflare Wrangler config. Choose deployment targets based on available SDKs and document the minimum supported OS versions; don't silently require an unreleased or unavailable API.
6. Keep implementation reproducible on a Mac. Commit implementation and docs locally. Push only when a suitable remote is already configured and the push is authorized; report the exact remote, branch and commit, or explicitly state that nothing was pushed. Do not deploy, purchase services, change production DNS, or request Apple/Cloudflare credentials without user approval.

## 2. Product UI / visual system

**Brand:** `teleo.` always lowercase with the final period. Tagline: `Your words. Your pace.`

**Design direction:** elegant, minimalist, Apple-like, editorial, fast, focused. Existing approved mockups/references are design direction, not permission to sacrifice UX or functionality. Use restrained typography and spacing, avoid visual overload.

Design tokens initially aligned with earlier web spec:
- UI background `#FFFFFF`, secondary surface `#F5F5F7`, primary text `#111114`.
- Accent `#4C7DFF` (tasteful, not everywhere).
- Prompter background `#09090B`, reading text `#F5F5F5`.
- Accessible contrast, visible focus states and minimum comfortable touch targets.

**Shared information architecture:** Library → Editor → Prompter/Reading Mode → Settings → Remote Control → Help. Use platform-native navigation patterns: macOS sidebar, resizable editor/preview panes and separate full-screen reading window; iPhone compact library/editor with distraction-free immersive reader and accessible controls. No decorative or dead controls.

## 3. Canonical script data and offline-first model

Define a **versioned, portable logical model** shared semantically across platforms. Swift and TypeScript implementations may be separate; coordinate schema through a documented JSON import/export contract and conformance fixtures rather than forcing unsafe code sharing between languages.

Minimum fields:
- `scriptId` (stable UUID), `title`, `body` (Unicode text; line breaks retained), `createdAt`, `updatedAt`, optional `folderId`.
- Per-script reading preferences: `speed`, `fontSize`, `lineHeight`, `textWidth`, `alignment`, `mirrorHorizontal`, `mirrorVertical`, `focusLine`, `countdownSeconds`, appearance.
- Local save/dirty indicators; stable navigation/scroll position per script **locally per device** (do not sync volatile in-progress playback state).
- `ScriptRevision`: immutable revision ID, script ID, timestamp, body/title snapshot or compact delta, device/source identifier if safely available; bounded retention and storage-budget policy.
- Folder model with stable ID and safe rename/delete behavior. Prefer simple UUID references over complicated bidirectional SwiftData relationships if they introduce CloudKit schema incompatibility.
- Explicit soft-delete/tombstone or comparable safe deletion strategy, so disconnected devices do not accidentally resurrect deleted scripts. Define cleanup policy.

Autosave must be debounced but never discard pending edits on navigation/backgrounding; handle foreground interruptions and recovery. Preserve Unicode, emoji, RTL where reasonable, very long texts, line breaks, and empty scripts. Use explicit safe migrations (no destructive migration). Do not claim full concurrent-merge support until verified.

### Native storage and iCloud sync — required

- Use a persistent SwiftData store with a CloudKit-compatible schema when the toolchain/OS targets support it. Both app targets must use the **same intended CloudKit container identifier**, their own proper signing/entitlements, iCloud capability and the required background modes. Do not invent a real Team ID or container credentials. Document exact Xcode capability setup.
- Prefer private CloudKit database (one user's iCloud account) with no custom Teleo login. Sync scripts, folders, user-selected reading settings, and recoverable revision data between iPhone and Mac. Local work must continue without internet or a signed-in iCloud account.
- **Important:** SwiftData/CloudKit sync is eventual, can be delayed, and doesn't give a reliable per-record `upload completed` guarantee through a simple UI flag. Distinguish `Saved on this device` from `iCloud available`, `Sync pending/unknown`, and reliably observed remote changes. Never falsely mark a script as fully cloud-synced on a local save alone.
- CloudKit-compatible model constraints and migrations must be reviewed against current Apple docs. Avoid assuming uniqueness constraints, required relationships, or arbitrary schema changes are supported by the mirroring layer.
- Preserve a way to recover overwritten content by writing immutable revision snapshots at meaningful edit checkpoints, **not every keystroke**. Document conflict resolution. If both devices edit offline, never silently assert that no edits can be lost; demonstrate conflict detection or at minimum recoverable independent revisions and a clear UI. Add restore version flow.
- Handle iCloud unavailable/account changes/quota failures without wiping previously saved local scripts. Provide export/recovery paths and user-readable error states. Real two-device sync validation requires signed apps, configured entitlements and physical/suitable test devices: if unavailable, mark as **not verified**, not passed.
- Web IndexedDB and native CloudKit libraries are **separate** in v1.0. Implement explicit `.txt` import/export everywhere and a portable versioned JSON export/import where feasible for manual migration; do not build a new account backend just to unify browser and native data.

## 4. Professional teleprompter playback — P0 on every client

- Smooth **time-based** scrolling independent of display refresh rate: web uses `requestAnimationFrame` with elapsed-time updates; native apps use an appropriate display-driven update source plus a shared elapsed-time playback model. Bound elapsed delta on app pause/resume/background; never jump forward after sleep. Playback timing must not depend on the number of rendered frames.
- Commands: Play, Pause, explicit Set Playing, Restart, Faster, Slower, Set Speed, Previous/Next paragraph, Scroll Step, Seek when appropriate. Playback commands must be idempotent where appropriate; remote duplicate packets must not double-toggle.
- Speed UI: initial 0.5×–3.0× range with predictable increment/preset behavior. Internally document the calibrated physical scroll rate (e.g. points/sec) so the same setting feels reasonable on different devices and font sizes; no guarantee of identical pixel speed at different screen dimensions.
- Adjustable text font size, line height, reader width, alignment, focus/reading guide, dark reader, optional light reader, mirror horizontally **reading content only** (not UI controls), optional vertical mirror, countdown Off/3/5/10 s.
- Full-screen reading on macOS; immersive reading on iPhone using supported native APIs. Reader controls auto-hide when appropriate; taps/keyboard/remote can bring them back. Keep a predictable way to exit reader.
- Pause/resume must hold position. Manual scroll must have a defined playback policy; reaching script end stops cleanly. Editing script while paused/playing must not unpredictably jump or crash.
- Keep screen awake during active reading using platform-supported power-management APIs, and reliably release assertions on stop/background/dismissal. No permanent screen-awake side effects.
- No built-in camera/video recording, speech tracking, or cloud playback transport for v1.0.

## 5. One logical command model, several input adapters

Implement a **single well-tested command/state domain contract**, mirrored between Swift and TypeScript clients. Each host app owns authoritative playback state. All UI buttons, keyboard shortcuts, Bluetooth HID commands and phone-remote messages are normalized and validated before calling their platform's command dispatcher. Never simulate user clicks or maintain parallel remote-only playback logic.

Suggested actions (typed and allowlisted): `play`, `pause`, `togglePlay`, `restart`, `speedUp`, `speedDown`, `setSpeed`, `previousParagraph`, `nextParagraph`, `scrollBack`, `scrollForward`. Include request IDs for network messages, deduplicate/reject replay, emit acknowledged playback state and redact script content.

Different implementations across Swift and web are allowed, but commands, limits, semantics, tests and documentation must agree.

## 6. Third-party Bluetooth remotes — P0 on iPhone, Mac and web

Support popular Bluetooth **HID keyboard-like** presentation clickers/teleprompter controllers and pedals **when the OS delivers their key events**. Users pair in system Bluetooth settings. Do **not** promise app-level enumeration, battery percentage, a `Connected to Bluetooth Remote` status, or support for every branded BLE clicker. Media/volume keys often get consumed by the OS and may be undetectable or inappropriate for app control. A proprietary BLE GATT remote needs a separately documented and tested per-device adapter; do not build fake generic BLE scanning.

Required UX in `Settings > Remote Control > Physical Remote`:
- Profiles `Standard`, `Two-button`, `Custom`.
- Standard default mapping: Space Play/Pause; Up/Down speed; Left/Right paragraph; `R` restart; `M` horizontal mirror, only when app/reader context allows.
- Two-button workflow: `Learn Button A` and `Learn Button B`; map to Play/Pause and speed preset cycle by default; presets `[0.75, 1.0, 1.25, 1.5, 2.0]` adjustable; allow custom actions.
- Test mode: show the **actual key/scan-like event the app receives** when permitted, or state `No usable key event detected` with clear system-pairing/troubleshooting advice. Distinguish physical remote recognition from an ordinary keyboard; do not invent device names.
- Custom mapping: capture a hardware key, assign action, show conflicts, reset, enable/disable, persist per-device/app profile locally. Scope profile to an app instance/user preference, not an unverified hardware identifier.
- Do not hijack typing, IME/composition, rename fields, dialogs, system shortcuts, secure text, or accessibility navigation. Ignore or carefully throttle repeat events. Do not intercept keyboard events globally when Teleo is inactive.

Platform specifics:
- **macOS:** support app-focused keyboard events using native SwiftUI/AppKit where justified. No global key logger, accessibility permission, or privileged event tap just for remotes.
- **iOS:** use SwiftUI hardware keyboard `onKeyPress` when focus semantics allow, or carefully scoped UIKit responder/`UIKeyCommand` bridging if necessary. Physical keyboard/HID event delivery, focus and system-reserved keys vary across devices; test on physical iPhone. Do not claim full button-learning success from Simulator-only testing.
- **Web:** receive HID remotes through standard browser keyboard events; **do not require Web Bluetooth GATT**. Feature-detect and document iPhone Safari limitations. Capture `event.code`/`event.key` with safe normalization and focus-aware behavior.

Every adapter must call the same validated domain dispatcher. Include simulated key-event automated tests **and** a distinct manual hardware compatibility matrix with Passed/Failed/Not tested states.

## 7. iPhone as remote control for Mac — native local connection (P0)

Implement a real native flow in which an iPhone running Teleo can control a Mac running Teleo **over the local network**, without iCloud or public internet. Use Apple's **Network.framework** with Bonjour service discovery and an authenticated, encrypted host/controller session. Do not start a new implementation using the deprecated MultipeerConnectivity framework (Xcode 27+). Choose supported Network APIs for the selected OS deployment targets.

Flow:
1. Mac opens the reader and explicitly enables `Allow iPhone Remote`.
2. iPhone opens `Remote > Find Nearby Mac` and discovers nearby Teleo hosts over local network; offer QR/invitation handoff if needed to ensure secure session binding.
3. Mac visibly approves/denies control. Enrollment must use a cryptographically strong ephemeral pairing capability; a six-digit code alone must **not** be the sole authenticator.
4. After approval, iPhone shows large Play/Pause, Speed +/−, Previous/Next, Restart, and a reliable status indicator. Mac owns playback state and sends ACK/state updates without transmitting scripts, titles, or private content.
5. Revoke immediately terminates authorization; disconnect/reconnect/host backgrounding/display sleep clearly change status. Loss of connectivity must not stop local playback or lose text.
6. Respect macOS firewall and iOS `NSLocalNetworkUsageDescription` and Bonjour service entitlements/`NSBonjourServices` where applicable; document permission UX.

Security: encryption and authenticated peer binding, host confirmation, per-session authorization, strict command validation and limits, request IDs/duplicate suppression, expiration, replay defenses, no text payloads, no raw tokens in logs. Do not claim secure pairing if you only implemented plaintext TCP on a LAN; in that case report an unshippable blocker and keep local prompter working.

Do not use CloudKit as a low-latency remote-control transport. Do not assume two devices are on the same LAN just because they share the same iCloud account. Internet-based remote between native devices is **not required** for v1.0.

## 8. Web application on teleo.cc — full product, not a landing-only page (P0)

Preserve/build the earlier complete teleo. browser product:
- `/` — elegant Home with `teleo.` wordmark, tagline, honest working preview and launch button.
- `/studio` — library, editor, live prompter preview, reading settings, full-screen/immersive reading, keyboard/remote setup.
- `/remote` — smartphone browser-based controller paired to a browser host by QR.
- `/help`, `/privacy` — accurate guides and statements reflecting actual implementation.
- No fake account, pricing, share, AI, or recording features.

Web scripts: IndexedDB local autosave, create/rename/duplicate/delete/search, `.txt` import/export, refresh persistence, error/recovery UI. Use responsive layouts. Fullscreen must feature-detect; provide immersive fallback for iPhone Safari. Wake Lock only when supported. Keyboard events are active only in valid reading contexts; never intercept normal text editing.

If no prior stack exists, use React + TypeScript + Vite, typed modules, Vitest and Playwright. If an earlier working stack exists, do not rewrite it solely to follow this suggestion. Respect existing v0.2 UI references when present.

### Website localization — P0: English, Ukrainian and Russian

The **entire `teleo.cc` website**, not merely its landing page, must offer **three complete UI languages**:
- **English** (`en`) — English;
- **Ukrainian** (`uk`) — Українська;
- **Russian** (`ru`) — Русский.

Requirements:
1. Add an accessible, discoverable language switcher (e.g. `EN · УКР · RU`) in the global site navigation, and ensure it is also accessible from compact/mobile UI and the Studio/remote experience. Display language names in their own language; do not replace selection with emoji flags.
2. On first visit, detect the user's preferred language from browser language preferences (`navigator.languages` / `navigator.language`) when it matches `en`, `uk` or `ru`, including regional variants such as `uk-UA` and `ru-RU`; otherwise default to **English**. Manual choice always overrides automatic detection. Persist manual selection locally (for example `localStorage`) and restore it after refresh. If browser storage is unavailable, the switcher must still work for the current session.
3. Language changes must apply immediately **without losing the current script, the cursor/selection, unsaved text, playback position, pairing session, or open workspace**, and without forcing navigation away from the current task. Persist state independently of localized UI. Changing UI locale must not change the user's scripts or their reading language.
4. Localize **all** interface text: navigation, landing page, Studio, library, editor chrome, prompter settings, physical remote learning/settings, pairing approval, `/remote` controller, help/FAQ, privacy page, empty states, import/export prompts, buttons, tooltips, notifications, errors, validation, permission guidance, reconnect/offline states, onboarding, `aria-label`s and screen-reader announcements. No half-translated screens or raw translation keys.
5. Implement maintainable structured translation dictionaries (e.g. `apps/web/src/i18n/{en,uk,ru}.json` with typed keys), consistent placeholders/plurals via `Intl` or a vetted i18n library, locale-aware date/number formatting where relevant, and **English fallback at individual missing-key level** with test-time warnings. Avoid duplicated hard-coded strings and concatenation of translated fragments that break grammar.
6. Set `<html lang>` correctly for the active language, update localized document titles/descriptions and other user-facing metadata. For public SEO pages, choose and document a consistent indexable locale-URL/canonical/`hreflang` strategy without breaking the previously required paths `/`, `/studio`, `/remote`, `/help`, `/privacy` or existing QR links. Any language query parameter is non-secret: **keep the one-time pairing token in the URL fragment**, not the query string or analytics.
7. Preserve the non-localized product brand **`teleo.`** (lowercase, trailing period) and keep the established English tagline as the source copy; provide natural localized marketing prose where displayed, rather than mechanically translating product naming. Translation content must read naturally in Ukrainian and Russian and fit mobile layouts (avoid clipped buttons or navigation).
8. Never auto-translate, alter, or send user-entered script bodies/titles to an external translation service. Do not add Google Translate widgets or paid translation APIs. Bundle UI translations with the application so they remain available offline.
9. Scope clarification: **mandatory multilingual support applies to the website/web client only** in this task. Native iOS/macOS localization is a separate future decision; do not silently add it to the critical path or claim it is implemented.

Acceptance examples: a fresh browser configured for Ukrainian opens the website in Ukrainian; manually switching to Russian changes *all* UI strings; refreshing retains Russian; switching to English while editing does not alter the text or disrupt playback; the `/remote` pairing UI and error messages appear in the selected locale; all three languages are functional in mobile layouts and without network access after assets are cached.

### Browser-hosted phone remote via QR (P0)

Preserve/build the earlier v0.2 QR flow: host `Connect phone` → 120-second one-time cryptographically strong (>=128-bit entropy) invitation → phone opens `https://teleo.cc/remote#pair=<token>` → host Allow/Deny → live controller via WSS → host ACK → Revoke/Disconnect. One active remote per host initially. No script text or title goes through relay.

Use a real stateful relay with schema/role/session validation, one-use/expiry/revocation, Origin allowlist, rate limits, heartbeat, stale ACK protection, bounded reconnect, no secret logging. Preserve client function if relay is unavailable. Design and integration-test the real host/controller handshake, not a mockup.

**Cloudflare-specific correction:** For Cloudflare hosting, prefer Workers static assets (or Pages if already established) for the site, and a Worker + **Durable Object with WebSocket Hibernation** for the stateful relay. A plain static site or ordinary stateless request handler is insufficient for a robust coordinated remote session. Hibernation clears ordinary in-memory JS instance state; session-critical short-lived state must be recovered safely from Durable Object state / connection attachments with strict TTL and revocation behavior. Design/test this, don't just port an in-memory Node.js `ws` implementation to Workers and assume it works.

If existing `apps/server` Node WebSocket service already works, preserve it as a local reference if appropriate. Architect or adapt Cloudflare production relay separately and prove protocol conformance in tests. Do not maintain two inconsistent security/command implementations.

**Scope boundary:** Native iPhone→Mac LAN control and browser→phone WSS remote are **two transports** with one coherent command semantics contract. A native iPhone controlling a browser tab (or a browser phone controlling native Mac) is *not* required at v1.0 unless it is independently implemented and tested. Do not claim universal interoperability.

## 9. Cloudflare domain and deployment plan

The domain `teleo.cc` is owned by the user in **Cloudflare Registrar**. Do not buy/register/transfer it and do not infer that you have account access or deploy permissions.

Proposed URL structure:
- `https://teleo.cc/` — main website.
- `https://teleo.cc/studio` — usable browser prompter.
- `https://teleo.cc/remote` — secure browser controller.
- `https://teleo.cc/help` and `/privacy` — documentation and privacy.
- `https://teleo.cc/download` — **only** if real download/store links are available; otherwise no fake download CTA.
- `https://api.teleo.cc` — if needed for production WSS relay; this is **not** an API for storing native iCloud scripts.

Prepare Cloudflare configuration (`wrangler.jsonc` / equivalent), DNS/deployment documentation, env example without secrets, script for local development, routing and fallback. Don't write real credentials into source, don't change live DNS automatically, and don't claim SSL/DNS/deployment is active without verifying it. Explain any payment/plan prerequisites if discovered.

## 10. Suggested repository shape (adapt to existing code)

```text
teleo/
├── apps/
│   ├── web/                        # Responsive web app, real /studio
│   │   └── src/
│   │       ├── scripts/            # IndexedDB, library, editing, import/export
│   │       ├── prompter/           # Web renderer + time-based engine
│   │       ├── remote/             # Keyboard mapping, QR phone client
│   │       └── ui/                 # Visual tokens/components
│   └── apple/
│       ├── Teleo.xcodeproj         # Native targets: Teleo iOS + Teleo macOS
│       ├── TeleoiOS/              # iPhone UI/bridges
│       ├── TeleomacOS/            # Mac UI/bridges
│       ├── TeleoCore/             # Swift package: model, commands, scroll math
│       ├── TeleoStorage/          # SwiftData persistence, CloudKit configuration
│       ├── TeleoRemotes/          # HID, key learning, Network.framework LAN link
│       └── Tests/                 # Swift Testing/XCTest/UI tests
├── services/
│   └── remote-relay/               # Cloudflare Worker + Durable Object, WebSockets
├── packages/
│   └── protocol/                   # Shared TS schemas/fixtures/JSON contract
├── contracts/                      # Cross-implementation canonical JSON cases
├── docs/
│   ├── PRODUCT_SPEC_V1.md
│   ├── WEB_LOCALIZATION.md
│   ├── ARCHITECTURE.md
│   ├── DATA_AND_ICLOUD.md
│   ├── REMOTES_AND_PAIRING.md
│   ├── SECURITY.md
│   ├── CLOUDFLARE_DEPLOYMENT.md
│   ├── QA_REPORT.md
│   └── DECISIONS.md
├── README.md
└── .gitignore
```

Use sensible module/target names consistent with Xcode conventions; the diagram is an architectural guide, not a request to create meaningless empty folders. SwiftData belongs only in Apple clients, IndexedDB only in web. Cloudflare is not the native script database. Keep rendering/input/platform-specific code out of domain logic. Include an explicit asset strategy that does not require bundling secret/proprietary fonts.

## 11. Accessibility, privacy, robustness and visual QA

- Dynamic Type / native accessibility labels where appropriate; VoiceOver on iPhone and VoiceOver/keyboard navigation on Mac; browser semantic controls and focus.
- Screen-reader reading interfaces may need controls distinct from auto-scroll; avoid a UI that traps focus.
- macOS resizing, full screen, multiple display scaling, iPhone portrait/landscape, small-screen safe areas/notch, dark prompter and system appearance behavior.
- Avoid jarring animations in UI; support Reduce Motion for decorative animations but keep intentionally requested text scrolling available.
- Privacy: user script content in native private CloudKit only and device local stores; web scripts local; relay never receives script text or title; redact logs and error reporting. Describe Apple iCloud storage accurately in privacy documentation; **do not state that all native text always stays only on-device**.
- Safe local file import, no arbitrary code execution, limit/validate remote message payloads and high-frequency commands, handle memory of large scripts.
- Support app lifecycle events, power management cleanup, partial saves, iCloud transitions, relay disconnection and network permission denial.
- Test visually: no clipped controls, overlapping panels, invisible cursor, mirrored buttons, unintended scrollbars, mismatched layouts, unusable iPhone toolbar, giant empty panes, or obstructed text. Test all website pages in English, Ukrainian and Russian, including narrow-screen label expansion.

## 12. Test plan and acceptance criteria — mandatory

### Automated web/relay tests
1. Create/edit/rename/delete/duplicate/import/export scripts; reload persists body exactly, including line breaks.
2. Verify time-based scroll after pause/resume, background tab or long frame stall, speed change, paragraph jumps and script end.
3. HID/keyboard mapping learning, context safety (editor/input/IME/modal), duplicate key/repeat handling, profiles/presets and persistence.
4. Real end-to-end QR pairing via two independent browser contexts and a **real local relay**, host approval, remote ACK, expiry, replay, deny, revoke, wrong session, reconnect and relay outage without losing local prompter state.
5. Durable Object hibernation/resume or relevant state rehydration test; strict auth/Origin/rate-limit/payload checks.
6. Test website localization for `en`, `uk`, `ru`: complete key parity (or deliberate documented fallback), dynamic UI change, first-visit locale detection, regional locale variants, manual-override persistence after refresh, storage-disabled fallback, HTML lang/metadata, accessibility labels, all five required routes and QR remote UI, no lost edits or playback position when changing locale, and no script body translation. Run Playwright smoke/visual checks for **all three locales** on desktop and mobile sizes.
7. `typecheck`, `lint`, `unit tests`, `production build`, Playwright desktop + mobile viewport tests; report exact counts/status, don't assert success without executing.

### Automated native tests
1. Unit-test command dispatch, scroll elapsed-time math and max-delta behavior, mapping conflicts and speed presets, importer/exporter, revision snapshots, soft delete and migrations.
2. Test native SwiftData CRUD with a temporary/in-memory/local container; restart persistence tests with real on-disk store. Ensure app launch without iCloud works and no silent destructive migration.
3. Fake/mock clock, keyboard and transport inputs to validate ACK/sequence/replay/revoke/session expiration, reconnection and no script text in control messages.
4. Build both iOS and macOS targets; run unit and UI tests on available simulators. Check Swift concurrency, warnings, sandbox/entitlements and deployment targets. If a build cannot run, provide exact failure and workaround; never present skipped as passed.
5. Tests for CloudKit schema compatibility and sync state are necessary, but **do not present simulator/local mocked tests as real iCloud end-to-end proof**.

### Manual acceptance matrix (record verified vs not tested)
- iPhone device: native editor & immersive reader, real Bluetooth HID clicker, system keyboard interactions, screen wake and offline edits.
- Mac device: native editor/fullscreen reader, external HID clicker, app focus, Mac sleep behavior, resizable layout.
- iPhone + Mac with same iCloud account: create on Mac → appears on iPhone; edit on iPhone → Mac; offline divergent edits → safe recoverable revisions; deletion behavior; sign-out/unavailable iCloud recovery.
- iPhone + Mac on LAN: discover, request, approve, Play/Pause, speed, progress ACK, disconnect, revoke, local-network permission denied, offline from internet.
- Browser on Mac + phone browser: secure QR remote on a real public HTTPS/WSS URL, if deployed with approval.
- Physical accessory compatibility table: device model, OS, transport / reported input, learned actions, Passed / Failed / Not tested.

**Acceptance gate:** Never mark a P0 feature Done based on just a UI screen, TODO, mocks or a simulated successful network response. Always distinguish `Implemented`, `Automated tests passed`, `Physical/manual verification passed`, `Blocked`, `Not tested`.

## 13. Technical architecture self-review / red flags

Before writing major features, record an architecture review and justify these specific boundaries:

1. **Native vs web:** SwiftUI/AppKit/UIKit for Apple apps; independent web frontend. No WebView in place of native apps.
2. **Local vs cloud:** CloudKit is native data sync, not real-time remote messages; avoid in-memory-only data models and misleading sync badges.
3. **CloudKit limits:** schema constraints/migrations, eventual delivery, conflicts and revision retention, iCloud account transitions.
4. **Remote protocols:** native LAN Network.framework is separate from WSS Cloudflare browser pairing; common contract does not imply cross-client interoperability.
5. **Bluetooth:** HID keyboard adapters are not general BLE GATT discovery; cannot intercept OS-reserved input.
6. **Cloudflare:** registry ownership does not mean production is deployed; Durable Objects are needed for reliable stateful WebSocket coordination.
7. **Security:** one-use invite, explicit approval, encrypted network, replay prevention, no sensitive text transfer, no unverified secure pairing claims.
8. **OS support:** select feasible deployment targets based on local Xcode; do not default to APIs unavailable on the target.
9. **Future Android:** completely ignore; avoid designing extra backend/abstraction layers just for a hypothetical client.
10. **Old web baseline:** preserve original complete teleprompter and remote experience, not reduce teleo.cc to a static marketing page.
11. **Website i18n:** translate every route and every state into en/uk/ru without coupling UI locale to script text, local storage, playback or pairing, and without breaking deep links.

Write `docs/DECISIONS.md` (lightweight ADRs) with decisions and tradeoffs, plus `docs/ARCHITECTURE.md` with dependencies, ownership of states and sequence diagrams for both remote channels and sync.

## 14. Deliverables

Create or update *actual source code*, Xcode targets/project, web app, Cloudflare relay and tests. Also provide:
- `README.md`: how to run web locally, start relay, run iOS/macOS, tests, and prerequisites.
- `docs/PRODUCT_SPEC_V1.md`: current product/UX scope superseding v0.2 where necessary, including mandatory three-language website support.
- `docs/WEB_LOCALIZATION.md`: locales, translation key structure, fallbacks, language detection, persistence, routing/SEO plan and translation QA checklist.
- `docs/ARCHITECTURE.md`: module map, data flow, commands, sync and both remotes.
- `docs/DATA_AND_ICLOUD.md`: models, SwiftData/CloudKit schema, entitlement checklist, conflict/version strategy, what is and isn't actually verified.
- `docs/REMOTES_AND_PAIRING.md`: hardware mappings, iOS limitations, macOS handling, local pairing and web QR control.
- `docs/SECURITY.md`: threat model, all remote trust boundaries, key material, token TTL, revocation, logs, rate-limits.
- `docs/CLOUDFLARE_DEPLOYMENT.md`: manual binding/domain setup, secrets and build commands (do not deploy without permission).
- `docs/QA_REPORT.md`: exact commands, dates, test results, screenshots where available, device matrix, missing verifications, blockers.
- `docs/DECISIONS.md`: specific architectural tradeoffs, deviations from prior v0.2.
- `.gitignore` for Xcode derived data, user configs, node_modules, build output, secrets.

In the final Codex reply (prefer **Russian** for the user-facing summary), report:
- Functional modules delivered, with links to files/paths.
- Exact verified build/test commands and results (pass/fail/not run).
- The real status of CloudKit sign-in/sync on physical devices and remotes; no inflated claims.
- Manual steps the human owner must take: Apple signing/team/container setup, hardware Bluetooth pairing/validation, Cloudflare auth/deployment (only if needed).
- Branch and local commit hash; link to pushed commit only if push actually succeeded.
- Remaining blockers and **the very next useful task**, prioritized.

## 15. Execution phases — work end to end, keep meaningful checkpoints

Work in the following sequence. **Do not stop after planning, avoid making dozens of empty scaffold files and do not sacrifice functional checks to hit every label.** Complete as much as environment permits, save coherent checkpoints, and honestly report any incomplete phase.

**Phase A — Audit/plan (short).** Inspect repo, assets, prior spec, Git/SDKs. Write architecture decisions including source-of-truth, CloudKit feasibility, transport separation and minimum OS targets.

**Phase B — Shared domain + working reader.** Implement canonical scripts, command dispatcher, clock/scroll math, and basic native SwiftUI apps plus working web prompter. Set up web i18n dictionaries/locale provider early rather than hardcoding English strings to be replaced later. Build/test both domains early.

**Phase C — Persistence + cloud.** Web IndexedDB; Apple SwiftData offline; versioned exports/imports; revision recovery; CloudKit-compatible schema/entitlements and account-offline behavior. Run migrations and storage tests. Don't fake signing.

**Phase D — Physical remotes.** Native and web keyboard HID adapters; mapping profiles, learn/test UX, focus/IME safety, real command dispatch and automated checks.

**Phase E — Phone remote.** Native iPhone↔Mac nearby discovery, secure pairing, ACK/state and revocation; browser QR↔browser host via Cloudflare-compatible WSS relay. Validate both independently; do not pretend interoperability across them if missing.

**Phase F — Polish, robustness and documentation.** Complete and QA all three website languages (en/uk/ru) across every route, remote/pairing state, and mobile UI; implement the agreed design, visual and accessibility QA, offline errors, lifecycle/power management, Cloudflare deployment plan, reproducible builds/tests and final commit/report.

**Priority for constrained time or environment:** a thoroughly working end-to-end vertical slice of web + both native clients with persistent scripts and a verified command engine is more valuable than a visually polished but fake all-features demo. However, do not silently drop any P0 item: mark each as implemented/blocked/not tested in `docs/QA_REPORT.md` and leave explicit next steps.

## 16. Official technical references (review latest SDK-specific details)

- Apple SwiftData and iCloud sync: https://developer.apple.com/documentation/swiftdata/syncing-model-data-across-a-persons-devices
- Apple SwiftData CloudKit Database configuration: https://developer.apple.com/documentation/swiftdata/modelconfiguration/cloudkitdatabase-swift.struct
- Apple SwiftUI onKeyPress: https://developer.apple.com/documentation/swiftui/view/onkeypress%28_%3Aaction%3A%29
- Apple UIKeyCommand: https://developer.apple.com/documentation/uikit/uikeycommand
- Apple TN3213 (MultipeerConnectivity deprecation / Network framework): https://developer.apple.com/documentation/technotes/tn3213-moving-from-multipeer-connectivity-to-network-framework
- Cloudflare Durable Objects WebSocket Hibernation: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Cloudflare WebSocket Worker example: https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/
- Browser keyboard events: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent
- Browser Fullscreen support: https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API

**End of master task.**
