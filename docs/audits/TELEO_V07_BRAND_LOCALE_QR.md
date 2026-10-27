# TELEO UI v0.7 — brand, device locale and branded QR audit

Date: 2026-10-27. Release: 1.0.1 (UI task v0.7). Feature branch: `codex/v07-brand-locale-qr`.

## Scope, baseline and confirmed causes

Read the complete supplied `TELEO_CODEX_TASK_V07.md`, package README and both reference images before edits. The first screenshot documents bugs; the second governs only circular language controls and compact QR styling. Previously approved remote playback, timeline, typography/alignment, editor, library and architecture are preserved.

The checkout was clean on `e528884678f48492246a6eb88aa85f1202058260`. No applicable AGENTS.md was found. Baseline typecheck/lint passed, 25 domain/control tests passed and three desktop wordmark animation checks passed. User data and browser libraries were not reset.

Confirmed causes:

- Host/remote wordmarks were anchors with route handlers. Intro completion explicitly focused the host anchor, exposing its rectangular browser focus outline. `Wordmark` is now plain text, without href, role, tabindex, handlers or interactive parent. Intro restores focus to a real enabled control. Existing focus-visible styles remain.
- Header language used the generic large full-name picker, while the remote kept another instance deep in settings. Locale bootstrap preferred `?lang` over saved/manual and browser preference, so host invitation hints could override the phone's device language.
- Pairing retained a large phone illustration, repeated instructions and scattered actions. Its inherited centering transform conflicted with full inset auto-height; screenshot QA caught the resulting offscreen dialog. The compact dialog now explicitly owns its size, center, internal scrolling and dark tokens.
- Pending-approval UI could survive invitation expiry or terminal transport state. It now clears pending approval and offers only valid recovery; security decisions still belong to the relay.

## Implementation and locale policy

`useLocale` chooses valid manual `teleo.locale` > first supported `navigator.languages` > `navigator.language` > `en`. Tags normalize case and primary language; unsupported entries do not prevent checking subsequent entries. Only explicit user selection persists. `languagechange` updates automatic selection; valid manual choice stays authoritative, including storage-unavailable session fallback. Cross-tab storage events are handled. Query `lang` remains informational, never bootstrap authority. The synchronous initial hook avoids an English React render followed by automatic Ukrainian/Russian. User scripts are never translated.

Shared `LanguageControl`: EN / UA / RU display, internal en / uk / ru; exactly one mounted entry in host/reader/remote/advanced view. 44px circle, centered baseline, no chevron. Existing top-layer Popover supplies selection, keyboard arrows/Home/End/typeahead, Escape/outside dismissal, viewport positioning and focus return; a styled Sheet fallback supports older non-Popover browsers. Localized accessible names and document lang use the same dictionaries. A phone's independent browser locale does not alter the host.

The QR dialog has small static brand, localized title/helper, circular close, centered QR, short status and one compact URL/open-and-copy row. No illustration or revoke inside it. Host Connection settings retain preview consent and revoke/reconnect. Manual close preserves pending invitation or established session. Automatic dismissal waits for the relay's authorized `connected` event; scan/pending approval does not dismiss.

## QR construction, payload and security

QR generation is local canvas, `qrcode` H correction, scale 4 and four-module quiet zone. A rounded white-backed black `teleo.` badge is centered at 13% of total QR width; it does not overlap finder patterns or quiet zone. Display width is 224 CSS px inside an additional white frame. Payload is the unmodified current secure invitation, including the original token strength/fragment. No short-token scheme or external QR service is introduced.

Native macOS CoreImage decodes the **final PNG including logo**, and the actual rendered image screenshot at every required viewport; decoded value must exactly equal current invitation. A pixel check verifies all four-module outer margins are opaque white. Copy is exercised through the Clipboard API boundary and compared with the current full invitation without printing it. Browser emulation is not a physical camera scan.

Relay approval, one-use 120s invite, authenticated resume, command ACK, privacy/preview consent, allowed-origin checks, public quotas and revoke remain unchanged. Local QR warns that loopback cannot reach an iPhone. Staging uses its own HTTPS origin. Production must emit exactly `https://teleo.cc/remote…`, with capability in the fragment. Session secrets remain memory-only: a full phone-page reload keeps manual locale but needs a new invitation; ordinary transport reconnection still resumes within the established recovery window.

## Verification record

- Full Vitest: **82/82, 9 files, 152.65s**; includes actual invitation TTL, one-use/security and reconnect behavior. Updated domain assertions additionally pass with control tests: **25/25**.
- Typecheck, ESLint, build and production dry-run: PASS before release gates; final records below.
- New focused Chromium/WebKit/Firefox matrix: **33/33** on the initial completed run; final strengthened run recorded below.
- Existing full desktop/mobile regression: initial expected legacy assertions were updated to explicit device preference, inert branding and absent language chevron. Only the two approved remote snapshots changed, solely for the new header circle. No golden snapshot threshold was relaxed.
- Native desktop Safari: private isolated local window, complete wordmark visible, clicking it leaves Studio unchanged, circle opens styled three-option menu, Escape returns and Tab reaches a real control. Screenshot `v07-native-safari-focus.png`. The private QA window was closed; personal tabs/data were not modified.

Visual matrix: 1440×900, 1280×800, 834×1112, 390×844 and 375×667. Capture closed/open locale, keyboard focus and QR in all three automated browsers; remote and advanced settings captures included. Artifacts are `docs/screenshots/v07-…png`, public staging `v07-staging-…png`, production `v07-production-…png`. Historical screenshots from earlier releases are retained unmodified.

## Changed files

Product: `apps/web/src/{Wordmark.tsx,LanguageControl.tsx,useLocale.ts,main.tsx,RemoteController.tsx,menus.tsx,ui.tsx,qr.ts,i18n.ts,style.css}`. Package release metadata: `package.json`, `package-lock.json`.

QA: `playwright.v07.config.ts`, `tests/e2e/v07.spec.ts`, additional domain cases; existing translated E2E fixtures, QR/connection locators and two remote image baselines adapted to the new explicit requirements. Documentation: README, WEB_LOCALIZATION, this audit; new v0.7 evidence screenshots. No changes to Worker protocol/storage schema/DNS/production custom domains.

## Rollback and deployment gates

Before this release, production `teleo-web` served code `1c3d9f3608b95b129de5015afc6491b96acd18c3` / tag `v1.0.0`, Cloudflare version `31201bd5-0a8a-437c-8079-781a3b144e54`, deployment `271d26c0-6fe7-49a0-90de-cb9c4d3d0ae9`. Staging previous version `0deb1e24-1e6d-49c1-a7dd-9fd28987f422`. Version inventory was saved outside Git before edits. Existing staging/production Durable Object namespaces remain separate and unchanged.

Workflow: final local gates → committed feature → existing staging deploy → public staging QR/real relay verification → normal PR merge → clean committed production pipeline with `RELEASE_COMMIT` → public post-deploy smoke. Production rollback: `npx wrangler rollback 31201bd5-0a8a-437c-8079-781a3b144e54 --config wrangler.jsonc`; retain the namespace/data and route configuration. User explicitly authorized the existing staging-to-production workflow for this task.

## Limitations

Physical iPhone camera scan of **this new branded QR**: **NOT RUN** (no direct physical device test). Prior owner confirmations predate v0.7 and are not claimed as new evidence. Real iOS VoiceOver/Taptic hardware behavior and native speaker copy review remain manual. Automated WebKit is listed separately from the actual desktop Safari inspection. No Apple Developer Team is needed for browser pairing; native distribution remains outside this UI patch.

## Final gate and deployment results

Local release gates PASS:

| Command | Result |
| --- | --- |
| `npm run typecheck`, `npm run lint` | PASS |
| `npm test` | 82/82; 152.65s |
| `npx vitest run tests/domain.test.ts tests/control.test.ts` | 25/25 after additional locale assertions |
| `npm run production:check` | PASS; build + actual Cloudflare dry-run, no publication |
| `npm run test:e2e` | 156/156; 3.4m; desktop/mobile |
| `npx playwright test --config playwright.approved.config.ts` | 32/32; 47.7s; Chromium/WebKit |
| `npx playwright test --config playwright.production.config.ts` | 32/32; 43.0s; local production Worker, desktop Chromium/WebKit, iPhone/iPad profiles |
| `npx playwright test --config playwright.v07.config.ts` | 33/33; 20.9s; Chromium/WebKit/Firefox, strengthened QR/copy/expiry checks |

Additional real-playback wordmark assertion: **3/3 PASS, 10.2s** across Chromium/WebKit/Firefox; clicking the host wordmark leaves active scrolling, URL and history intact. Public staging/production verification will be recorded below; no public success is claimed at this checkpoint.


Staging first pass: 21/22 scenarios passed, including both real pairing flows and final composite/rendered QR decoding. The remaining WebKit artificial network-error assertion was not intercepted because its request passed through the production Service Worker. The focused fixture now blocks Service Workers specifically for deterministic fault injection; the separate existing offline/SW suite continues to test real service-worker behavior. A final header audit also added explicit right alignment on Help/Privacy, with route assertions. Both fixes require another local focused gate and staging deployment before production.

Final Help/Privacy alignment and deterministic fault fixture: typecheck/lint PASS, **33/33 PASS in 22.7s** across Chromium/WebKit/Firefox.


### Public staging gate — PASS

Final candidate `dae64831b468640c429f603d6400330c64f18667` published through the existing staging config. Cloudflare version **`a1860272-8875-44be-8f6d-ae0426863cab`** at `https://teleo-staging.your-subdomain.workers.dev`.

`TELEO_V07_URL=https://teleo-staging.your-subdomain.workers.dev npx playwright test --config playwright.v07.config.ts --project=v07-chromium --project=v07-webkit --workers=1`: **22/22 PASS, 43.2s**. Both final branded QR PNGs and rendered images at all five sizes decode to the exact current staging invitation; independent Ukrainian phone locale, host English, explicit approval, copy, playback, logo click during playback, revoke, manual dismissal and expiry/retry are exercised over public HTTPS/WSS. No synthetic CF client header, DNS override or disabled TLS checks. Compact dialog and public remote screenshots inspected. Artifacts: `docs/screenshots/v07-staging-*.png`.

The earlier artificial-error fixture issue is resolved. Production is still the previous working version at this checkpoint; proceeding only after this passed gate. Staging's first candidate version `8c959bfe-a30a-4323-950f-45b1a3461b13` was superseded by the final candidate above.
