import { serveApplication, type WebEnv } from "../web-worker";
export { Room } from "../web-worker";
/** Separate deployment/DO namespace. Never route this worker onto teleo.cc. */
export default {
  fetch(request: Request, env: WebEnv): Promise<Response> {
    return serveApplication(request, env, new URL(request.url).origin, true);
  },
} satisfies ExportedHandler<WebEnv>;
