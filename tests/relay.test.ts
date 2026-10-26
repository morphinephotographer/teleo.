import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { build } from "esbuild";
let mf: Miniflare;
const origin = "http://127.0.0.1:5173";
type Message = {
  type: string;
  id?: string;
  command?: unknown;
  state?: unknown;
};
class Peer {
  ws: WebSocket;
  messages: Message[] = [];
  closed = false;
  constructor(ws: unknown) {
    this.ws = ws as WebSocket;
    (this.ws as WebSocket & { accept(): void }).accept();
    this.ws.addEventListener("message", (e) =>
      this.messages.push(JSON.parse(String(e.data))),
    );
    this.ws.addEventListener("close", () => {
      this.closed = true;
    });
  }
  send(data: unknown) {
    this.ws.send(JSON.stringify(data));
  }
  async next(type: string) {
    for (let i = 0; i < 100; i++) {
      const index = this.messages.findIndex((x) => x.type === type);
      if (index >= 0) return this.messages.splice(index, 1)[0];
      await new Promise((r) => setTimeout(r, 10));
    }
    throw Error(`No ${type} received`);
  }
  async waitClosed() {
    for (let i = 0; i < 100; i++) {
      if (this.closed) return;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw Error("Socket not closed");
  }
}
async function create() {
  const response = await mf.dispatchFetch("http://local/api/rooms", {
    method: "POST",
    headers: { Origin: origin, "CF-Connecting-IP": crypto.randomUUID() },
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  return response.json() as Promise<{
    id: string;
    host: string;
    invite: string;
  }>;
}
async function peer(id: string, token: string) {
  const r = await mf.dispatchFetch("http://local/api/rooms/" + id, {
    headers: { Origin: origin, Upgrade: "websocket" },
  });
  expect(r.status).toBe(101);
  const p = new Peer(r.webSocket);
  p.send({ type: "auth", token });
  return p;
}
async function session() {
  const room = await create();
  const host = await peer(room.id, room.host);
  await host.next("waiting");
  const phone = await peer(room.id, room.invite);
  await host.next("approval");
  await phone.next("waiting");
  return { room, host, phone };
}
beforeAll(async () => {
  const result = await build({
    entryPoints: ["services/remote-relay/worker.ts"],
    bundle: true,
    format: "esm",
    write: false,
    external: ["cloudflare:workers"],
  });
  mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: "relay",
          modules: true,
          script: result.outputFiles[0].text,
          compatibilityDate: "2026-10-01",
          durableObjects: { ROOMS: { className: "Room", useSQLite: true } },
          bindings: { ALLOWED_ORIGINS: origin },
        },
      ],
    }),
  );
  await mf.ready;
});
afterAll(async () => {
  await mf?.dispose();
});
describe("real Durable Object runtime", () => {
  it("rejects missing/foreign Origin and wrong routes", async () => {
    expect(
      (await mf.dispatchFetch("http://local/api/rooms", { method: "POST" }))
        .status,
    ).toBe(403);
    expect(
      (
        await mf.dispatchFetch("http://local/api/rooms", {
          method: "POST",
          headers: { Origin: "https://evil.example" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await mf.dispatchFetch("http://local/no", {
          headers: { Origin: origin },
        })
      ).status,
    ).toBe(404);
  });
  it("approval, ACK, replay suppression and hibernation restore", async () => {
    const { room, host, phone } = await session();
    host.send({ type: "allow" });
    await host.next("connected");
    await phone.next("connected");
    await mf.unsafeEvictDurableObject("relay", "Room", {
      id: room.id,
      webSockets: "hibernate",
    });
    const id = crypto.randomUUID();
    phone.send({ type: "command", id, command: { action: "play" } });
    expect((await host.next("command")).id).toBe(id);
    host.send({
      type: "ack",
      id,
      state: { playing: true, speed: 1, position: 0 },
    });
    expect((await phone.next("ack")).id).toBe(id);
    phone.send({ type: "command", id, command: { action: "togglePlay" } });
    await new Promise((r) => setTimeout(r, 60));
    expect(host.messages.some((x) => x.type === "command")).toBe(false);
    await mf.unsafeEvictDurableObject("relay", "Room", {
      id: room.id,
      webSockets: "hibernate",
    });
    host.send({ type: "revoke" });
    await phone.waitClosed();
  });
  it("one invitation admits exactly one simultaneous controller", async () => {
    const room = await create();
    const host = await peer(room.id, room.host);
    await host.next("waiting");
    const responses = await Promise.all(
      [0, 1].map(() =>
        mf.dispatchFetch("http://local/api/rooms/" + room.id, {
          headers: { Origin: origin, Upgrade: "websocket" },
        }),
      ),
    );
    const peers = responses.map((r) => new Peer(r.webSocket));
    for (const p of peers) p.send({ type: "auth", token: room.invite });
    await host.next("approval");
    for (let i = 0; i < 100 && !peers.some((p) => p.closed); i++)
      await new Promise((r) => setTimeout(r, 10));
    expect(peers.filter((p) => p.closed)).toHaveLength(1);
    expect(host.messages.filter((m) => m.type === "approval")).toHaveLength(0);
    const winner = peers.find((p) => !p.closed)!;
    await winner.next("waiting");
    host.send({ type: "allow" });
    await winner.next("connected");
    host.send({ type: "revoke" });
  });
  it("denies and invalidates invitation permanently", async () => {
    const { room, host, phone } = await session();
    host.send({ type: "deny" });
    await phone.waitClosed();
    const response = await mf.dispatchFetch(
      "http://local/api/rooms/" + room.id,
      { headers: { Origin: origin, Upgrade: "websocket" } },
    );
    expect(response.status).toBe(410);
  });
  it("does not revoke authenticated host when invalid outsider closes", async () => {
    const room = await create();
    const host = await peer(room.id, room.host);
    await host.next("waiting");
    const attacker = await peer(room.id, "0".repeat(64));
    await attacker.waitClosed();
    host.send({ type: "ping" });
    await host.next("pong");
    host.send({ type: "revoke" });
  });
  it("never sends content-bearing commands, rejects invalid role and preapproval", async () => {
    const { host, phone } = await session();
    phone.send({
      type: "command",
      id: crypto.randomUUID(),
      command: { action: "play", body: "private text" },
    });
    await phone.waitClosed();
    expect(host.messages.some((x) => x.type === "command")).toBe(false);
  });
  it("rejects stale ACK and closes session", async () => {
    const { host, phone } = await session();
    host.send({ type: "allow" });
    await phone.next("connected");
    host.send({
      type: "ack",
      id: crypto.randomUUID(),
      state: { playing: false, speed: 1, position: 0 },
    });
    await host.waitClosed();
  });
  it("limits messages and creation rate", async () => {
    const room = await create();
    const host = await peer(room.id, room.host);
    await host.next("waiting");
    for (let i = 0; i < 25; i++) host.send({ type: "ping" });
    await host.waitClosed();
    let status = 0;
    for (let i = 0; i < 11; i++) {
      status = (
        await mf.dispatchFetch("http://local/api/rooms", {
          method: "POST",
          headers: { Origin: origin, "CF-Connecting-IP": "test-limit" },
        })
      ).status;
    }
    expect(status).toBe(429);
  });
  it("expires real one-use invitations after 120 seconds", async () => {
    const room = await create();
    const host = await peer(room.id, room.host);
    await host.next("waiting");
    await new Promise((r) => setTimeout(r, 120100));
    await host.waitClosed();
    const r = await mf.dispatchFetch("http://local/api/rooms/" + room.id, {
      headers: { Origin: origin, Upgrade: "websocket" },
    });
    expect(r.status).toBe(410);
  }, 125000);
});
