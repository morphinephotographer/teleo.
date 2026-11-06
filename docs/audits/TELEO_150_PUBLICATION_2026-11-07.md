# Teleo 1.5.0 publication — 7 November 2026 (Kyiv)

Authorized by the owner: «опубликуй» after the remote microphone and Quick Send work.

- URL: https://teleo.cc; Worker: teleo-web.
- Published source: 1b85a8447e0b7ca3ffc3484e10f0d8820c78028d.
- Cloudflare version: 3c7e2566-738b-4208-946f-c90aa8a6bb28, 100% traffic.
- Previous version for rollback: 96d3e641-9740-4e4d-9fce-929d33b003c0.

Includes explicit host-authorized iPhone speech source and clear Quick Send
validation guidance. The Quick Send limit remains 8,000 characters. Prior 1.4.1
features are preserved; routes, dependencies and migrations are unchanged.

Checks before publication: typecheck, lint, build, Cloudflare dry-run, 220 unit
tests and 14 focused real relay tests passed. Other relay cases were not selected.
Earlier local browser coverage is recorded in the feature documentation.

Public verification: 4 remote voice scenarios passed in Chromium/WebKit, 5 Quick
Send scenarios passed (including WebKit phone to Chromium host and three
languages), and 2 route/security/release-identity checks passed. The HTML, CSS,
JavaScript and service-worker hashes matched the local release build.

An initial public Quick Send run was blocked by a local-only forged IP header
in the test fixture (Cloudflare Error 1000). Ordinary site requests remained
healthy. The public fixture now omits that header, and all five cases passed.
This fixture-only correction does not alter the deployed application.

Speech recognition was mocked for browser tests; transport and text movement
used the real production relay. Physical iPhone audio capture, long sessions,
backgrounding, calls and actual Windows hardware still require field testing.
