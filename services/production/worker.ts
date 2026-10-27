import { serveApplication, type WebEnv } from "../web-worker";
export { Room } from "../web-worker";
interface ProductionEnv extends WebEnv {
  APP_ORIGIN: string;
  RELEASE_COMMIT?: string;
  DEPLOYMENT?: { id: string };
}
export default {
  async fetch(request: Request, env: ProductionEnv): Promise<Response> {
    const url = new URL(request.url);
    const canonical = new URL(env.APP_ORIGIN);
    // Only the configured production hostname (and its explicit www alias) serves this app.
    if (
      url.hostname !== canonical.hostname &&
      !(canonical.hostname === "teleo.cc" && url.hostname === "www.teleo.cc")
    )
      return new Response("Unknown host", { status: 404 });
    if (url.origin !== canonical.origin) {
      canonical.pathname = url.pathname;
      canonical.search = url.search;
      return Response.redirect(canonical.href, 308);
    }
    const response = await serveApplication(
      request,
      env,
      canonical.origin,
      false,
    );
    // WebSocket upgrade responses must retain their socket and status 101 unchanged.
    if (response.status === 101) return response;
    const headers = new Headers(response.headers);
    if (env.RELEASE_COMMIT) headers.set("X-Teleo-Commit", env.RELEASE_COMMIT);
    if (env.DEPLOYMENT?.id)
      headers.set("X-Teleo-Deployment", env.DEPLOYMENT.id);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
} satisfies ExportedHandler<ProductionEnv>;
