import { beforeEach, describe, expect, it, vi } from "vitest";
const { relayFetch } = vi.hoisted(() => ({ relayFetch: vi.fn() }));
vi.mock("../services/remote-relay/worker", () => ({
  default: { fetch: relayFetch },
  Room: class {},
}));
import production from "../services/production/worker";
import staging from "../services/staging/worker";
const assetFetch = vi.fn(
  async () => new Response("app", { headers: { "X-Robots-Tag": "noindex" } }),
);
const env = {
  APP_ORIGIN: "https://teleo.cc",
  RELEASE_COMMIT: "a".repeat(40),
  DEPLOYMENT: { id: "release-id" },
  ASSETS: { fetch: assetFetch },
  ROOMS: {},
} as unknown as Parameters<typeof production.fetch>[1];
beforeEach(() => {
  vi.clearAllMocks();
  relayFetch.mockResolvedValue(new Response("api", { status: 403 }));
});
describe("production boundary", () => {
  it("redirects www and plain HTTP to the exact HTTPS canonical host without an open redirect", async () => {
    for (const url of [
      "https://www.teleo.cc/studio?lang=ru",
      "http://teleo.cc/remote?lang=en",
      "https://www.teleo.cc//evil.example/path",
    ]) {
      const response = await production.fetch(new Request(url), env);
      const destination = new URL(response.headers.get("location")!);
      expect(response.status).toBe(308);
      expect(destination.origin).toBe("https://teleo.cc");
      expect(destination.pathname).toBe(new URL(url).pathname);
      expect(destination.search).toBe(new URL(url).search);
    }
    expect(assetFetch).not.toHaveBeenCalled();
    expect(relayFetch).not.toHaveBeenCalled();
  });
  it("rejects unrelated hosts even when forwarded headers claim the canonical origin", async () => {
    const response = await production.fetch(
      new Request("https://evil.example/studio", {
        headers: { "X-Forwarded-Host": "teleo.cc" },
      }),
      env,
    );
    expect(response.status).toBe(404);
    expect(assetFetch).not.toHaveBeenCalled();
    expect(relayFetch).not.toHaveBeenCalled();
  });
  it("routes API requests only to the relay with the configured exact production Origin", async () => {
    const request = new Request("https://teleo.cc/api/rooms", {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        "X-Forwarded-Host": "evil.example",
      },
    });
    expect((await production.fetch(request, env)).status).toBe(403);
    expect(relayFetch).toHaveBeenCalledWith(request, {
      ROOMS: env.ROOMS,
      ALLOWED_ORIGINS: "https://teleo.cc",
    });
    expect(assetFetch).not.toHaveBeenCalled();
  });
  it("serves indexable production assets with strict CSP and verifiable release metadata", async () => {
    const response = await production.fetch(
      new Request("https://teleo.cc/studio"),
      env,
    );
    expect(await response.text()).toBe("app");
    expect(response.headers.get("x-robots-tag")).toBeNull();
    expect(response.headers.get("content-security-policy")).toContain(
      "connect-src 'self';",
    );
    expect(response.headers.get("content-security-policy")).not.toMatch(
      /localhost|127\.0\.0\.1|api\.teleo/,
    );
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    // Voice follow needs the microphone on teleo.cc itself (never for embeds);
    // "microphone=()" made Safari refuse speech recognition in production.
    expect(response.headers.get("permissions-policy")).toBe(
      "camera=(), microphone=(self), geolocation=()",
    );
    expect(response.headers.get("x-teleo-commit")).toBe(env.RELEASE_COMMIT);
    expect(response.headers.get("x-teleo-deployment")).toBe("release-id");
    const sw = await production.fetch(
      new Request("https://teleo.cc/sw.js"),
      env,
    );
    expect(sw.headers.get("cache-control")).toBe("no-cache");
  });
  it("retains the WebSocket upgrade response and its socket", async () => {
    const upgrade = { status: 101, webSocket: {} } as unknown as Response;
    relayFetch.mockResolvedValueOnce(upgrade);
    expect(
      await production.fetch(
        new Request("https://teleo.cc/api/rooms/test"),
        env,
      ),
    ).toBe(upgrade);
  });
  it("keeps staging noindex and its actual request origin, independently of production", async () => {
    const response = await staging.fetch(
      new Request("https://staging.example/studio"),
      env,
    );
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const request = new Request("https://staging.example/api/rooms", {
      method: "POST",
    });
    await staging.fetch(request, env);
    expect(relayFetch).toHaveBeenLastCalledWith(request, {
      ROOMS: env.ROOMS,
      ALLOWED_ORIGINS: "https://staging.example",
    });
  });
});
