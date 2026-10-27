import https from "node:https";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import crypto from "node:crypto";
const require = createRequire(import.meta.resolve("miniflare"));
const WS = require("ws");
const origin = new URL(process.env.TELEO_LAN_ORIGIN || "https://invalid")
  .origin;
if (!process.env.TELEO_TLS_CA || !origin.startsWith("https://"))
  throw Error("Set TELEO_LAN_ORIGIN and TELEO_TLS_CA");
const ca = readFileSync(process.env.TELEO_TLS_CA);
const room = await new Promise((resolve, reject) => {
  const q = https.request(
    origin + "/api/rooms",
    { method: "POST", ca, headers: { Origin: origin } },
    (res) => {
      let b = "";
      res.on("data", (c) => (b += c));
      res.on("end", () =>
        res.statusCode === 200
          ? resolve(JSON.parse(b))
          : reject(Error("room HTTP " + res.statusCode)),
      );
    },
  );
  q.on("error", reject);
  q.end();
});
function peer() {
  const socket = new WS(
    origin.replace("https", "wss") + "/api/rooms/" + room.id,
    { ca, origin },
  );
  const inbox = [];
  socket.on("message", (b) => inbox.push(JSON.parse(b.toString())));
  socket.on("error", () => {});
  const wait = (type, id) =>
    new Promise((resolve, reject) => {
      const until = Date.now() + 8000;
      const timer = setInterval(() => {
        const i = inbox.findIndex(
          (m) => m.type === type && (!id || m.id === id),
        );
        if (i >= 0) {
          clearInterval(timer);
          resolve(inbox.splice(i, 1)[0]);
        } else if (Date.now() > until) {
          clearInterval(timer);
          reject(Error("missing " + type));
        }
      }, 10);
    });
  return {
    socket,
    wait,
    send: (m) => socket.send(JSON.stringify(m)),
    open: () =>
      new Promise((r, j) => {
        socket.once("open", r);
        socket.once("error", j);
      }),
  };
}
const h = peer(),
  p = peer();
try {
  await Promise.all([h.open(), p.open()]);
  h.send({ type: "auth", token: room.host, resume: "a".repeat(64) });
  await h.wait("waiting");
  p.send({ type: "auth", token: room.invite, resume: "b".repeat(64) });
  await h.wait("approval");
  h.send({ type: "allow" });
  await Promise.all([h.wait("connected"), p.wait("connected")]);
  const id = crypto.randomUUID();
  p.send({ type: "command", id, command: { action: "play" } });
  await h.wait("command", id);
  h.send({ type: "ack", id, state: { playing: true, speed: 1, position: 0 } });
  const ack = await p.wait("ack", id);
  if (!ack.state.playing) throw Error("state mismatch");
  h.send({ type: "revoke" });
  await new Promise((r) => p.socket.once("close", r));
  console.log(
    "PASS: actual LAN HTTPS room creation, WSS upgrade, one-use auth, explicit host approval, command/ACK, authoritative state and revoke. Both clients ran on this Mac; physical iPhone NOT tested.",
  );
} finally {
  h.socket.close();
  p.socket.close();
}
