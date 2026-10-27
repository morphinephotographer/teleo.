import relay, { type Room } from "./remote-relay/worker";
export { Room } from "./remote-relay/worker";
export interface WebEnv {
  ASSETS: Fetcher;
  ROOMS: DurableObjectNamespace<Room>;
}
/** Shared app/relay boundary. Trust deployment configuration, never forwarded headers. */
export async function serveApplication(
  request: Request,
  env: WebEnv,
  origin: string,
  noIndex: boolean,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api" || url.pathname.startsWith("/api/"))
    return relay.fetch(request, { ROOMS: env.ROOMS, ALLOWED_ORIGINS: origin });
  const response = await env.ASSETS.fetch(request);
  const headers = new Headers(response.headers);
  if (noIndex) headers.set("X-Robots-Tag", "noindex, nofollow");
  else headers.delete("X-Robots-Tag");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  );
  if (url.pathname === "/sw.js") headers.set("Cache-Control", "no-cache");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
