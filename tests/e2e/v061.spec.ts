import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";

if (process.env.TELEO_V061_URL)
  test.use({ baseURL: process.env.TELEO_V061_URL });
const local = ["127.0.0.1", "localhost", "[::1]"].includes(
  new URL(process.env.TELEO_V061_URL || "http://127.0.0.1:5173").hostname,
);

for (const locale of ["en", "uk", "ru"] as const) {
  test(`${locale}: bottom alignment synchronizes without moving playback; real QR lifecycle`, async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(60000);
    const t = dictionaries[locale];
    if (local)
      await page.setExtraHTTPHeaders({
        "CF-Connecting-IP": crypto.randomUUID(),
      });
    await page.addInitScript(() =>
      sessionStorage.setItem("teleo.intro.seen.v1", "true"),
    );
    await page.goto(`/studio?lang=${locale}`);
    await page
      .getByRole("button", { name: t.newScript, exact: true })
      .first()
      .click();
    await page
      .getByRole("textbox", { name: t.body, exact: true })
      .fill(
        "A clear voice and a long paragraph for testing alignment.\n\n".repeat(
          150,
        ),
      );
    const dock = page.locator(".reader-controls");
    const hostAlign = dock.getByRole("group", {
      name: t.alignment,
      exact: true,
    });
    await expect(hostAlign.getByRole("button")).toHaveCount(3);
    await expect(hostAlign.getByRole("button")).toHaveText(["", "", ""]);
    await expect(
      page.getByRole("combobox", { name: t.alignment, exact: true }),
    ).toHaveCount(0);
    await hostAlign
      .getByRole("button", { name: t.alignRight, exact: true })
      .click();
    if (locale === "en") {
      const original = page.viewportSize()!;
      for (const size of [
        { width: 1280, height: 900 },
        { width: 834, height: 1112 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(size);
        if (size.width <= 834 && (await page.locator(".library").isVisible()))
          await page
            .locator("header")
            .getByRole("button", { name: t.library, exact: true })
            .click();
        await expect(hostAlign).toBeInViewport();
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollHeight <= innerHeight &&
              document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          animations: "disabled",
          path: `docs/screenshots/v061-${info.project.name}-studio-${size.width}x${size.height}.png`,
        });
      }
      await page.setViewportSize(original);
    }
    await page.getByRole("button", { name: t.read, exact: true }).click();
    await page
      .locator("header")
      .getByRole("button", { name: t.remoteConnection, exact: true })
      .click();
    const pair = page.locator(".pairing-sheet");
    const link = pair.getByRole("link", { name: t.invite, exact: true });
    await expect(pair.locator("img")).toBeVisible();
    await expect
      .poll(() =>
        pair
          .locator("img")
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
    await pair
      .getByRole("button", { name: t.copy, exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      pair.getByRole("button", { name: t.copy, exact: true }),
    ).toBeInViewport();
    await pair.locator("img").scrollIntoViewIfNeeded();
    const invite = (await link.getAttribute("href"))!;
    expect(new URL(invite).origin).toBe(new URL(page.url()).origin);
    if (locale === "en" && process.platform === "darwin") {
      const dataURL = await pair.locator("img").getAttribute("src");
      const decoded = spawnSync(
        "swift",
        [
          "-module-cache-path",
          "/private/tmp/teleo-v061-swift-cache",
          fileURLToPath(new URL("./decode-qr.swift", import.meta.url)),
        ],
        {
          input: JSON.stringify({ png: dataURL!.split(",")[1], url: invite }),
          encoding: "utf8",
          timeout: 30000,
        },
      );
      expect(decoded.status).toBe(0);
      expect(decoded.stdout.trim()).toBe("decoded");
    }

    await page.screenshot({
      animations: "disabled",
      path: `docs/screenshots/v061-${info.project.name}-${locale}-qr.png`,
    });
    // Closing must preserve the same pending invitation.
    await pair.getByRole("button", { name: t.close, exact: true }).click();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const phone = await context.newPage();
    const sockets: {
      client: import("@playwright/test").WebSocketRoute;
      server: import("@playwright/test").WebSocketRoute;
    }[] = [];
    const received: {
      type: string;
      id?: string;
      state?: { controls?: { alignment?: string } };
    }[] = [];
    let offline = false;
    await phone.routeWebSocket("**/api/rooms/*", (client) => {
      if (offline) {
        client.close();
        return;
      }
      const server = client.connectToServer();
      sockets.push({ client, server });
      client.onMessage((m) => server.send(m));
      server.onMessage((m) => {
        received.push(JSON.parse(String(m)));
        client.send(m);
      });
      server.onClose((code, reason) => client.close({ code, reason }));
    });
    await phone.goto(invite);
    await page
      .locator("header")
      .getByRole("button", { name: t.remoteConnection, exact: true })
      .click();
    await expect(pair).toBeVisible();
    await expect(link).toHaveAttribute("href", invite);
    await pair.getByRole("button", { name: t.allow, exact: true }).click();
    await expect(pair).not.toBeVisible();
    await page
      .locator("header")
      .getByRole("button", { name: t.remoteConnection, exact: true })
      .click();
    await pair
      .getByRole("checkbox", { name: t.allowPreview, exact: true })
      .check();
    await pair.getByRole("button", { name: t.close, exact: true }).click();
    await expect(phone.locator(".remote-text")).toContainText("A clear voice");
    await page.screenshot({
      animations: "disabled",
      path: `docs/screenshots/v061-${info.project.name}-${locale}-connected.png`,
    });
    await dock
      .getByRole("button", { name: t.mirrorHorizontal, exact: true })
      .click();
    await expect(page.locator(".reader article")).toHaveCSS(
      "transform",
      "matrix(-1, 0, 0, 1, 0, 0)",
    );
    await phone.locator(".remote-quick-trigger").click();
    const quick = phone.locator(".remote-quick-menu");
    const phoneAlign = quick.getByRole("group", {
      name: t.alignment,
      exact: true,
    });
    await expect(quick.getByRole("slider")).toHaveCount(3);
    await expect(
      phoneAlign.getByRole("button", { name: t.alignRight, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.locator(".reading-viewport").evaluate((el) => {
      el.scrollTop = 500;
      el.dispatchEvent(new Event("scroll"));
    });
    const before = await page
      .locator(".reading-viewport")
      .evaluate((el) => el.scrollTop);
    for (const [value, label] of [
      ["left", t.alignLeft],
      ["center", t.alignCenter],
      ["right", t.alignRight],
    ] as const) {
      await phoneAlign
        .getByRole("button", { name: label, exact: true })
        .click();
      await expect(page.locator(".reader article")).toHaveCSS(
        "text-align",
        value,
      );
      await expect(
        hostAlign.getByRole("button", { name: label, exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect
        .poll(() =>
          page.locator(".reading-viewport").evaluate((el) => el.scrollTop),
        )
        .toBe(before);
      if (locale === "en")
        await page.screenshot({
          animations: "disabled",
          path: `docs/screenshots/v061-${info.project.name}-alignment-${value}.png`,
        });
    }
    await hostAlign
      .getByRole("button", { name: t.alignCenter, exact: true })
      .click();
    await expect(
      hostAlign.getByRole("button", { name: t.alignCenter, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(
        () =>
          received.filter((m) => m.type === "state" || m.type === "ack").at(-1)
            ?.state?.controls?.alignment,
      )
      .toBe("center");
    await expect(
      phoneAlign.getByRole("button", { name: t.alignCenter, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    // Rapid commands converge to the host's final state.
    await phoneAlign.getByRole("button").evaluateAll((buttons) => {
      for (let i = 0; i < 12; i++)
        (buttons[i % 3] as HTMLButtonElement).click();
    });
    await expect(
      hostAlign.getByRole("button", { name: t.alignRight, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      phoneAlign.getByRole("button", { name: t.alignRight, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    // Authenticated but stale script target must ACK current state, never mutate it.
    const stale = crypto.randomUUID();
    sockets.at(-1)!.server.send(
      JSON.stringify({
        type: "command",
        id: stale,
        command: {
          action: "setPreference",
          target: crypto.randomUUID(),
          key: "alignment",
          value: "left",
        },
      }),
    );
    await expect
      .poll(() => received.some((m) => m.type === "ack" && m.id === stale))
      .toBe(true);
    await expect(
      hostAlign.getByRole("button", { name: t.alignRight, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    offline = true;
    sockets.at(-1)!.client.close({ code: 1012, reason: "Local recovery test" });
    await expect(phone.locator(".remote-connection")).toContainText(
      t.reconnecting,
    );
    await hostAlign
      .getByRole("button", { name: t.alignCenter, exact: true })
      .click();
    offline = false;
    await expect(phone.locator(".remote-connection")).toHaveText(t.connected);
    await expect(
      phoneAlign.getByRole("button", { name: t.alignCenter, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(phone.locator(".remote-text")).toContainText("A clear voice");
    await phone.screenshot({
      animations: "disabled",
      path: `docs/screenshots/v061-${info.project.name}-${locale}-text-sheet.png`,
    });
    await page.screenshot({
      animations: "disabled",
      path: `docs/screenshots/v061-${info.project.name}-${locale}-studio.png`,
    });
    await quick.getByRole("button", { name: t.close, exact: true }).click();
    await phone.getByRole("button", { name: t.play, exact: true }).click();
    await expect(
      dock.getByRole("button", { name: t.pause, exact: true }),
    ).toBeVisible();
    const playingPosition = await page
      .locator(".reading-viewport")
      .evaluate((el) => el.scrollTop);
    await hostAlign
      .getByRole("button", { name: t.alignLeft, exact: true })
      .click();
    await expect
      .poll(() =>
        page.locator(".reading-viewport").evaluate((el) => el.scrollTop),
      )
      .toBeGreaterThan(playingPosition);
    await phone.getByRole("button", { name: t.pause, exact: true }).click();
    await page.reload();
    await expect(
      hostAlign.getByRole("button", { name: t.alignLeft, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await context.close();
  });
}

test("QR image failure exposes error and renewal without losing the copy link", async ({
  page,
}) => {
  const t = dictionaries.en;
  if (local)
    await page.setExtraHTTPHeaders({ "CF-Connecting-IP": crypto.randomUUID() });
  await page.addInitScript(() =>
    sessionStorage.setItem("teleo.intro.seen.v1", "true"),
  );
  await page.goto("/studio?lang=en");
  await page
    .getByRole("button", { name: t.newScript, exact: true })
    .first()
    .click();
  await page
    .locator("header")
    .getByRole("button", { name: t.remoteConnection, exact: true })
    .click();
  const pair = page.locator(".pairing-sheet");
  await expect(pair.locator("img")).toBeVisible();
  const link = pair.getByRole("link", { name: t.invite, exact: true });
  const old = await link.getAttribute("href");
  await pair.locator("img").dispatchEvent("error");
  await expect(pair.getByRole("alert")).toContainText(t.qrError);
  await expect(link).toHaveAttribute("href", old!);
  await pair.getByRole("button", { name: t.renewInvite, exact: true }).click();
  await expect(pair.locator("img")).toBeVisible();
  await expect(link).not.toHaveAttribute("href", old!);
});
