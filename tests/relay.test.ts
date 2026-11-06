import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { build } from "esbuild";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
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
    unsafeInspectDurableObjects: true,
  };
  mf = new Miniflare(runtimeOptions);
  await mf.ready;
});
afterAll(async () => {
  await mf?.dispose();
  if (persistence) await rm(persistence, { recursive: true, force: true });
});
describe("real Durable Object runtime", () => {
  it("accepts over 1000 commands without forgetting earlier replay IDs", async () => {
    const { host, phone } = await session();
    host.send({ type: "allow" });
    await phone.next("connected");
    const first = crypto.randomUUID();
    for (let i = 0; i < 1005; i++) {
      const id = i === 0 ? first : crypto.randomUUID();
      phone.send({ type: "command", id, command: { action: "pause" } });
      expect((await host.next("command")).id).toBe(id);
      host.send({
        type: "ack",
        id,
        state: { playing: false, speed: 1, position: i },
      });
      expect((await phone.next("ack")).id).toBe(id);
      await new Promise((r) => setTimeout(r, 55));
    }
    phone.send({ type: "command", id: first, command: { action: "play" } });
    phone.send({ type: "ping" });
    await phone.next("pong");
    expect(host.messages.filter((m) => m.type === "command")).toEqual([]);
    expect(phone.closed).toBe(false);
    host.send({ type: "revoke" });
  }, 100000);

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

describe("permission-scoped ephemeral text preview", () => {
  const content = (
    epoch: number,
    text = "PRIVATE_BODY_ONLY_FOR_THE_AUTHORIZED_PHONE",
  ) => ({
    type: "previewContent",
    version: 1,
    epoch,
    script: {
      id: crypto.randomUUID(),
      revision: "b".repeat(64),
      title: "PRIVATE_TITLE_DO_NOT_STORE",
    },
    index: 0,
    total: 1,
    text,
  });
  async function approved() {
    const s = await session();
    s.host.send({ type: "allow" });
    await s.host.next("connected");
    await s.phone.next("connected");
    await s.host.next("stateRequest");
    await s.host.next("previewPermission");
    await s.phone.next("previewPermission");
    return s;
  }
  async function grant(host: Peer, phone: Peer, allowed = true) {
    host.send({ type: "previewPermission", version: 1, allowed });
    await host.next("previewPermission");
    return (await phone.next("previewPermission")) as unknown as {
      epoch: number;
      allowed: boolean;
    };
  }
  it("defaults off, requires host consent, forwards bounded content and never stores body/title", async () => {
    const { host, phone } = await approved();
    phone.send({ type: "previewRequest", version: 1 });
    expect(
      (
        (await phone.next("previewPermission")) as unknown as {
          allowed: boolean;
        }
      ).allowed,
    ).toBe(false);
    host.send(content(0));
    await new Promise((r) => setTimeout(r, 50));
    expect(phone.messages.some((m) => m.type === "previewContent")).toBe(false);
    const permission = await grant(host, phone);
    const packet = content(
      permission.epoch,
      "PRIVATE_TEXT_MARKER_".repeat(100),
    );
    host.send(packet);
    expect(
      ((await phone.next("previewContent")) as unknown as { text: string })
        .text,
    ).toBe(packet.text);
    const values: string[] = [];
    for (const file of await readdir(persistence, { recursive: true })) {
      if (!file.endsWith(".sqlite")) continue;
      const db = new DatabaseSync(join(persistence, file), { readOnly: true });
      try {
        const tables = db
          .prepare("SELECT name FROM sqlite_master WHERE type='table'")
          .all();
        for (const table of tables) {
          const query = db.prepare(
            'SELECT * FROM "' + String(table.name).replaceAll('"', '""') + '"',
          );
          query.setReadBigInts(true);
          const rows = query.all();
          for (const row of rows)
            for (const value of Object.values(row)) {
              if (
                value &&
                typeof value === "object" &&
                ArrayBuffer.isView(value)
              ) {
                const bytes = Buffer.from(
                  value.buffer,
                  value.byteOffset,
                  value.byteLength,
                );
                values.push(bytes.toString("utf8"), bytes.toString("utf16le"));
              } else values.push(String(value));
            }
        }
      } finally {
        db.close();
      }
    }
    expect(values.join(" ")).not.toContain(packet.text);
    expect(values.join(" ")).not.toContain(packet.script.title);
    host.send({ type: "revoke" });
    await phone.waitClosed();
  });
  it("rejects controller permission escalation and controller-authored text", async () => {
    for (const payload of [
      { type: "previewPermission", version: 1, allowed: true },
      content(1),
    ]) {
      const { host, phone } = await approved();
      phone.send(payload);
      await phone.waitClosed();
      host.ws.close();
    }
  });
  it("revokes delivery immediately and rejects stale consent epochs after re-grant", async () => {
    const { host, phone } = await approved();
    const first = await grant(host, phone);
    await grant(host, phone, false);
    host.send(content(first.epoch));
    await new Promise((r) => setTimeout(r, 50));
    expect(phone.messages.some((m) => m.type === "previewContent")).toBe(false);
    const second = await grant(host, phone);
    expect(second.epoch).toBeGreaterThan(first.epoch);
    host.send(content(first.epoch));
    host.send(content(second.epoch));
    const received = (await phone.next("previewContent")) as unknown as {
      epoch: number;
    };
    expect(received.epoch).toBe(second.epoch);
    host.send({ type: "revoke" });
  });
  it("rejects oversized chunks and requests fresh host content after hibernation", async () => {
    const { room, host, phone } = await approved();
    await grant(host, phone);
    await mf.unsafeEvictDurableObject("relay", "Room", {
      id: room.id,
      webSockets: "hibernate",
    });
    phone.send({ type: "previewRequest", version: 1 });
    await host.next("previewRequest");
    expect(phone.messages.some((m) => m.type === "previewContent")).toBe(false);
    const current = (await phone.next("previewPermission")) as unknown as {
      epoch: number;
    };
    host.send(content(current.epoch, "x".repeat(8193)));
    await host.waitClosed();
  });
});

describe("v0.6 numeric controls on the existing authenticated channel", () => {
  it("forwards seek/typography once, ACKs authoritative metadata, and keeps text denied", async () => {
    const { host, phone } = await session();
    host.send({ type: "allow" });
    await host.next("connected");
    await phone.next("connected");
    const target = crypto.randomUUID(),
      id = crypto.randomUUID();
    const controls = {
      version: 1,
      target,
      maximum: 400,
      fontSize: 68,
      lineHeight: 1.5,
      textWidth: 1300,
      mirrorHorizontal: false,
      mirrorVertical: false,
      focusLine: true,
      countdownSeconds: 0,
    };
    const command = {
      action: "setPreference",
      target,
      key: "fontSize",
      value: 68,
    };
    phone.send({ type: "command", id, command });
    expect((await host.next("command")).command).toEqual(command);
    host.send({
      type: "ack",
      id,
      state: { playing: false, speed: 1, position: 200, controls },
    });
    expect((await phone.next("ack")).state).toEqual({
      playing: false,
      speed: 1,
      position: 200,
      controls,
    });
    phone.send({ type: "command", id, command });
    await new Promise((r) => setTimeout(r, 40));
    expect(host.messages.some((m) => m.type === "command")).toBe(false);
    expect(phone.messages.some((m) => m.type === "previewContent")).toBe(false);
    const seek = { action: "seek", target, value: 0.5 };
    phone.send({ type: "command", id: crypto.randomUUID(), command: seek });
    expect((await host.next("command")).command).toEqual(seek);
    host.send({ type: "revoke" });
  });
  it("rejects unknown preference names and malformed typed state", async () => {
    const { host, phone } = await session();
    host.send({ type: "allow" });
    await host.next("connected");
    await phone.next("connected");
    phone.send({
      type: "command",
      id: crypto.randomUUID(),
      command: {
        action: "setPreference",
        target: crypto.randomUUID(),
        key: "body",
        value: "private",
      },
    });
    await phone.waitClosed();
    host.send({ type: "revoke" });
  });
});

describe("Quick Send relay", () => {
  it.each(["session", "library"])(
    "forwards %s text only after approval and replays the receipt for duplicate IDs",
    async (destination) => {
      const { host, phone } = await session();
      host.send({ type: "allow" });
      await phone.next("connected");
      const message = {
        type: "quickSend",
        id: crypto.randomUUID(),
        destination,
        body: "Текст 👋\n\n" + "x".repeat(2000),
      };
      phone.send(message);
      expect(await host.next("quickSend")).toEqual(message);
      const receipt = {
        type: "quickSendAck",
        id: message.id,
        result: destination === "session" ? "delivered" : "saved",
      };
      host.send(receipt);
      expect(await phone.next("quickSendAck")).toEqual(receipt);
      phone.send(message);
      expect(await phone.next("quickSendAck")).toEqual(receipt);
      expect(host.messages.filter((m) => m.type === "quickSend")).toHaveLength(
        0,
      );
      host.send({ type: "revoke" });
    },
  );
  it("rejects unapproved text, wrong-role text and oversized submissions", async () => {
    const first = await session();
    first.phone.send({
      type: "quickSend",
      id: crypto.randomUUID(),
      destination: "session",
      body: "Private",
    });
    await first.phone.waitClosed();
    expect(first.host.messages.some((m) => m.type === "quickSend")).toBe(false);
    for (const role of ["host", "controller"]) {
      const { host, phone } = await session();
      host.send({ type: "allow" });
      await phone.next("connected");
      const sender = role === "host" ? host : phone;
      sender.send({
        type: "quickSend",
        id: crypto.randomUUID(),
        destination: "library",
        body: role === "host" ? "Text" : "x".repeat(8001),
      });
      await sender.waitClosed();
      host.ws.close();
      phone.ws.close();
    }
  });
  it("allows failed requests to retry and refuses changed text under a used ID", async () => {
    const { host, phone } = await session();
    host.send({ type: "allow" });
    await phone.next("connected");
    const message = {
      type: "quickSend",
      id: crypto.randomUUID(),
      destination: "library",
      body: "Original",
    };
    phone.send(message);
    await host.next("quickSend");
    host.send({ type: "quickSendAck", id: message.id, result: "failed" });
    await phone.next("quickSendAck");
    phone.send(message);
    expect(await host.next("quickSend")).toEqual(message);
    phone.send({ ...message, body: "Changed" });
    await phone.waitClosed();
    host.ws.close();
  });
});

describe("ephemeral remote voice", () => {
  const grant = () => ({
    type: "voiceOffer",
    version: 1,
    session: crypto.randomUUID(),
    target: crypto.randomUUID(),
    language: "uk-UA",
  });
  it("requires host consent, drops stale sessions and replays, and forwards only bounded ephemeral speech", async () => {
    const { host, phone } = await session();
    host.send({ type: "allow" });
    await phone.next("connected");
    const offer = grant();
    host.send(offer);
    expect(await phone.next("voiceOffer")).toMatchObject(offer);
    const frame = {
      type: "voiceTranscript",
      version: 1,
      session: offer.session,
      sequence: 0,
      restart: true,
      text: "PRIVATE_REMOTE_SPEECH_92",
    };
    phone.send(frame);
    expect(await host.next("voiceTranscript")).toMatchObject(frame);
    phone.send(frame);
    phone.send({ ...frame, session: crypto.randomUUID(), sequence: 1 });
    await new Promise((r) => setTimeout(r, 60));
    expect(host.messages.some((m) => m.type === "voiceTranscript")).toBe(false);
    host.send({ type: "voiceStop", version: 1, session: offer.session });
    await phone.next("voiceStop");
    phone.send({ ...frame, sequence: 2 });
    await new Promise((r) => setTimeout(r, 60));
    expect(host.messages.some((m) => m.type === "voiceTranscript")).toBe(false);
    for (const file of await readdir(persistence, { recursive: true })) {
      if (!file.endsWith(".sqlite")) continue;
      const db = new DatabaseSync(join(persistence, file));
      try {
        for (const row of db
          .prepare("SELECT name FROM sqlite_master WHERE type='table'")
          .all()) {
          const name = String(row.name).replace(/"/g, '""');
          const statement = db.prepare(`SELECT * FROM "${name}"`);
          statement.setReadBigInts(true);
          expect(
            JSON.stringify(statement.all(), (_, v) =>
              v instanceof Uint8Array
                ? Buffer.from(v).toString("utf8")
                : typeof v === "bigint"
                  ? String(v)
                  : v,
            ),
          ).not.toContain(frame.text);
        }
      } finally {
        db.close();
      }
    }
    host.send({ type: "revoke" });
  });
  it("prevents the controller from granting itself a microphone session", async () => {
    const { host, phone } = await session();
    host.send({ type: "allow" });
    await phone.next("connected");
    phone.send(grant());
    await phone.waitClosed();
  });
  it("rejects host-authored transcripts and unapproved voice", async () => {
    const first = await session();
    first.phone.send({
      type: "voiceStop",
      version: 1,
      session: crypto.randomUUID(),
    });
    await first.phone.waitClosed();
    const { host, phone } = await session();
    host.send({ type: "allow" });
    await phone.next("connected");
    const offer = grant();
    host.send(offer);
    await phone.next("voiceOffer");
    host.send({
      type: "voiceTranscript",
      version: 1,
      session: offer.session,
      sequence: 0,
      text: "invalid role",
      restart: true,
    });
    await host.waitClosed();
  });
});

it("remote voice consent is invalidated on controller reconnect", async () => {
  const room = await create(),
    hostKey = resumeKey(),
    phoneKey = resumeKey();
  const host = await peer(room.id, room.host, hostKey);
  await host.next("waiting");
  const phone = await peer(room.id, room.invite, phoneKey);
  await host.next("approval");
  host.send({ type: "allow" });
  await phone.next("connected");
  const offer = {
    type: "voiceOffer",
    version: 1,
    session: crypto.randomUUID(),
    target: crypto.randomUUID(),
    language: "en-US",
  };
  host.send(offer);
  await phone.next("voiceOffer");
  phone.ws.close(1001, "Network loss");
  await host.next("reconnecting");
  const replacement = await peer(room.id, phoneKey, phoneKey, true);
  await replacement.next("connected");
  replacement.send({
    type: "voiceTranscript",
    version: 1,
    session: offer.session,
    sequence: 0,
    restart: true,
    text: "stale microphone",
  });
  await new Promise((r) => setTimeout(r, 60));
  expect(host.messages.some((m) => m.type === "voiceTranscript")).toBe(false);
  host.send({ type: "revoke" });
});
