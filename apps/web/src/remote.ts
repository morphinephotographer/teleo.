import type { Command } from "../../../packages/protocol/domain";
export type RemoteEvent = {
  type: string;
  id?: string;
  command?: Command;
  state?: { playing: boolean; speed: number; position: number };
};
export class RemoteLink {
  socket?: WebSocket;
  heartbeat?: ReturnType<typeof setInterval>;
  timeout?: ReturnType<typeof setTimeout>;
  lastPong = Date.now();
  onEvent: (event: RemoteEvent) => void = () => {};
  private base = import.meta.env.VITE_RELAY_URL || location.origin;
  async host() {
    this.close();
    const response = await fetch(this.base + "/api/rooms", { method: "POST" });
    if (!response.ok) throw Error("unavailable");
    const { id, host, invite } = await response.json();
    this.open(id, host);
    return `${location.origin}/remote#pair=${id}.${invite}`;
  }
  controller(pair: string) {
    if (!/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(pair)) throw Error("expired");
    const [id, secret] = pair.split(".");
    this.open(id, secret);
  }
  private open(id: string, secret: string) {
    this.close();
    this.lastPong = Date.now();
    const socket = new WebSocket(
      this.base.replace(/^http/, "ws") + "/api/rooms/" + id,
    );
    this.socket = socket;
    this.onEvent({ type: "connecting" });
    this.timeout = setTimeout(() => {
      socket.close();
      this.onEvent({ type: "unavailable" });
    }, 8000);
    socket.onopen = () => {
      clearTimeout(this.timeout);
      socket.send(JSON.stringify({ type: "auth", token: secret }));
      this.heartbeat = setInterval(() => {
        if (Date.now() - this.lastPong > 35000) {
          socket.close();
          return;
        }
        this.send({ type: "ping" });
      }, 15000);
    };
    socket.onmessage = (e) => {
      const event = JSON.parse(e.data) as RemoteEvent;
      if (event.type === "pong") {
        this.lastPong = Date.now();
        return;
      }
      this.onEvent(event);
    };
    socket.onclose = () => {
      clearInterval(this.heartbeat);
      clearTimeout(this.timeout);
      this.onEvent({ type: "disconnected" });
    };
    socket.onerror = () => this.onEvent({ type: "unavailable" });
  }
  send(message: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(message));
  }
  command(command: Command) {
    const id = crypto.randomUUID();
    this.send({ type: "command", id, command });
    return id;
  }
  close() {
    clearInterval(this.heartbeat);
    clearTimeout(this.timeout);
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = undefined;
    }
  }
}
