import { networkInterfaces } from "node:os";
import { accessSync } from "node:fs";
import { spawn } from "node:child_process";

// Explicit opt-in: bind only the chosen interface, with an exact Origin allowlist.
const host = process.env.TELEO_LAN_HOST;
const port = Number(process.env.TELEO_LAN_PORT || 5183);
const relayPort = Number(process.env.TELEO_RELAY_PORT || 18787);
const addresses = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a?.family === "IPv4" && !a.internal)
  .map((a) => a.address);
if (
  !host ||
  !addresses.includes(host) ||
  !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
) {
  console.error(
    "Set TELEO_LAN_HOST to the private IPv4 address of this Mac's reachable Wi-Fi/Ethernet interface.",
  );
  process.exit(1);
}
if (
  ![port, relayPort].every(
    (n) => Number.isInteger(n) && n >= 1024 && n <= 65535,
  ) ||
  port === relayPort
)
  throw Error("Invalid LAN/relay ports");
if (!process.env.TELEO_TLS_CERT || !process.env.TELEO_TLS_KEY) {
  console.error(
    "Set TELEO_TLS_CERT and TELEO_TLS_KEY to a certificate/key valid for TELEO_LAN_HOST and trusted by both devices. Never bypass a certificate warning.",
  );
  process.exit(1);
}
accessSync(process.env.TELEO_TLS_CERT);
accessSync(process.env.TELEO_TLS_KEY);
const origin = `https://${host}:${port}`;
const env = {
  ...process.env,
  TELEO_RELAY_PORT: String(relayPort),
  TELEO_RELAY_PROTOCOL: "https",
  VITE_RELAY_URL: "",
  WRANGLER_SEND_METRICS: "false",
};
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
for (const args of [
  [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--config",
    "services/remote-relay/wrangler.jsonc",
    "--local-protocol",
    "https",
    "--https-key-path",
    process.env.TELEO_TLS_KEY,
    "--https-cert-path",
    process.env.TELEO_TLS_CERT,
    "--persist-to",
    ".wrangler/lan-state",
    "--ip",
    "127.0.0.1",
    "--port",
    String(relayPort),
    "--inspector-port",
    "0",
    "--var",
    `ALLOWED_ORIGINS:${origin}`,
  ],
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    host,
    "--port",
    String(port),
    "--strictPort",
  ],
]) {
  const child = spawn(process.execPath, args, { stdio: "inherit", env });
  children.push(child);
  child.on("error", () => stop(1));
  child.on("exit", (code) => stop(code ?? 1));
}
console.log(
  `Open ${origin}/studio on the Mac first. The phone must trust this certificate and reach this address on the same LAN. Relay is loopback-only; auth and explicit approval remain required.`,
);
