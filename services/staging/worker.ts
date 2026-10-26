import relay, { Room } from "../remote-relay/worker";
export { Room };
interface StagingEnv {
  ASSETS: Fetcher;
  ROOMS: DurableObjectNamespace<Room>;
}
/** Separate deployment/DO namespace. Never route this worker onto teleo.cc. */
export default {
  async fetch(request: Request, env: StagingEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      // Trust only the actual worker origin, never an Origin/Forwarded header.
      return relay.fetch(request, {
        ROOMS: env.ROOMS,
        ALLOWED_ORIGINS: url.origin,
      });
    }
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("X-Robots-Tag", "noindex, nofollow");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "no-referrer");
    headers.set("X-Frame-Options", "DENY");
    headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    );
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
} satisfies ExportedHandler<StagingEnv>;
