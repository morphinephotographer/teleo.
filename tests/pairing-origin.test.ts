import { expect, it } from "vitest";
import { phonePairingIssue } from "../apps/web/src/pairing-origin";
it.each([
  "http://127.0.0.1:5173",
  "https://localhost:5183",
  "http://[::1]:5173",
  "http://127.1.2.3:5173",
])("labels %s as same-Mac pairing only", (origin) => {
  expect(phonePairingIssue(origin)).toBe("localPairingOnly");
});
it("requires trusted HTTPS on LAN and uses the actual reachable origin", () => {
  expect(phonePairingIssue("http://192.168.1.12:5183")).toBe(
    "securePairingRequired",
  );
  expect(phonePairingIssue("https://192.168.1.12:5183")).toBeNull();
  expect(
    phonePairingIssue("https://teleo-staging.example.workers.dev"),
  ).toBeNull();
});
