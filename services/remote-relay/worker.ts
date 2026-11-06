import {
  validVoiceFrame,
  type VoiceOffer,
} from "../../packages/protocol/remote-voice";
import {
  validQuickSend,
  validQuickSendAck,
} from "../../packages/protocol/quick-send";
import { DurableObject } from "cloudflare:workers";
import { validPreviewPayload } from "../../packages/protocol/preview";
import {
  validControlCommand,
  validPlaybackState as validState,
} from "../../packages/protocol/control";
interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  ALLOWED_ORIGINS: string;
}
type Role = "host" | "controller";
type RoomData = {
  hostHash: string;
  inviteHash: string;
  inviteExpires: number;
  expires: number;
  used: boolean;
  approved: boolean;
  revoked: boolean;
  seen: string[];
  pending: string[];
  resume: Partial<Record<Role, string>>;
  connections: Partial<Record<Role, string>>;
  detached: Partial<Record<Role, number>>;
  sequence: number;
  lastSeen: Partial<Record<Role, number>>;
  transfers?: string[];
  previewAllowed?: boolean;
  previewEpoch?: number;
  voice?: VoiceOffer;
  voiceSequence?: number;
};
type Attachment = {
  role: "new" | Role;
  id: string;
  window: number;
  count: number;
};
const RECONNECT_GRACE = 30_000;
const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
const hash = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin");
    if (!origin || !env.ALLOWED_ORIGINS.split(",").includes(origin))
      return new Response("Forbidden", { status: 403 });
    if (req.method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
          Vary: "Origin",
        },
      });
    if (req.method === "POST" && url.pathname === "/api/rooms") {
      const ip = req.headers.get("CF-Connecting-IP") || "local";
      const rate = await env.ROOMS.get(
        env.ROOMS.idFromName("rate:" + (await hash(ip))),
      ).fetch(new Request("https://room/rate"));
      if (!rate.ok) return rate;
      const id = crypto.randomUUID();
      const response = await env.ROOMS.get(env.ROOMS.idFromName(id)).fetch(
        new Request("https://room/create", { method: "POST" }),
      );
      const headers = new Headers(response.headers);
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Vary", "Origin");
      return new Response(response.body, { status: response.status, headers });
    }
    const match = url.pathname.match(/^\/api\/rooms\/([a-f0-9]{64})$/);
    if (!match || req.headers.get("Upgrade") !== "websocket")
      return new Response("Not found", { status: 404 });
    try {
      return env.ROOMS.get(env.ROOMS.idFromString(match[1])).fetch(req);
    } catch {
      return new Response(null, { status: 400 });
    }
  },
} satisfies ExportedHandler<Env>;
export class Room extends DurableObject<Env> {
  async fetch(req: Request) {
    if (new URL(req.url).pathname === "/rate") {
      const now = Date.now();
      const r = (await this.ctx.storage.get<{ window: number; count: number }>(
        "rate",
      )) || { window: now, count: 0 };
      if (now - r.window > 60000) {
        r.window = now;
        r.count = 0;
      }
      if (++r.count > 10) return new Response(null, { status: 429 });
      await this.ctx.storage.put("rate", r);
      await this.ctx.storage.setAlarm(now + 60000);
      return new Response(null, { status: 204 });
    }
    if (new URL(req.url).pathname === "/create") {
      if (await this.ctx.storage.get("room"))
        return new Response(null, { status: 409 });
      const host = token(),
        invite = token(),
        now = Date.now();
      await this.ctx.storage.put("room", {
        hostHash: await hash(host),
        inviteHash: await hash(invite),
        inviteExpires: now + 120000,
        expires: now + 3600000,
        used: false,
        approved: false,
        revoked: false,
        seen: [],
        pending: [],
        resume: {},
        connections: {},
        detached: {},
        sequence: 0,
        lastSeen: {},
      } satisfies RoomData);
      await this.ctx.storage.setAlarm(now + 120000);
      return Response.json(
        { id: this.ctx.id.toString(), host, invite },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const data = await this.ctx.storage.get<RoomData>("room");
    // After a runtime restart socket attachments may be gone without close events.
    // Missing peers get a conservative deadline anchored to their last observed frame.
    if (data?.approved && data.lastSeen && data.connections && data.detached) {
      let changed = false;
      for (const role of ["host", "controller"] as const) {
        if (
          data.connections[role] &&
          !this.peers(data, role).length &&
          !data.detached[role]
        ) {
          delete data.connections[role];
          data.detached[role] = (data.lastSeen[role] ?? 0) + RECONNECT_GRACE;
          changed = true;
        }
      }
      if (changed) {
        await this.ctx.storage.put("room", data);
        await this.schedule(data);
      }
    }
    if (!data || this.expired(data, Date.now()))
      return new Response(null, { status: 410 });
    if (this.ctx.getWebSockets().length >= 3)
      return new Response(null, { status: 429 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({
      role: "new",
      id: crypto.randomUUID(),
      window: Date.now(),
      count: 0,
    } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  private expired(d: RoomData, now: number) {
    return (
      !d.lastSeen ||
      !d.resume ||
      !d.connections ||
      !d.detached ||
      d.revoked ||
      now >= d.expires ||
      (!d.approved && now >= d.inviteExpires) ||
      Object.values(d.detached).some((deadline) => now >= deadline)
    );
  }
  private peers(d: RoomData, role: Role) {
    return this.ctx.getWebSockets().filter((ws) => {
      const a = ws.deserializeAttachment() as Attachment;
      return (
        a.role === role && a.id === d.connections[role] && ws.readyState === 1
      );
    });
  }
  private ready(d: RoomData) {
    return (
      this.peers(d, "host").length > 0 && this.peers(d, "controller").length > 0
    );
  }
  private send(d: RoomData, role: Role, value: unknown) {
    for (const ws of this.peers(d, role)) ws.send(JSON.stringify(value));
  }
  private async schedule(d: RoomData) {
    await this.ctx.storage.setAlarm(
      Math.min(
        d.approved ? d.expires : d.inviteExpires,
        ...Object.values(d.detached),
      ),
    );
  }
  private connected(d: RoomData) {
    if (!this.ready(d)) return;
    this.send(d, "host", { type: "connected" });
    this.send(d, "controller", { type: "connected" });
    this.send(d, "host", this.previewPermission(d));
    this.send(d, "controller", this.previewPermission(d));
    this.send(d, "host", { type: "stateRequest" });
  }
  private previewPermission(d: RoomData) {
    return {
      type: "previewPermission",
      version: 1,
      allowed: !!d.previewAllowed,
      epoch: d.previewEpoch || 0,
      sessionId: this.ctx.id.toString(),
    };
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    await this.ctx.blockConcurrencyWhile(async () => {
      try {
        if (typeof message !== "string" || message.length > 52_000)
          throw Error();
        const a = ws.deserializeAttachment() as Attachment;
        const now = Date.now();
        if (now - a.window > 1000) {
          a.window = now;
          a.count = 0;
        }
        if (++a.count > 20) throw Error();
        ws.serializeAttachment(a);
        const d = await this.ctx.storage.get<RoomData>("room");
        if (!d || this.expired(d, now)) throw Error();
        const m = JSON.parse(message);
        if (
          message.length > 1024 &&
          !(a.role === "host" && m.type === "previewContent") &&
          !(a.role === "controller" && m.type === "quickSend") &&
          !(
            a.role === "controller" &&
            m.type === "voiceTranscript" &&
            message.length <= 6000
          )
        )
          throw Error();
        if (a.role === "new") {
          if (typeof m.token !== "string" || !/^[a-f0-9]{64}$/.test(m.token))
            throw Error();
          const h = await hash(m.token);
          let role: Role;
          if (m.type === "resume" && d.approved) {
            const matched = (["host", "controller"] as const).find(
              (r) => d.resume[r] === h,
            );
            if (!matched) throw Error();
            role = matched;
          } else if (
            m.type === "auth" &&
            typeof m.resume === "string" &&
            /^[a-f0-9]{64}$/.test(m.resume) &&
            m.resume !== m.token
          ) {
            if (h === d.hostHash && !d.resume.host) role = "host";
            else if (
              h === d.inviteHash &&
              !d.used &&
              now < d.inviteExpires &&
              this.peers(d, "host").length
            ) {
              role = "controller";
              d.used = true;
            } else throw Error();
            d.resume[role] = await hash(m.resume);
          } else throw Error();
          delete d.voice;
          delete d.voiceSequence;
          const previous = this.peers(d, role);
          a.role = role;
          d.connections[role] = a.id;
          d.lastSeen[role] = now;
          delete d.detached[role];
          ws.serializeAttachment(a);
          await this.ctx.storage.put("room", d);
          await this.schedule(d);
          for (const old of previous) old.close(4000, "Connection replaced");
          ws.send(JSON.stringify({ type: "authenticated" }));
          if (m.type === "auth") {
            ws.send(JSON.stringify({ type: "waiting" }));
            if (role === "controller")
              this.send(d, "host", { type: "approval" });
          } else {
            ws.send(JSON.stringify({ type: "reconnecting" }));
            this.connected(d);
          }
          return;
        }
        if (d.connections[a.role] !== a.id) throw Error();
        d.lastSeen[a.role] = now;
        await this.ctx.storage.put("room", d);
        if (m.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }
        if (m.type === "revoke" || (a.role === "host" && m.type === "deny")) {
          await this.revoke();
          return;
        }
        if (
          a.role === "host" &&
          m.type === "allow" &&
          d.used &&
          !d.approved &&
          this.ready(d)
        ) {
          d.approved = true;
          await this.ctx.storage.put("room", d);
          await this.schedule(d);
          this.connected(d);
          return;
        }
        if (!d.approved) throw Error();
        if (
          typeof m.type === "string" &&
          [
            "voiceOffer",
            "voiceStop",
            "voiceStatus",
            "voiceTranscript",
          ].includes(m.type)
        ) {
          if (!validVoiceFrame(m)) throw Error();
          if (m.type === "voiceOffer") {
            if (a.role !== "host") throw Error();
            if (!this.ready(d)) return;
            d.voice = m;
            d.voiceSequence = -1;
            await this.ctx.storage.put("room", d);
            this.send(d, "controller", m);
          } else {
            if (m.type !== "voiceStop" && a.role !== "controller")
              throw Error();
            if (!this.ready(d) || d.voice?.session !== m.session) return;
            if (m.type === "voiceStop") {
              delete d.voice;
              delete d.voiceSequence;
              await this.ctx.storage.put("room", d);
              this.send(d, "host", m);
              this.send(d, "controller", m);
            } else {
              if (m.type === "voiceTranscript") {
                if (m.sequence <= (d.voiceSequence ?? -1)) return;
                d.voiceSequence = m.sequence;
                await this.ctx.storage.put("room", d);
              }
              // Forward speech in memory only; never put the frame in storage.
              this.send(d, "host", m);
            }
          }
          return;
        }

        if (
          m.type === "previewPermission" &&
          a.role === "host" &&
          Object.keys(m).sort().join(",") === "allowed,type,version" &&
          m.version === 1 &&
          typeof m.allowed === "boolean"
        ) {
          d.previewAllowed = m.allowed;
          d.previewEpoch = (d.previewEpoch || 0) + 1;
          await this.ctx.storage.put("room", d);
          this.send(d, "host", this.previewPermission(d));
          this.send(d, "controller", this.previewPermission(d));
          return;
        }
        if (
          m.type === "previewRequest" &&
          a.role === "controller" &&
          m.version === 1 &&
          Object.keys(m).sort().join(",") === "type,version"
        ) {
          this.send(d, "controller", this.previewPermission(d));
          if (d.previewAllowed && this.ready(d))
            this.send(d, "host", { type: "previewRequest" });
          return;
        }
        if (a.role === "controller" && validQuickSend(m)) {
          if (!this.ready(d)) {
            ws.send(
              JSON.stringify({
                type: "quickSendAck",
                id: m.id,
                result: "failed",
              }),
            );
            return;
          }
          // Persist only a fingerprint and receipt, never the submitted text.
          const key = "transfer:" + m.id;
          const fingerprint = await hash(
            JSON.stringify([m.destination, m.body]),
          );
          const old = await this.ctx.storage.get<{
            fingerprint: string;
            destination: string;
            result?: string;
          }>(key);
          if (old && old.fingerprint !== fingerprint) throw Error();
          if (old?.result) {
            this.send(d, "controller", {
              type: "quickSendAck",
              id: m.id,
              result: old.result,
            });
            return;
          }
          if (!old) {
            d.transfers ||= [];
            if (d.transfers.length >= 100) {
              ws.send(
                JSON.stringify({
                  type: "quickSendAck",
                  id: m.id,
                  result: "failed",
                }),
              );
              return;
            }
            d.transfers.push(m.id);
            await this.ctx.storage.put(key, {
              fingerprint,
              destination: m.destination,
            });
            await this.ctx.storage.put("room", d);
          }
          this.send(d, "host", m);
          return;
        }
        if (a.role === "host" && validQuickSendAck(m)) {
          const key = "transfer:" + m.id;
          const old = await this.ctx.storage.get<{
            fingerprint: string;
            destination: string;
            result?: string;
          }>(key);
          if (!old || old.result) return;
          if (
            m.result !== "failed" &&
            m.result !== (old.destination === "session" ? "delivered" : "saved")
          )
            throw Error();
          // Failed operations may be retried with the same ID.
          if (m.result !== "failed")
            await this.ctx.storage.put(key, { ...old, result: m.result });
          this.send(d, "controller", m);
          return;
        }
        if (a.role === "host" && validPreviewPayload(m)) {
          // Content is forwarded only. Never assign it to room storage or socket attachments.
          if (!d.previewAllowed || m.epoch !== d.previewEpoch || !this.ready(d))
            return;
          d.sequence++;
          await this.ctx.storage.put("room", d);
          this.send(d, "controller", {
            ...m,
            sessionId: this.ctx.id.toString(),
            sequence: d.sequence,
          });
          return;
        }
        if (
          a.role === "controller" &&
          m.type === "command" &&
          Object.keys(m).every((k) => ["type", "id", "command"].includes(k)) &&
          typeof m.id === "string" &&
          /^[a-f0-9-]{36}$/.test(m.id) &&
          validControlCommand(m.command)
        ) {
          if (!this.ready(d)) {
            ws.send(JSON.stringify({ type: "unconfirmed", id: m.id }));
            return;
          }
          // Keep legacy IDs for deployed rooms; new IDs are separate durable keys.
          // A growing JSON room value both capped valid sessions and approached KV value limits.
          if (
            d.seen.includes(m.id) ||
            (await this.ctx.storage.get("seen:" + m.id))
          )
            return;
          await this.ctx.storage.put("seen:" + m.id, true);
          d.pending.push(m.id);
          if (d.pending.length > 50) throw Error();
          await this.ctx.storage.put("room", d);
          this.send(d, "host", {
            type: "command",
            id: m.id,
            command: m.command,
          });
          return;
        }
        if (
          a.role === "host" &&
          m.type === "ack" &&
          typeof m.id === "string" &&
          (d.seen.includes(m.id) ||
            (await this.ctx.storage.get("seen:" + m.id))) &&
          validState(m.state)
        ) {
          if (!d.pending.includes(m.id)) return; // Late ACK from before a disconnect is not fresh state.
          d.pending = d.pending.filter((id) => id !== m.id);
          d.sequence++;
          await this.ctx.storage.put("room", d);
          this.send(d, "controller", {
            type: "ack",
            id: m.id,
            state: m.state,
            sequence: d.sequence,
          });
          return;
        }
        if (
          a.role === "host" &&
          m.type === "state" &&
          Object.keys(m).sort().join(",") === "state,type" &&
          validState(m.state)
        ) {
          if (!this.ready(d)) return;
          d.sequence++;
          await this.ctx.storage.put("room", d);
          this.send(d, "controller", {
            type: "state",
            state: m.state,
            sequence: d.sequence,
          });
          return;
        }
        throw Error();
      } catch {
        ws.close(1008, "Invalid session or message");
      }
    });
  }
  private async revoke() {
    const d = await this.ctx.storage.get<RoomData>("room");
    if (d) {
      d.revoked = true;
      d.previewAllowed = false;
      d.previewEpoch = (d.previewEpoch || 0) + 1;
      d.resume = {};
      d.pending = [];
      await this.ctx.storage.put("room", d);
    }
    for (const ws of this.ctx.getWebSockets()) ws.close(4001, "Session ended");
    await this.ctx.storage.setAlarm(Date.now() + 1000);
  }
  private async disconnected(ws: WebSocket, code: number) {
    await this.ctx.blockConcurrencyWhile(async () => {
      const a = ws.deserializeAttachment() as Attachment;
      if (a.role === "new") return;
      const d = await this.ctx.storage.get<RoomData>("room");
      if (!d || d.revoked || d.connections[a.role] !== a.id) return;
      if (!d.approved || code === 1008) {
        await this.revoke();
        return;
      }
      delete d.voice;
      delete d.voiceSequence;
      delete d.connections[a.role];
      d.detached[a.role] = Date.now() + RECONNECT_GRACE;
      d.pending = [];
      await this.ctx.storage.put("room", d);
      await this.schedule(d);
      this.send(d, a.role === "host" ? "controller" : "host", {
        type: "reconnecting",
      });
    });
  }
  async webSocketClose(
    ws: WebSocket,
    code: number,
    _reason: string,
    _clean: boolean,
  ) {
    await this.disconnected(ws, code);
  }
  async webSocketError(ws: WebSocket) {
    await this.disconnected(ws, 1006);
  }
  async alarm() {
    await this.ctx.blockConcurrencyWhile(async () => {
      const d = await this.ctx.storage.get<RoomData>("room");
      if (!d || d.revoked) {
        await this.ctx.storage.deleteAll();
        return;
      }
      if (this.expired(d, Date.now())) await this.revoke();
      else await this.schedule(d);
    });
  }
}
