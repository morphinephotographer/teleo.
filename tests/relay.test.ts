import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
let mf: Miniflare;
let persistence: string;
let runtimeOptions: ConstructorParameters<typeof Miniflare>[0];
const origin = "http://127.0.0.1:5173";
type Message = {
  type: string;
  id?: string;
  command?: unknown;
  state?: unknown;
  sequence?: number;
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
const resumeKey = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
async function peer(
  id: string,
  token: string,
  resume = resumeKey(),
  resuming = false,
) {
  const r = await mf.dispatchFetch("http://local/api/rooms/" + id, {
    headers: { Origin: origin, Upgrade: "websocket" },
  });
  expect(r.status).toBe(101);
  const p = new Peer(r.webSocket);
  p.send(
    resuming ? { type: "resume", token } : { type: "auth", token, resume },
  );
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
  persistence = await mkdtemp(join(tmpdir(), "teleo-relay-restart-"));
  runtimeOptions = {
    ...convertV4MiniflareOptions({
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
    resourcePersistencePath: persistence,
  };
  mf = new Miniflare(runtimeOptions);
  await mf.ready;
});
afterAll(async () => {
  await mf?.dispose();
  if (persistence) await rm(persistence, { recursive: true, force: true });
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
    for (const p of peers)
      p.send({ type: "auth", token: room.invite, resume: resumeKey() });
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

describe("bounded authorized reconnect", () => {
  it("resumes controller after hibernation; preserves replay ledger and asks for fresh state", async () => {
    const room = await create(),
      hostKey = resumeKey(),
      phoneKey = resumeKey();
    const host = await peer(room.id, room.host, hostKey);
    await host.next("waiting");
    const phone = await peer(room.id, room.invite, phoneKey);
    await host.next("approval");
    await phone.next("waiting");
    host.send({ type: "allow" });
    await host.next("connected");
    await phone.next("connected");
    await host.next("stateRequest");
    const id = crypto.randomUUID();
    phone.send({ type: "command", id, command: { action: "togglePlay" } });
    await host.next("command");
    phone.ws.close(1001, "Test network loss");
    await host.next("reconnecting");
    await mf.unsafeEvictDurableObject("relay", "Room", {
      id: room.id,
      webSockets: "hibernate",
    });
    const resumed = await peer(room.id, phoneKey, resumeKey(), true);
    await resumed.next("connected");
    await host.next("stateRequest");
    // A delayed pre-disconnect ACK is ignored; a new numeric snapshot supersedes it.
    host.send({
      type: "ack",
      id,
      state: { playing: false, speed: 1, position: 0 },
    });
    host.send({
      type: "state",
      state: { playing: true, speed: 1.5, position: 42 },
    });
    expect((await resumed.next("state")).state).toEqual({
      playing: true,
      speed: 1.5,
      position: 42,
    });
    resumed.send({ type: "command", id, command: { action: "togglePlay" } });
    await new Promise((r) => setTimeout(r, 50));
    expect(host.messages.some((m) => m.type === "command")).toBe(false);
    resumed.send({ type: "revoke" });
    await host.waitClosed();
  });
  it("can replace a stale host socket without its late close revoking the new host", async () => {
    const room = await create(),
      hostKey = resumeKey();
    const host = await peer(room.id, room.host, hostKey);
    await host.next("waiting");
    const phone = await peer(room.id, room.invite);
    await host.next("approval");
    host.send({ type: "allow" });
    await phone.next("connected");
    const resumed = await peer(room.id, hostKey, resumeKey(), true);
    await resumed.next("connected");
    await host.waitClosed();
    resumed.send({ type: "ping" });
    await resumed.next("pong");
    phone.send({
      type: "command",
      id: crypto.randomUUID(),
      command: { action: "pause" },
    });
    expect((await resumed.next("command")).command).toEqual({
      action: "pause",
    });
    resumed.send({ type: "revoke" });
  });
  it("rejects invite replay, wrong resume key, and resume before approval", async () => {
    const room = await create(),
      hostKey = resumeKey();
    const host = await peer(room.id, room.host, hostKey);
    await host.next("waiting");
    const unapproved = await peer(room.id, hostKey, resumeKey(), true);
    await unapproved.waitClosed();
    host.send({ type: "ping" });
    await host.next("pong");
    const phone = await peer(room.id, room.invite);
    await host.next("approval");
    host.send({ type: "allow" });
    await phone.next("connected");
    const attacker = await peer(room.id, room.invite);
    await attacker.waitClosed();
    const wrong = await peer(room.id, resumeKey(), resumeKey(), true);
    await wrong.waitClosed();
    host.send({ type: "ping" });
    await host.next("pong");
    host.send({ type: "revoke" });
  });
  it("revocation while a peer is offline invalidates its resume key", async () => {
    const room = await create(),
      key = resumeKey();
    const host = await peer(room.id, room.host);
    await host.next("waiting");
    const phone = await peer(room.id, room.invite, key);
    await host.next("approval");
    host.send({ type: "allow" });
    await phone.next("connected");
    phone.ws.close(1001, "Network loss");
    await host.next("reconnecting");
    host.send({ type: "revoke" });
    await host.waitClosed();
    const response = await mf.dispatchFetch(
      "http://local/api/rooms/" + room.id,
      { headers: { Origin: origin, Upgrade: "websocket" } },
    );
    expect(response.status).toBe(410);
  });
  it("expires the real 30-second recovery window and rejects the saved capability", async () => {
    const room = await create();
    const host = await peer(room.id, room.host);
    await host.next("waiting");
    const phone = await peer(room.id, room.invite);
    await host.next("approval");
    host.send({ type: "allow" });
    await phone.next("connected");
    phone.ws.close(1001, "Network loss");
    await host.next("reconnecting");
    await new Promise((r) => setTimeout(r, 30100));
    await host.waitClosed();
    expect(
      (
        await mf.dispatchFetch("http://local/api/rooms/" + room.id, {
          headers: { Origin: origin, Upgrade: "websocket" },
        })
      ).status,
    ).toBe(410);
  }, 35000);
});

it("resumes both peers after a real runtime restart using durable hashes and deadlines", async () => {
  const room = await create(),
    hostKey = resumeKey(),
    phoneKey = resumeKey();
  const host = await peer(room.id, room.host, hostKey);
  await host.next("waiting");
  const phone = await peer(room.id, room.invite, phoneKey);
  await host.next("approval");
  host.send({ type: "allow" });
  await phone.next("connected");
  await mf.dispose();
  mf = new Miniflare(runtimeOptions);
  await mf.ready;
  const resumedHost = await peer(room.id, hostKey, resumeKey(), true);
  await resumedHost.next("authenticated");
  const resumedPhone = await peer(room.id, phoneKey, resumeKey(), true);
  await resumedPhone.next("connected");
  await resumedHost.next("connected");
  const id = crypto.randomUUID();
  resumedPhone.send({ type: "command", id, command: { action: "pause" } });
  expect((await resumedHost.next("command")).id).toBe(id);
  resumedHost.send({
    type: "ack",
    id,
    state: { playing: false, speed: 1, position: 17 },
  });
  expect((await resumedPhone.next("ack")).state).toEqual({
    playing: false,
    speed: 1,
    position: 17,
  });
  resumedHost.send({ type: "revoke" });
}, 20000);
