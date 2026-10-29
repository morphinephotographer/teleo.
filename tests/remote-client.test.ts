import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RemoteLink, type RemoteEvent } from "../apps/web/src/remote";
class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    Socket.instances.push(this);
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(event: unknown) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
  send(message: string) {
    this.sent.push(JSON.parse(message));
  }
  close() {
    this.terminate(1000);
  }
  terminate(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}
const room = "a".repeat(64),
  initial = "b".repeat(64);
let link: RemoteLink, events: RemoteEvent[];
function paired() {
  link.controller(room + "." + initial);
  const s = Socket.instances.at(-1)!;
  s.open();
  s.receive({ type: "authenticated" });
  s.receive({ type: "connected" });
  return s;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  vi.stubGlobal("location", { origin: "http://127.0.0.1:5173" });
  Socket.instances = [];
  events = [];
  link = new RemoteLink("http://127.0.0.1:8787");
  link.onEvent = (e) => events.push(e);
});
afterEach(() => {
  link.close();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("browser reconnect lifecycle", () => {
  it("uses independent in-memory resume capability and never replays an uncertain command", () => {
    const socket = paired();
    const auth = socket.sent[0];
    expect(auth.token).toBe(initial);
    expect(auth.resume).toMatch(/^[a-f0-9]{64}$/);
    expect(auth.resume).not.toBe(initial);
    const id = link.command({ action: "togglePlay" });
    socket.terminate();
    expect(events).toContainEqual({ type: "unconfirmed", id });
    vi.advanceTimersByTime(250);
    const resumed = Socket.instances.at(-1)!;
    resumed.open();
    expect(resumed.sent).toEqual([{ type: "resume", token: auth.resume }]);
    resumed.receive({ type: "authenticated" });
    resumed.receive({ type: "connected" });
    expect(resumed.sent.some((m) => m.type === "command")).toBe(false);
    expect(events.at(-1)?.type).toBe("connected");
  });
  it("stops after the 25-second retry budget even if the server never responds", () => {
    const socket = paired();
    socket.terminate();
    vi.advanceTimersByTime(26000);
    expect(events.at(-1)?.type).toBe("disconnected");
    const count = Socket.instances.length;
    vi.advanceTimersByTime(60000);
    expect(Socket.instances).toHaveLength(count);
    expect(count).toBeLessThanOrEqual(9);
  });
  it.each([1008, 4000, 4001])("does not retry terminal close %s", (code) => {
    paired().terminate(code);
    vi.advanceTimersByTime(60000);
    expect(Socket.instances).toHaveLength(1);
    expect(events.at(-1)?.type).toBe("disconnected");
  });
  it("explicit close cancels recovery and stale handlers cannot mutate a new session", () => {
    const old = paired();
    const stale = old.onmessage!;
    old.terminate();
    link.close();
    vi.advanceTimersByTime(30000);
    expect(Socket.instances).toHaveLength(1);
    paired();
    const n = events.length;
    stale({ data: JSON.stringify({ type: "connected" }) });
    expect(events).toHaveLength(n);
  });
  it("blocks offline commands, times out unacknowledged requests and rejects stale state", () => {
    const socket = paired();
    const id = link.command({ action: "play" });
    vi.advanceTimersByTime(5000);
    expect(events).toContainEqual({ type: "unconfirmed", id });
    socket.receive({
      type: "state",
      sequence: 3,
      state: { playing: true, speed: 1, position: 12 },
    });
    const n = events.length;
    socket.receive({
      type: "state",
      sequence: 2,
      state: { playing: false, speed: 1, position: 0 },
    });
    expect(events).toHaveLength(n);
    socket.receive({ type: "reconnecting" });
    const before = socket.sent.length;
    const failed = link.command({ action: "restart" });
    expect(events).toContainEqual({ type: "unconfirmed", id: failed });
    expect(socket.sent).toHaveLength(before);
  });
  it("never attempts automatic recovery before host approval", () => {
    link.controller(room + "." + initial);
    const socket = Socket.instances[0];
    socket.open();
    socket.receive({ type: "authenticated" });
    socket.terminate();
    vi.advanceTimersByTime(60000);
    expect(Socket.instances).toHaveLength(1);
    expect(events.at(-1)?.type).toBe("serverUnreachable");
  });
});

it("a replaced peer invalidates pending ACKs even without a preceding reconnecting event", () => {
  const socket = paired();
  const id = link.command({ action: "togglePlay" });
  socket.receive({ type: "connected" });
  expect(events).toContainEqual({ type: "unconfirmed", id });
});

it("closing while room creation is in flight cannot open a late background socket", async () => {
  let resolve!: (value: unknown) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    ),
  );
  const creation = link.host();
  const rejection = expect(creation).rejects.toThrow("cancelled");
  link.close();
  resolve({
    ok: true,
    json: async () => ({ id: room, host: initial, invite: "c".repeat(64) }),
  });
  await rejection;
  expect(Socket.instances).toHaveLength(0);
});

it("serializes rapid speed taps at bounded rate, applying each logical step once", () => {
  const socket = paired();
  socket.receive({
    type: "state",
    sequence: 0,
    state: { playing: true, speed: 1, position: 42 },
  });
  const ids = Array.from({ length: 10 }, () =>
    link.command({ action: "speedUp" }),
  );
  expect(socket.sent.filter((m) => m.type === "command")).toHaveLength(1);
  for (let i = 0; i < 10; i++) {
    socket.receive({
      type: "ack",
      id: ids[i],
      sequence: i + 1,
      state: { playing: true, speed: (11 + i) / 10, position: 42 },
    });
    vi.advanceTimersByTime(80);
  }
  expect(
    socket.sent.filter((m) => m.type === "command").map((m) => m.id),
  ).toEqual(ids);
  expect(events.filter((e) => e.type === "ack").at(-1)?.state?.speed).toBe(2);
});
it("suppresses redundant queued bound steps and drops uncertain steps on reconnect", () => {
  const socket = paired();
  socket.receive({
    type: "state",
    sequence: 0,
    state: { playing: false, speed: 2.9, position: 42 },
  });
  const id = link.command({ action: "speedUp" });
  for (let i = 0; i < 9; i++) link.command({ action: "speedUp" });
  socket.receive({
    type: "ack",
    id,
    sequence: 1,
    state: { playing: false, speed: 3, position: 42 },
  });
  vi.advanceTimersByTime(1000);
  expect(socket.sent.filter((m) => m.type === "command")).toHaveLength(1);
  link.command({ action: "speedDown" });
  link.command({ action: "speedDown" });
  socket.terminate();
  vi.advanceTimersByTime(250);
  const resumed = Socket.instances.at(-1)!;
  resumed.open();
  resumed.receive({ type: "authenticated" });
  resumed.receive({ type: "connected" });
  vi.advanceTimersByTime(1000);
  expect(resumed.sent.filter((m) => m.type === "command")).toHaveLength(0);
});
it("a delayed ACK completes its queue entry without replacing a newer authoritative state", () => {
  const socket = paired();
  socket.receive({
    type: "state",
    sequence: 0,
    state: { playing: false, speed: 1, position: 42 },
  });
  const id = link.command({ action: "speedUp" });
  const next = link.command({ action: "speedDown" });
  socket.receive({
    type: "state",
    sequence: 3,
    state: { playing: false, speed: 2, position: 42 },
  });
  socket.receive({
    type: "ack",
    id,
    sequence: 2,
    state: { playing: false, speed: 1.1, position: 42 },
  });
  vi.advanceTimersByTime(80);
  expect(events.filter((e) => e.type === "state").at(-1)?.state?.speed).toBe(2);
  expect(events.filter((e) => e.type === "ack")).toHaveLength(0);
  expect(socket.sent.filter((m) => m.type === "command").at(-1)?.id).toBe(next);
});

it("cancels unsent speed gestures when the host switches script target", () => {
  const socket = paired();
  const state = (target: string) => ({
    playing: false,
    speed: 1,
    position: 0,
    controls: {
      version: 1,
      target,
      maximum: 1000,
      fontSize: 40,
      lineHeight: 1.6,
      textWidth: 760,
      mirrorHorizontal: false,
      mirrorVertical: false,
      focusLine: true,
      countdownSeconds: 0,
    },
  });
  socket.receive({
    type: "state",
    sequence: 0,
    state: state("11111111-1111-4111-8111-111111111111"),
  });
  const active = link.command({ action: "speedUp" });
  const queued = link.command({ action: "speedUp" });
  socket.receive({
    type: "state",
    sequence: 1,
    state: state("22222222-2222-4222-8222-222222222222"),
  });
  socket.receive({
    type: "ack",
    id: active,
    sequence: 2,
    state: state("22222222-2222-4222-8222-222222222222"),
  });
  vi.advanceTimersByTime(1000);
  expect(socket.sent.filter((m) => m.type === "command")).toHaveLength(1);
  expect(events.some((e) => e.type === "unconfirmed" && e.id === queued)).toBe(
    true,
  );
});

it("Quick Send waits for receiver receipt, ignores other IDs, and supports a same-ID retry after timeout", async () => {
  const socket = paired();
  const message = {
    type: "quickSend" as const,
    id: crypto.randomUUID(),
    destination: "session" as const,
    body: "Text\n\n👋",
  };
  let resolved = false;
  const waiting = link.quickSend(message).then(() => {
    resolved = true;
  });
  await Promise.resolve();
  expect(resolved).toBe(false);
  socket.receive({
    type: "quickSendAck",
    id: crypto.randomUUID(),
    result: "delivered",
  });
  await Promise.resolve();
  expect(resolved).toBe(false);
  socket.receive({ type: "quickSendAck", id: message.id, result: "delivered" });
  await waiting;
  expect(resolved).toBe(true);
  const timeout = link.quickSend(message);
  const rejection = expect(timeout).rejects.toThrow("quickSendUncertain");
  vi.advanceTimersByTime(10000);
  await rejection;
  const retry = link.quickSend(message);
  socket.receive({ type: "quickSendAck", id: message.id, result: "delivered" });
  await expect(retry).resolves.toMatchObject({ result: "delivered" });
});
it("Quick Send rejects offline, failed and disconnected transfers without success", async () => {
  const message = {
    type: "quickSend" as const,
    id: crypto.randomUUID(),
    destination: "library" as const,
    body: "Text",
  };
  await expect(link.quickSend(message)).rejects.toThrow();
  const socket = paired();
  const failed = link.quickSend(message);
  socket.receive({ type: "quickSendAck", id: message.id, result: "failed" });
  await expect(failed).rejects.toThrow("quickSendFailed");
  const interrupted = link.quickSend(message);
  socket.terminate();
  await expect(interrupted).rejects.toThrow("quickSendUncertain");
});
