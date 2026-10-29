import {
  validQuickSend,
  validQuickSendAck,
  type QuickSend,
  type QuickSendAck,
} from "../../../packages/protocol/quick-send";
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
import { stepSpeed } from "../../../packages/protocol/speed";
export type { PlaybackState } from "../../../packages/protocol/control";
export type RemoteEvent = {
  type: string;
  id?: string;
  command?: ControlCommand;
  transfer?: QuickSend;
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
  private transfers = new Map<
    string,
    {
      resolve: (ack: QuickSendAck) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
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
  private speedQueue: { id: string; command: ControlCommand }[] = [];
  private activeSpeed?: string;
  private speedTimer?: ReturnType<typeof setTimeout>;
  private lastSpeedSent = -Infinity;
  private confirmedSpeed?: number;
  private confirmedTarget?: string;
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
      const destination = new URL("/remote", location.origin);
      const lang = new URLSearchParams(location.search).get("lang");
      if (lang && ["en", "uk", "ru"].includes(lang))
        destination.searchParams.set("lang", lang);
      destination.hash = `pair=${id}.${invite}`;
      return destination.href;
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
      if (validQuickSend(event)) {
        this.onEvent({ type: "quickSend", transfer: event });
        return;
      }
      if (validQuickSendAck(event)) {
        const pending = this.transfers.get(event.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.transfers.delete(event.id);
          if (event.result === "failed")
            pending.reject(Error("quickSendFailed"));
          else pending.resolve(event);
        }
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
          !Number.isSafeInteger(event.sequence) ||
          event.sequence! < 0
        )
          return;
        if (event.type === "ack" && event.id) {
          clearTimeout(this.pending.get(event.id));
          this.pending.delete(event.id);
          if (this.activeSpeed === event.id) this.activeSpeed = undefined;
        }
        if (event.sequence! <= this.sequence) {
          this.pumpSpeed();
          return;
        }
        this.sequence = event.sequence!;
        this.confirmedSpeed = event.state!.speed;
        const target = event.state!.controls?.target;
        if (this.confirmedTarget && target !== this.confirmedTarget) {
          // A queued gesture belongs to the script visible when it was made.
          for (const item of this.speedQueue)
            this.onEvent({ type: "unconfirmed", id: item.id });
          this.speedQueue = [];
        }
        this.confirmedTarget = target;
      }
      this.onEvent(event);
      this.pumpSpeed();
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
        this.finish(
          this.wasConnected
            ? "disconnected"
            : e.code === 1008 || e.code === 4001
              ? "expired"
              : "serverUnreachable",
        );
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
  private rejectTransfers() {
    for (const pending of this.transfers.values()) {
      clearTimeout(pending.timer);
      pending.reject(Error("quickSendUncertain"));
    }
    this.transfers.clear();
  }
  quickSend(message: QuickSend): Promise<QuickSendAck> {
    if (
      !this.ready ||
      !validQuickSend(message) ||
      this.transfers.has(message.id)
    )
      return Promise.reject(Error("quickSendFailed"));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.transfers.delete(message.id);
        reject(Error("quickSendUncertain"));
      }, 10000);
      this.transfers.set(message.id, { resolve, reject, timer });
      this.send(message);
    });
  }
  private uncertain() {
    this.rejectTransfers();
    clearTimeout(this.speedTimer);
    this.activeSpeed = undefined;
    this.confirmedSpeed = undefined;
    this.confirmedTarget = undefined;
    for (const item of this.speedQueue)
      this.onEvent({ type: "unconfirmed", id: item.id });
    this.speedQueue = [];
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
    if (command.action === "speedUp" || command.action === "speedDown") {
      if (this.speedQueue.length >= 50)
        this.onEvent({ type: "unconfirmed", id });
      else {
        this.speedQueue.push({ id, command });
        this.pumpSpeed();
      }
    } else this.dispatch(id, command);
    return id;
  }
  private dispatch(id: string, command: ControlCommand) {
    this.pending.set(
      id,
      setTimeout(() => {
        this.pending.delete(id);
        this.onEvent({ type: "unconfirmed", id });
        if (this.activeSpeed === id) this.uncertain();
      }, 5000),
    );
    this.send({ type: "command", id, command });
  }
  private pumpSpeed() {
    if (!this.ready || this.activeSpeed || !this.speedQueue.length) return;
    clearTimeout(this.speedTimer);
    const delay = Math.max(0, 80 - (Date.now() - this.lastSpeedSent));
    if (delay) {
      this.speedTimer = setTimeout(() => this.pumpSpeed(), delay);
      return;
    }
    while (this.speedQueue.length) {
      const next = this.speedQueue.shift()!;
      const direction = next.command.action === "speedUp" ? 1 : -1;
      if (
        this.confirmedSpeed !== undefined &&
        stepSpeed(this.confirmedSpeed, direction) === this.confirmedSpeed
      )
        continue;
      this.activeSpeed = next.id;
      this.lastSpeedSent = Date.now();
      this.dispatch(next.id, next.command);
      break;
    }
  }
  close() {
    this.rejectTransfers();
    this.creating?.abort();
    this.creating = undefined;
    this.stopped = true;
    this.ready = false;
    clearTimeout(this.speedTimer);
    this.speedQueue = [];
    this.activeSpeed = undefined;
    this.confirmedSpeed = undefined;
    this.confirmedTarget = undefined;
    this.lastSpeedSent = -Infinity;
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
