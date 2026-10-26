# Cloudflare deployment (prepared, NOT deployed)

The owner already owns `teleo.cc` at Cloudflare Registrar. No registration, transfer, purchase, DNS mutation, credential request or deployment has occurred. No remote is configured in Git. All commands below are for an owner-authorized deployment, not instructions that were executed against production.

Local prerequisites: Node 24+, `npm ci`, `npm run dev`, `npm run relay`. Vite proxies same-origin `/api` to port 8787. Another phone cannot reach 127.0.0.1; use approved HTTPS staging hosting for physical-browser validation. Do not expose a plaintext dev session as production.

1. Owner authenticates Wrangler locally (`npx wrangler login`), chooses account, reviews account plan and Durable Object SQLite availability/quotas. No hardcoded account ID, tokens, DNS zone or real credentials belong in source.
2. Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`. Unit/relay suite takes about 121 seconds because invitation expiry is real.
3. Review `services/remote-relay/wrangler.jsonc`: ROOMS Durable Object binding, v1 SQLite migration, strict ALLOWED_ORIGINS. For production remove localhost origins; include only `https://teleo.cc` and explicitly approved staging origin. Configure Worker custom domain `api.teleo.cc` in the owner's account.
4. Deploy relay **only with owner approval**: `npx wrangler deploy --config services/remote-relay/wrangler.jsonc`. This creates Cloudflare resources and may incur usage charges. Review current [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) before approval; no paid-plan necessity is assumed here.
5. Set build-time `VITE_RELAY_URL=https://api.teleo.cc`, then rebuild. The relay must return CORS headers for this exact production origin; code includes this and denies others. Set custom domain `teleo.cc` on the static Worker using `wrangler.jsonc`. Deploy static assets only after approval (`npx wrangler deploy`). The static Worker uses SPA navigation fallback for all required deep links; `/remote#pair=` remains intact.
6. Verify HTTPS certificate, DNS/Worker routing, Origin/CORS/WSS upgrade, two real browsers, approval, pause/speed/ACK, expiry/replay/revoke, relay outage, permissions and service-worker upgrade/offline behavior. Do not claim production success from local tests. Configure Cloudflare edge rate rules to supplement per-IP application limits.

Static `apps/web/public/_headers` sets security headers when supported by the selected hosting path. Confirm actual response headers after deployment. No download/store route is offered because signed releases and store URLs are unavailable.
