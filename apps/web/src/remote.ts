import {
  validPreviewPayload,
  type PreviewEnvelope,
  type PreviewPermission,
} from "../../../packages/protocol/preview";
import {
  validPlaybackState,
  type ControlCommand,
  type PlaybackState,
} from "../../../packages/protocol/control";
export type { PlaybackState } from "../../../packages/protocol/control";
export type RemoteEvent = {
  type: string;
  id?: string;
  command?: ControlCommand;
  state?: PlaybackState;
  sequence?: number;
  preview?: PreviewEnvelope | PreviewPermission;
};
const secret = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
/** Credentials and reconnect state deliberately live only in this tab's memory. */
export class RemoteLink {
  socket?: WebSocket;
  private creating?: AbortController;
  private heartbeat?: ReturnType<typeof setInterval>;
  private timeout?: ReturnType<typeof setTimeout>;
  private retry?: ReturnType<typeof setTimeout>;
  private recoveryTimer?: ReturnType<typeof setTimeout>;
  private session?: { id: string; initial: string; resume: string };
  private stopped = true;
  private wasConnected = false;
  private ready = false;
  private authenticated = false;
  private attempt = 0;
  private recoveryDeadline = 0;
  private sequence = -1;
  private lastPong = 0;
  private pending = new Map<string, ReturnType<typeof setTimeout>>();
  onEvent: (event: RemoteEvent) => void = () => {};
  constructor(
    private base = import.meta.env.VITE_RELAY_URL || location.origin,
  ) {}
  async host() {
    this.close();
    const request = new AbortController();
    this.creating = request;
    const timer = setTimeout(() => request.abort(), 8000);
    try {
      const response = await fetch(this.base + "/api/rooms", {
        method: "POST",
        signal: request.signal,
      });
      if (!response.ok) throw Error("unavailable");
      const { id, host, invite } = await response.json();
      if (this.creating !== request || request.signal.aborted)
        throw Error("cancelled");
      this.creating = undefined;
      this.start(id, host);
      return `${location.origin}/remote#pair=${id}.${invite}`;
    } finally {
      clearTimeout(timer);
      if (this.creating === request) this.creating = undefined;
    }
  }
  controller(pair: string) {
    if (!/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(pair)) throw Error("expired");
    const [id, initial] = pair.split(".");
    this.start(id, initial);
  }
  private start(id: string, initial: string) {
    this.close();
    this.session = { id, initial, resume: secret() };
    this.stopped = false;
    this.wasConnected = false;
    this.sequence = -1;
    this.connect(false);
  }
  private connect(resuming: boolean) {
    const session = this.session;
    if (this.stopped || !session) return;
    this.authenticated = false;
    this.lastPong = Date.now();
    const socket = new WebSocket(
      this.base.replace(/^http/, "ws") + "/api/rooms/" + session.id,
    );
    this.socket = socket;
    this.onEvent({ type: resuming ? "reconnecting" : "connecting" });
    this.timeout = setTimeout(() => socket.close(), 8000);
    socket.onopen = () => {
      if (this.socket !== socket || this.stopped) return;
      socket.send(
        JSON.stringify(
          resuming
            ? { type: "resume", token: session.resume }
            : { type: "auth", token: session.initial, resume: session.resume },
        ),
      );
    };
    socket.onmessage = (e) => {
      if (this.socket !== socket || this.stopped) return;
      let event: RemoteEvent;
      try {
        event = JSON.parse(e.data);
      } catch {
        this.finish("unavailable");
        return;
      }
      if (event.type === "previewPermission") {
        const m = event as unknown as PreviewPermission;
        if (
          m.version === 1 &&
          m.sessionId === this.session?.id &&
          typeof m.allowed === "boolean" &&
          Number.isSafeInteger(m.epoch) &&
          m.epoch >= 0
        )
          this.onEvent({ type: "previewPermission", preview: m });
        return;
      }
      if (
        event.type === "previewContent" ||
        event.type === "previewPosition" ||
        event.type === "previewUnavailable"
      ) {
        const m = event as unknown as PreviewEnvelope;
        const { sessionId, sequence, ...payload } = m;
        if (
          sessionId === this.session?.id &&
          Number.isSafeInteger(sequence) &&
          sequence >= 0 &&
          validPreviewPayload(payload)
        )
          this.onEvent({ type: m.type, preview: m });
        return;
      }
      if (event.type === "authenticated") {
        this.authenticated = true;
        clearTimeout(this.timeout);
        this.heartbeat = setInterval(() => {
          if (Date.now() - this.lastPong > 35000) {
            socket.close();
            return;
          }
          this.send({ type: "ping" });
        }, 15000);
        return;
      }
      if (event.type === "pong") {
        this.lastPong = Date.now();
        return;
      }
      if (event.type === "connected") {
        // The peer may replace a stale socket before its close callback arrives.
        // A new connection epoch makes outstanding command outcomes uncertain.
        this.uncertain();
        this.wasConnected = true;
        this.ready = true;
        this.attempt = 0;
        this.recoveryDeadline = 0;
        clearTimeout(this.recoveryTimer);
      }
      if (event.type === "reconnecting") {
        this.ready = false;
        this.uncertain();
        this.beginRecovery();
      }
      if (event.type === "ack" || event.type === "state") {
        if (
          !validPlaybackState(event.state) ||
          typeof event.sequence !== "number" ||
          event.sequence <= this.sequence
        )
          return;
        this.sequence = event.sequence;
        if (event.id) {
          clearTimeout(this.pending.get(event.id));
          this.pending.delete(event.id);
        }
      }
      this.onEvent(event);
    };
    socket.onclose = (e) => {
      if (this.socket !== socket || this.stopped) return;
      clearInterval(this.heartbeat);
      clearTimeout(this.timeout);
      this.socket = undefined;
      this.authenticated = false;
      this.ready = false;
      this.uncertain();
      if ([1008, 4000, 4001].includes(e.code) || !this.wasConnected) {
        this.finish(this.wasConnected ? "disconnected" : "unavailable");
        return;
      }
      this.beginRecovery();
      this.onEvent({ type: "reconnecting" });
      if (Date.now() >= this.recoveryDeadline || this.attempt >= 8) {
        this.finish("disconnected");
        return;
      }
      const delay = Math.min(4000, 250 * 2 ** this.attempt++);
      this.retry = setTimeout(() => this.connect(true), delay);
    };
    socket.onerror = () => {}; // Browsers follow transport errors with close; only close schedules retries.
  }
  private beginRecovery() {
    if (this.recoveryDeadline) return;
    this.recoveryDeadline = Date.now() + 25000;
    this.recoveryTimer = setTimeout(() => this.finish("disconnected"), 25000);
  }
  private uncertain() {
    for (const [id, timer] of this.pending) {
      clearTimeout(timer);
      this.onEvent({ type: "unconfirmed", id });
    }
    this.pending.clear();
  }
  private finish(type: string) {
    this.close();
    this.onEvent({ type });
  }
  send(message: unknown) {
    if (this.authenticated && this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(message));
  }
  previewPermission(allowed: boolean) {
    if (this.ready)
      this.send({ type: "previewPermission", version: 1, allowed });
  }
  requestPreview() {
    if (this.ready) this.send({ type: "previewRequest", version: 1 });
  }
  state(state: PlaybackState) {
    if (this.ready) this.send({ type: "state", state });
  }
  command(command: ControlCommand) {
    const id = crypto.randomUUID();
    if (!this.ready) {
      this.onEvent({ type: "unconfirmed", id });
      return id;
    }
    this.pending.set(
      id,
      setTimeout(() => {
        this.pending.delete(id);
        this.onEvent({ type: "unconfirmed", id });
      }, 5000),
    );
    this.send({ type: "command", id, command });
    return id;
  }
  close() {
    this.creating?.abort();
    this.creating = undefined;
    this.stopped = true;
    this.ready = false;
    clearInterval(this.heartbeat);
    clearTimeout(this.timeout);
    clearTimeout(this.retry);
    clearTimeout(this.recoveryTimer);
    this.recoveryDeadline = 0;
    this.attempt = 0;
    if (this.socket) {
      this.send({ type: "revoke" });
      this.socket.onclose = null;
      this.socket.onmessage = null;
      this.socket.onopen = null;
      this.socket.onerror = null;
      this.socket.close();
      this.socket = undefined;
    }
    this.authenticated = false;
    this.session = undefined;
    for (const timer of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
  }
}
