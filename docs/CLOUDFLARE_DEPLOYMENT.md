# Cloudflare deployment — staging live, production not deployed

The owner already owns `teleo.cc` at Cloudflare Registrar. No registration, transfer, purchase or production DNS mutation has occurred. The isolated staging Worker was deployed after explicit owner approval; the production site is not deployed. The GitHub source remote is configured; this does not grant Cloudflare access. All commands below are for an owner-authorized deployment, not instructions that were executed against production.

Local prerequisites: Node 24+, `npm ci`, `npm run dev`, `npm run relay`. Vite proxies same-origin `/api` to port 8787. Another phone cannot reach 127.0.0.1; use approved HTTPS staging hosting for physical-browser validation. Do not expose a plaintext dev session as production.

1. Owner authenticates Wrangler locally (`npx wrangler login`), chooses account, reviews account plan and Durable Object SQLite availability/quotas. No hardcoded account ID, tokens, DNS zone or real credentials belong in source.
2. Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`. Unit/relay suite takes about 121 seconds because invitation expiry is real.
3. Review `services/remote-relay/wrangler.jsonc`: ROOMS Durable Object binding, v1 SQLite migration, strict ALLOWED_ORIGINS. For production remove localhost origins; include only `https://teleo.cc` and explicitly approved staging origin. Configure Worker custom domain `api.teleo.cc` in the owner's account.
4. Deploy relay **only with owner approval**: `npx wrangler deploy --config services/remote-relay/wrangler.jsonc`. This creates Cloudflare resources and may incur usage charges. Review current [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) before approval; no paid-plan necessity is assumed here.
5. Set build-time `VITE_RELAY_URL=https://api.teleo.cc`, then rebuild. The relay must return CORS headers for this exact production origin; code includes this and denies others. Set custom domain `teleo.cc` on the static Worker using `wrangler.jsonc`. Deploy static assets only after approval (`npx wrangler deploy`). The static Worker uses SPA navigation fallback for all required deep links; `/remote#pair=` remains intact.
6. Verify HTTPS certificate, DNS/Worker routing, Origin/CORS/WSS upgrade, two real browsers, approval, pause/speed/ACK, expiry/replay/revoke, relay outage, permissions and service-worker upgrade/offline behavior. Do not claim production success from local tests. Configure Cloudflare edge rate rules to supplement per-IP application limits.

Static `apps/web/public/_headers` sets security headers when supported by the selected hosting path. Confirm actual response headers after deployment. No download/store route is offered because signed releases and store URLs are unavailable.


## Isolated phone-test staging Worker

`services/staging/wrangler.jsonc` deploys **teleo-staging** only on the account's workers.dev hostname. It declares no custom domains, zones or routes and does not change teleo.cc/api.teleo.cc/DNS. The separate Worker has its own ROOMS Durable Object namespace. The staging entry reuses the tested relay implementation rather than maintaining a second protocol. Web assets, /api and WSS live on the same origin, so QR links work on a phone without an API hostname override.

All asset requests run through the wrapper to set noindex/nofollow, no-referrer, nosniff, DENY, a self-only CSP and disabled camera/microphone/geolocation policy. API requests are allowed only when Origin exactly equals the request's own origin; forwarded/Origin headers cannot choose the trusted hostname. Unknown /api paths never fall back to index.html. This is a publicly reachable test app, not access-controlled hosting; use disposable test scripts and keep pairing invitations private. Library content remains browser-local. It consumes Cloudflare account quotas; no plan purchase/upgrade is authorized.

```sh
npm run staging:check   # typecheck, same-origin production build, Wrangler dry-run; NO publication
npm run staging:local   # local combined Worker at http://127.0.0.1:8788
npm run test:staging    # desktop/mobile route/header/Origin/real pairing checks locally
```

`build:staging` explicitly clears VITE_RELAY_URL at build time, so a local .env or shell override cannot accidentally embed the production relay in staging. The generated dist and dry-run bundles are ignored by Git. Staging is HTTP locally; only the actual workers.dev deployment proves public HTTPS/WSS.

After explicit owner approval, run `npx wrangler login` through the owner's browser. Check `npx wrangler whoami` and confirm the account. Before publishing, check existing deployments for teleo-staging; do not overwrite an unrelated Worker with that name. Then:

```sh
npm run staging:check
WRANGLER_SEND_METRICS=false npx wrangler deploy --config services/staging/wrangler.jsonc
TELEO_STAGING_URL=https://teleo-staging.ACCOUNT-SUBDOMAIN.workers.dev npm run test:staging
```

The public check configuration uses only the given staging URL and does not start local servers. It consumes about eight room creations; wait at least a minute between repeated public runs so the real per-IP creation limit is respected. Do not disable production rate limits to make tests pass. Actual hostname comes from successful Wrangler output; the example is not a verified URL.

Physical checklist: on Mac open staging /studio, write a disposable script, Read → Connect phone; scan QR with iPhone camera; confirm Allow on Mac; verify Play/Pause, speed/paragraph, Revoke and a brief phone network interruption. Refreshing either tab requires a fresh invitation. Record exact phone/browser versions and network behavior; mobile viewport emulation is not physical iPhone proof.

To suspend the test service, stop using/close both tabs and request removal of the staging deployment through the owner's account. Do not run blanket Worker deletion or remove Durable Object namespaces without checking ownership/retention. Production release remains a separate approval.


## Verified staging deployment record — 2026-10-26

- URL: https://teleo-staging.your-subdomain.workers.dev
- Worker: teleo-staging; separate ROOMS namespace + ASSETS binding.
- Cloudflare version: 7d54f434-75e8-4995-a291-5769f7e20ab9.
- Published application/configuration source checkpoint: Git commit 5b59588.
- Owner explicitly approved OAuth login and staging publication in chat. The account preflight showed one account and no existing teleo-staging Worker (API code 10007).
- Executed: `WRANGLER_SEND_METRICS=false npx wrangler deploy --config services/staging/wrangler.jsonc` — succeeded, returned the URL/version above.
- Public verification: `TELEO_STAGING_URL=https://teleo-staging.your-subdomain.workers.dev npm run test:staging` — **8 passed**, 15.8 seconds. Assets/security/strict Origin/API routing and two independent browser contexts exercised real HTTPS/WSS pairing, Play/Pause, ACK and revoke in EN/UK/RU on desktop/mobile viewports.
- Local full Playwright suite: **46 passed**, 42.8 seconds. Dry-run/typecheck/lint passed.
- Public tests never forge CF-Connecting-IP; synthetic per-client addresses are only for local emulator isolation. An initial public harness attempt was rejected by Cloudflare because it forwarded local test headers; the harness was corrected, with no security setting changes.
- teleo.cc and api.teleo.cc custom DNS/routes were not changed. No production site was published. No plan upgrade or purchase was made. Physical iPhone/Safari is **not tested**; use the checklist above.

### Current staging revision

The medium-width empty-library fix was redeployed to the same URL. Current Cloudflare version: **50366211-227f-4a80-879a-af4607c22dae**. Published application source: **31f4a8d**. Final public verification: **10/10 passed**, 17.1 seconds, including the new medium-width layout checks. Final local suite: **48/48 passed**, 42.6 seconds. Production domains/DNS remain unchanged.

### Physical iPhone report — 2026-10-26

The owner tested the public staging on a real iPhone and confirmed successful browser-remote connection and correct operation of all controller buttons. This is owner-reported acceptance; model, iOS/browser versions and network details were not supplied. Physical interruption/reconnect, background/sleep, native LAN, HID and CloudKit are not covered by that report. See QA_REPORT for the recorded evidence and remaining manual checks.
