# Teleo 1.4.1 — larger reading font

Published to https://teleo.cc on 6 November 2026 with the owner's instruction
«опубликуй на сайт и проведи ещё тесты».

- Source: `1e4feb36502022547733693e79633374cfe36238`.
- Base: current production `456ff50ec320375629dd3f60b91ae90ddd5888d9` (1.4.0).
- Cloudflare version: `96d3e641-9740-4e4d-9fce-929d33b003c0`.
- Previous version for rollback: `28f7c9e0-5036-4789-9673-d367b21121d2`.

The font-size range increases from 16–100 to 16–120 in desktop/mobile reading,
remote settings, authenticated control validation, portable import and Apple
preferences. Existing saved sizes and the default remain unchanged. Package
version is 1.4.1. Dependencies, routes and Durable Object migrations are unchanged.

The release was prepared in `/private/tmp/teleo-font-release-20261106` from the
current public GitHub commit. The older main workspace contains unrelated,
uncommitted onboarding work, which was not copied into this release. The
onboarding and other features already published in 1.4.0 were preserved.

## Validation

- Typecheck, lint, production build, diff check and Cloudflare dry-run passed.
- 216 unit tests passed across 22 files, excluding the relay runtime suite.
- Five selected real relay tests passed, including typography forwarding,
  authoritative ACK metadata and invalid control-state rejection.
- The initial full Vitest run stalled without completion and was stopped; a
  complete 242-test success is **not** claimed. The 21 unselected relay cases
  were skipped in the focused rerun, including long expiry/recovery cases.
- Six focused browser tests passed locally against the production Worker build.
- The same six tests passed on public teleo.cc: desktop Chromium, iPad WebKit and
  iPhone WebKit; font 120 rendering and persistence, orientation, fullscreen
  control, and real approved HTTPS/WSS remote changes in both directions.
- Two public route/security/Origin/release-identity checks passed in Chromium
  and WebKit. All four public HTML/CSS/JS/service-worker hashes matched `dist`,
  with the expected source and deployment headers.
- Cloudflare readback confirmed the new version receiving 100% of traffic.

Browser profiles are emulated devices, not physical iPad/iPhone testing.
The fullscreen check exercises the existing fullscreen control and verifies font
rendering; it does not assert native fullscreen support on iOS.

The source change includes a new Swift portable-font roundtrip/bounds test.
The corresponding source/core tests were also checked in the original workspace
before publication (15 Swift tests passed); no signed native-app release is made.

Repeat the focused browser checks with:

```sh
TELEO_FONT_URL=https://teleo.cc npx playwright test --config playwright.font-release.config.ts
```

Evidence: `test-results/font-release/`, `test-results/production/`, and
`test-results/font-publication/assets.json` in the isolated release checkout.
