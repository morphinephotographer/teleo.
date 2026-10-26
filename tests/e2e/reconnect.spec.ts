import { test, expect, type Page, type WebSocketRoute } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
// Each test is an independent local client. Cloudflare replaces this header in production.
test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "CF-Connecting-IP": crypto.randomUUID() });
});
async function host(page: Page, locale: "en" | "uk" | "ru") {
  const t = dictionaries[locale];
  await page.goto("/studio?lang=" + locale);
  await page
    .getByRole("button", { name: t.newScript, exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: t.body, exact: true })
    .fill("Private host text 🌍\n\n".repeat(100));
  await page.getByRole("button", { name: t.read, exact: true }).click();
  await page
    .locator(".reader")
    .getByRole("button", { name: t.connect })
    .click();
  const link = page.getByRole("link", { name: t.invite });
  await expect(link).toBeVisible();
  return (await link.getAttribute("href"))!;
}
for (const locale of ["en", "uk", "ru"] as const) {
  test(`${locale}: real controller reconnect, current host state and revoke`, async ({
    page,
    browser,
  }, info) => {
    const t = dictionaries[locale];
    const invite = await host(page, locale);
    const context = await browser.newContext({ locale });
    const phone = await context.newPage();
    const sockets: { client: WebSocketRoute; server: WebSocketRoute }[] = [];
    await phone.routeWebSocket("**/api/rooms/*", (client) =>
      sockets.push({ client, server: client.connectToServer() }),
    );
    await phone.goto(invite);
    await page.getByRole("button", { name: t.allow, exact: true }).click();
    await expect(phone.locator("p[role=status]")).toHaveText(t.connected);
    await phone.getByRole("button", { name: t.play, exact: true }).click();
    await expect(phone.locator("output")).toContainText(t.play);
    const before = Number(
      await page.getByRole("slider", { name: t.position }).inputValue(),
    );
    await sockets[0].server.close({
      code: 1012,
      reason: "QA transport interruption",
    });
    await sockets[0].client.close({
      code: 1012,
      reason: "QA transport interruption",
    });
    await expect.poll(() => sockets.length).toBeGreaterThan(1);
    await expect(phone.locator("p[role=status]")).toHaveText(t.connected);
    expect(
      Number(await page.getByRole("slider", { name: t.position }).inputValue()),
    ).toBeGreaterThanOrEqual(before);
    await expect(
      page
        .locator(".reader")
        .getByRole("button", { name: t.pause, exact: true }),
    ).toBeVisible();
    // Local host changes now reach the phone even without a remote command.
    await page
      .locator(".reader")
      .getByRole("button", { name: t.pause, exact: true })
      .click();
    await expect(phone.locator("output")).toContainText(t.pause);
    await phone.screenshot({
      path: `docs/screenshots/${info.project.name}-${locale}-reconnected-controller.png`,
    });
    await phone.getByRole("button", { name: t.revoke, exact: true }).click();
    await expect(page.locator(".pair-panel p[role=status]")).toHaveText(
      t.disconnected,
    );
    const count = sockets.length;
    await phone.waitForTimeout(750);
    expect(sockets).toHaveLength(count);
    await context.close();
  });
}
test("host reconnect keeps script and playback; unconfirmed command is not replayed", async ({
  page,
  browser,
}) => {
  const connections: { client: WebSocketRoute; server: WebSocketRoute }[] = [];
  await page.routeWebSocket("**/api/rooms/*", (client) =>
    connections.push({ client, server: client.connectToServer() }),
  );
  const invite = await host(page, "en");
  const context = await browser.newContext();
  const phone = await context.newPage();
  const observed: string[] = [];
  // Log only message types for diagnostics, never capabilities or payloads.
  phone.on("websocket", (ws) => {
    ws.on("framereceived", (frame) => {
      try {
        observed.push("in:" + JSON.parse(String(frame.payload)).type);
      } catch {
        /* Not JSON. */
      }
    });
    ws.on("framesent", (frame) => {
      try {
        observed.push("out:" + JSON.parse(String(frame.payload)).type);
      } catch {
        /* Not JSON. */
      }
    });
  });
  await phone.goto(invite);
  await page.getByRole("button", { name: "Allow", exact: true }).click();
  await expect(phone.locator("p[role=status]")).toHaveText("Connected");
  // Drop a real command before delivery, then interrupt the host. No fake success response.
  let dropped = 0;
  const server = connections[0].server;
  server.onMessage((message) => {
    const m = JSON.parse(String(message));
    if (m.type !== "command") connections[0].client.send(message);
    else dropped++;
  });
  await phone.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(() => dropped).toBe(1);
  await server.close({ code: 1012, reason: "QA host outage" });
  await connections[0].client.close({ code: 1012, reason: "QA host outage" });
  await expect(phone.getByRole("alert"))
    .toContainText("Command was not confirmed")
    .catch(() => {
      throw Error(
        "Missing uncertain-command warning; frames: " + observed.join(","),
      );
    });
  await expect.poll(() => connections.length).toBeGreaterThan(1);
  await expect(phone.locator("p[role=status]")).toHaveText("Connected");
  await expect(
    page.locator(".reader").getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Exit reader", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Your words", exact: true }),
  ).toHaveValue("Private host text 🌍\n\n".repeat(100));
  await context.close();
});
test("prolonged relay outage stops retries and preserves the local reader", async ({
  page,
  browser,
}) => {
  test.setTimeout(45000);
  const invite = await host(page, "en");
  const context = await browser.newContext();
  const phone = await context.newPage();
  let outage = false,
    attempts = 0;
  let transport: { client: WebSocketRoute; server: WebSocketRoute } | undefined;
  await phone.routeWebSocket("**/api/rooms/*", (client) => {
    attempts++;
    if (outage) {
      void client.close({ code: 1013, reason: "QA relay unavailable" });
      return;
    }
    transport = { client, server: client.connectToServer() };
  });
  await phone.goto(invite);
  await page.getByRole("button", { name: "Allow", exact: true }).click();
  await expect(phone.locator("p[role=status]")).toHaveText("Connected");
  await page
    .locator(".reader")
    .getByRole("button", { name: "Play", exact: true })
    .click();
  outage = true;
  await transport!.server.close({ code: 1012, reason: "QA relay outage" });
  await transport!.client.close({ code: 1012, reason: "QA relay outage" });
  await expect(phone.locator("p[role=status]")).toHaveText(
    "Connection interrupted — reconnecting…",
  );
  await expect(phone.locator("p[role=status]")).toHaveText(
    "Disconnected — create a new invitation to reconnect",
    { timeout: 30000 },
  );
  const count = attempts;
  await phone.waitForTimeout(1000);
  expect(attempts).toBe(count);
  expect(count).toBeLessThanOrEqual(9);
  await page.mouse.move(30, 150);
  await expect(
    page.locator(".reader").getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Exit reader", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Your words", exact: true }),
  ).toHaveValue("Private host text 🌍\n\n".repeat(100));
  await context.close();
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
  });
});
