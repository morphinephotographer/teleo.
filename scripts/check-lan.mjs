import https from "node:https";
import { readFileSync } from "node:fs";
const base = new URL(process.env.TELEO_LAN_ORIGIN || "https://invalid");
if (base.protocol !== "https:" || !process.env.TELEO_TLS_CA)
  throw Error(
    "Set TELEO_LAN_ORIGIN=https://LAN-IP:5183 and TELEO_TLS_CA to the trusted issuing CA PEM",
  );
function request(path, method, origin = base.origin) {
  return new Promise((resolve, reject) => {
    const r = https.request(
      new URL(path, base),
      {
        method,
        ca: readFileSync(process.env.TELEO_TLS_CA),
        headers: { Origin: origin },
        timeout: 8000,
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res));
      },
    );
    r.on("timeout", () => r.destroy(Error("LAN endpoint unreachable")));
    r.on("error", reject);
    r.end();
  });
}
const page = await request("/studio", "GET");
if (page.statusCode !== 200) throw Error("Studio not reachable");
const allowed = await request("/api/rooms", "OPTIONS");
if (
  allowed.statusCode !== 204 ||
  allowed.headers["access-control-allow-origin"] !== base.origin
)
  throw Error("Relay origin/proxy misconfigured");
const denied = await request(
  "/api/rooms",
  "OPTIONS",
  "https://untrusted.invalid",
);
if (denied.statusCode !== 403) throw Error("Unexpected origin accepted");
console.log(
  "PASS: trusted TLS, Studio route, exact-origin relay proxy, foreign-origin rejection. Run this check from a second LAN computer too; it does not certify iPhone reachability or pairing.",
);
