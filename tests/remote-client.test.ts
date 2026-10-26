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
    expect(events.at(-1)?.type).toBe("unavailable");
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
