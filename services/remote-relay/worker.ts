import { DurableObject } from "cloudflare:workers";
import { validCommand } from "../../packages/protocol/domain";
interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  ALLOWED_ORIGINS: string;
}
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
};
type Attachment = {
  role: "new" | "host" | "controller";
  window: number;
  count: number;
};
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
      } satisfies RoomData);
      await this.ctx.storage.setAlarm(now + 120000);
      return Response.json(
        { id: this.ctx.id.toString(), host, invite },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const data = await this.ctx.storage.get<RoomData>("room");
    if (!data || data.revoked || Date.now() > data.expires)
      return new Response(null, { status: 410 });
    if (this.ctx.getWebSockets().length >= 3)
      return new Response(null, { status: 429 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({
      role: "new",
      window: Date.now(),
      count: 0,
    } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  private send(role: string, value: unknown) {
    for (const s of this.ctx.getWebSockets()) {
      if ((s.deserializeAttachment() as Attachment)?.role === role)
        s.send(JSON.stringify(value));
    }
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    await this.ctx.blockConcurrencyWhile(async () => {
      try {
        if (typeof message !== "string" || message.length > 1024) throw Error();
        const a = ws.deserializeAttachment() as Attachment;
        const now = Date.now();
        if (now - a.window > 1000) {
          a.window = now;
          a.count = 0;
        }
        if (++a.count > 20) throw Error();
        ws.serializeAttachment(a);
        const d = await this.ctx.storage.get<RoomData>("room");
        if (!d || d.revoked || now > d.expires) throw Error();
        const m = JSON.parse(message);
        if (a.role === "new") {
          if (
            m.type !== "auth" ||
            typeof m.token !== "string" ||
            m.token.length !== 64
          )
            throw Error();
          const h = await hash(m.token);
          if (
            h === d.hostHash &&
            !this.ctx
              .getWebSockets()
              .some(
                (s) =>
                  (s.deserializeAttachment() as Attachment)?.role === "host",
              )
          ) {
            a.role = "host";
            ws.serializeAttachment(a);
            ws.send(JSON.stringify({ type: "waiting" }));
          } else if (
            h === d.inviteHash &&
            !d.used &&
            now <= d.inviteExpires &&
            this.ctx
              .getWebSockets()
              .some(
                (s) =>
                  (s.deserializeAttachment() as Attachment)?.role === "host",
              )
          ) {
            d.used = true;
            a.role = "controller";
            ws.serializeAttachment(a);
            await this.ctx.storage.put("room", d);
            this.send("host", { type: "approval" });
            ws.send(JSON.stringify({ type: "waiting" }));
          } else throw Error();
          return;
        }
        if (m.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }
        if (a.role === "host" && ["deny", "revoke"].includes(m.type)) {
          await this.revoke();
          return;
        }
        if (a.role === "host" && m.type === "allow" && d.used && !d.approved) {
          d.approved = true;
          await this.ctx.storage.put("room", d);
          await this.ctx.storage.setAlarm(d.expires);
          this.send("controller", { type: "connected" });
          this.send("host", { type: "connected" });
          return;
        }
        if (!d.approved) throw Error();
        if (
          a.role === "controller" &&
          m.type === "command" &&
          Object.keys(m).every((k) => ["type", "id", "command"].includes(k)) &&
          typeof m.id === "string" &&
          /^[a-f0-9-]{36}$/.test(m.id) &&
          validCommand(m.command)
        ) {
          if (d.seen.includes(m.id)) return;
          d.seen.push(m.id);
          if (d.seen.length > 1000) throw Error();
          d.pending.push(m.id);
          if (d.pending.length > 50) throw Error();
          await this.ctx.storage.put("room", d);
          this.send("host", { type: "command", id: m.id, command: m.command });
          return;
        }
        if (
          a.role === "host" &&
          m.type === "ack" &&
          typeof m.id === "string" &&
          d.pending.includes(m.id) &&
          m.state &&
          Object.keys(m.state).sort().join(",") === "playing,position,speed" &&
          typeof m.state.playing === "boolean" &&
          Number.isFinite(m.state.speed) &&
          m.state.speed >= 0.5 &&
          m.state.speed <= 3 &&
          Number.isFinite(m.state.position) &&
          m.state.position >= 0
        ) {
          d.pending = d.pending.filter((id) => id !== m.id);
          await this.ctx.storage.put("room", d);
          this.send("controller", { type: "ack", id: m.id, state: m.state });
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
      await this.ctx.storage.put("room", d);
    }
    for (const s of this.ctx.getWebSockets()) s.close(1000, "Session ended");
    await this.ctx.storage.setAlarm(Date.now() + 1000);
  }
  async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string,
    _clean: boolean,
  ) {
    if ((ws.deserializeAttachment() as Attachment)?.role !== "new")
      await this.revoke();
  }
  async webSocketError(ws: WebSocket) {
    if ((ws.deserializeAttachment() as Attachment)?.role !== "new")
      await this.revoke();
  }
  async alarm() {
    const d = await this.ctx.storage.get<RoomData>("room");
    if (!d) {
      await this.ctx.storage.deleteAll();
      return;
    }
    if (d.revoked) {
      await this.ctx.storage.deleteAll();
      return;
    }
    if (
      Date.now() >= d.expires ||
      (!d.approved && Date.now() >= d.inviteExpires)
    ) {
      await this.revoke();
    } else
      await this.ctx.storage.setAlarm(d.approved ? d.expires : d.inviteExpires);
  }
}
