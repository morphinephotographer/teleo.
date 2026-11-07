import { prepareReader } from "./helpers";
import { test, expect, type Page } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
import { remoteValue, closeRemoteValue, chooseSelect } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "CF-Connecting-IP": crypto.randomUUID() });
  await page.addInitScript(() =>
    sessionStorage.setItem("teleo.intro.seen.v1", "true"),
  );
});
async function create(page: Page, locale: "en" | "uk" | "ru" = "en") {
  const t = dictionaries[locale];
  await page.goto("/studio?lang=" + locale);
  await page
    .getByRole("button", { name: t.newScript, exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: t.title, exact: true })
    .fill("A clear voice");
  await page
    .getByRole("textbox", { name: t.body, exact: true })
    .fill(
      "Here you can write, edit and immediately see how the text will look while recording.\n\nAdjust the text size, line spacing and width — and press Play.\n\n".repeat(
        20,
      ),
    );
  await page.getByRole("textbox", { name: t.body, exact: true }).blur();
  await page
    .getByRole("textbox", { name: t.body, exact: true })
    .evaluate((el) => {
      el.scrollTop = 0;
    });
}
for (const locale of ["en", "uk", "ru"] as const) {
  const t = dictionaries[locale];
  test(`${locale}: approved remote, private pairing, seek and host typography`, async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(90000);
    await create(page, locale);
    await page.getByRole("button", { name: t.read, exact: true }).click();
    await prepareReader(page, t);
    await page
      .locator("header")
      .getByRole("button", { name: t.remoteConnection, exact: true })
      .click();
    const pairing = page.getByRole("dialog", {
      name: t.remoteConnection,
      exact: true,
    });
    const invite = await pairing
      .getByRole("link", { name: t.invite, exact: true })
      .getAttribute("href");
    await expect(pairing.locator("img")).toBeVisible();
    await expect(pairing.getByText(t.pairLocal)).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/v06-${info.project.name}-${locale}-qr.png`,
      animations: "disabled",
    });
    await pairing
      .getByRole("checkbox", { name: t.allowPreview, exact: true })
      .uncheck();
    await pairing.getByRole("button", { name: t.close, exact: true }).click();
    await expect(pairing).not.toBeVisible();
    const context = await browser.newContext({
      locale,
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const phone = await context.newPage();
    await phone.addInitScript(() =>
      Object.defineProperty(navigator, "vibrate", {
        value: undefined,
        configurable: true,
      }),
    );
    const connections: {
      client: import("@playwright/test").WebSocketRoute;
      server: import("@playwright/test").WebSocketRoute;
    }[] = [];
    const sent: { id: string; command: { action: string } }[] = [],
      received: { type: string; id?: string; state?: unknown }[] = [];
    await phone.routeWebSocket("**/api/rooms/*", (client) => {
      const server = client.connectToServer();
      connections.push({ client, server });
      client.onMessage((message) => {
        const m = JSON.parse(String(message));
        if (m.type === "command") sent.push(m);
        server.send(message);
      });
      server.onMessage((message) => {
        const m = JSON.parse(String(message));
        received.push(m);
        client.send(message);
      });
    });
    async function ack(action: string, click: () => Promise<unknown>) {
      const before = sent.length;
      await click();
      await expect
        .poll(() => sent.slice(before).some((m) => m.command.action === action))
        .toBe(true);
      const id = sent
        .slice(before)
        .find((m) => m.command.action === action)!.id;
      await expect
        .poll(() => received.some((m) => m.type === "ack" && m.id === id))
        .toBe(true);
    }
    await phone.goto(invite!);
    await expect(pairing).not.toBeVisible();
    await expect(phone.locator(".remote-connection")).toContainText(
      t.connected,
    );
    expect(received.some((m) => m.type === "previewContent")).toBe(false);
    await expect(
      phone.getByRole("heading", { name: t.previewPrivate, exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/v06-${info.project.name}-${locale}-paired.png`,
      animations: "disabled",
    });
    await page
      .locator("header")
      .getByRole("button", { name: t.remoteConnection, exact: true })
      .click();
    await pairing
      .getByRole("checkbox", { name: t.allowPreview, exact: true })
      .check();
    await expect(phone.locator(".remote-text")).toContainText(
      "Here you can write",
    );
    await pairing.getByRole("button", { name: t.close, exact: true }).click();
    await expect(
      phone.getByRole("button", { name: t.advancedSettings, exact: true }),
    ).toHaveCount(1);
    await expect(
      phone.getByRole("group", { name: t.remoteTabs, exact: true }),
    ).toHaveCount(0);
    await expect
      .poll(() => phone.locator(".paragraph-markers i").count())
      .toBeGreaterThan(0);
    if (locale === "en")
      await expect(phone).toHaveScreenshot("approved-remote-closed.png", {
        animations: "disabled",
      });
    await phone.screenshot({
      path: `docs/screenshots/v06-${info.project.name}-${locale}-remote-closed.png`,
      animations: "disabled",
    });
    await ack("speedUp", () =>
      phone.getByRole("button", { name: t.speedUp, exact: true }).click(),
    );
    await expect(phone.locator(".remote-speed")).toHaveText("1.1×");
    await ack("speedDown", () =>
      phone.getByRole("button", { name: t.speedDown, exact: true }).click(),
    );
    await expect(phone.locator(".remote-speed")).toHaveText("1.0×");
    await ack("play", () =>
      phone.getByRole("button", { name: t.play, exact: true }).click(),
    );
    await expect(
      page
        .locator(".reader")
        .getByRole("button", { name: t.pause, exact: true }),
    ).toBeVisible();
    await ack("nextParagraph", () =>
      phone.getByRole("button", { name: t.nextParagraph, exact: true }).click(),
    );
    await expect(
      phone.getByRole("button", { name: t.pause, exact: true }),
    ).toBeVisible();
    await ack("seek", () =>
      phone
        .getByRole("slider", { name: t.position, exact: true })
        .press("Home"),
    );
    await expect(
      phone.getByRole("button", { name: t.pause, exact: true }),
    ).toBeVisible();
    await phone
      .getByRole("button", { name: t.quickSettings, exact: true })
      .click();
    await phone
      .locator(".remote-quick-menu")
      .getByRole("button", { name: t.close, exact: true })
      .click();
    await expect(
      phone.getByRole("button", { name: t.pause, exact: true }),
    ).toBeVisible();
    await page
      .locator(".reader")
      .getByRole("button", { name: t.pause, exact: true })
      .click();
    await expect(
      phone.getByRole("button", { name: t.play, exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Space");
    await expect(
      phone.getByRole("button", { name: t.pause, exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Space");
    await expect(
      phone.getByRole("button", { name: t.play, exact: true }),
    ).toBeVisible();
    const timeline = phone.getByRole("slider", {
      name: t.position,
      exact: true,
    });
    await ack("seek", () => timeline.press("End"));
    await expect(timeline).toHaveValue("1000");
    await ack("seek", () => timeline.press("Home"));
    await expect(timeline).toHaveValue("0");
    const box = (await timeline.boundingBox())!;
    await ack("seek", async () => {
      await phone.mouse.move(box.x + 4, box.y + box.height / 2);
      await phone.mouse.down();
      await phone.mouse.move(box.x + box.width * 0.55, box.y + box.height / 2, {
        steps: 10,
      });
      await phone.screenshot({
        path: `docs/screenshots/v06-${info.project.name}-${locale}-scrub.png`,
        animations: "disabled",
      });
      await phone.mouse.up();
    });
    await expect
      .poll(async () =>
        Number(
          await page
            .getByRole("slider", { name: t.position, exact: true })
            .inputValue(),
        ),
      )
      .toBeGreaterThan(100);
    await expect
      .poll(async () =>
        Number(
          await phone
            .locator(".remote-text [aria-current=true]")
            .getAttribute("data-preview-paragraph"),
        ),
      )
      .toBeGreaterThan(0);
    await ack("seek", () => timeline.press("Home"));
    await phone
      .getByRole("button", { name: t.quickSettings, exact: true })
      .click();
    const quick = phone.locator(".remote-quick-menu");
    await expect(quick.getByRole("slider")).toHaveCount(3);
    await phone.screenshot({
      path: `docs/screenshots/approved-${info.project.name}-${locale}-quick.png`,
    });
    await quick.getByRole("button", { name: t.close, exact: true }).click();
    for (const [key, value] of [
      ["fontSize", "68"],
      ["lineHeight", "1.5"],
      ["textWidth", "1300"],
    ] as const) {
      const slider = await remoteValue(phone, t, key);
      await ack("setPreference", async () => {
        await slider.fill(value);
        await slider.blur();
      });
      await expect(slider).toHaveValue(value);
      await closeRemoteValue(phone, t);
    }
    await expect(page.locator(".reader article")).toHaveCSS(
      "font-size",
      "68px",
    );
    await phone
      .getByRole("button", { name: t.advancedSettings, exact: true })
      .click();
    const settings = phone.locator(".remote-settings-page");
    await ack("setPreference", () =>
      settings
        .getByRole("checkbox", { name: t.mirrorHorizontal, exact: true })
        .click(),
    );
    await expect(page.locator(".reader article")).toHaveCSS(
      "transform",
      "matrix(-1, 0, 0, 1, 0, 0)",
    );
    await expect(settings.locator(".remote-settings-content")).toHaveCSS(
      "overflow-y",
      "auto",
    );
    await settings
      .getByText(t.hapticsUnavailable, { exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      settings.getByText(t.hapticsUnavailable, { exact: true }),
    ).toBeInViewport();
    await expect(
      settings.getByRole("button", { name: t.back, exact: true }),
    ).toBeInViewport();
    await settings.locator(".remote-settings-content").evaluate((el) => {
      el.scrollTop = 0;
    });
    await phone.screenshot({
      path: `docs/screenshots/approved-${info.project.name}-${locale}-settings.png`,
    });
    await settings.getByRole("button", { name: t.back, exact: true }).click();
    for (const size of [
      { width: 375, height: 667 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await phone.setViewportSize(size);
      await expect(
        phone.getByRole("button", { name: t.play, exact: true }),
      ).toBeInViewport();
      await expect(timeline).toBeInViewport();
      await expect(
        phone.getByRole("button", { name: t.nextParagraph, exact: true }),
      ).toBeInViewport();
      expect(
        await phone.evaluate(
          () =>
            document.documentElement.scrollWidth <= innerWidth &&
            document.documentElement.scrollHeight <= innerHeight,
        ),
      ).toBe(true);
      if (locale === "en") {
        await phone.screenshot({
          path: `docs/screenshots/v06-${info.project.name}-phone-${size.width}x${size.height}.png`,
          animations: "disabled",
        });
        await phone
          .getByRole("button", { name: t.quickSettings, exact: true })
          .click();
        await expect(quick).toBeInViewport();
        await expect(quick.getByRole("slider")).toHaveCount(3);
        await quick
          .locator(".alignment-control > button")
          .last()
          .scrollIntoViewIfNeeded();
        await expect(
          quick.locator(".alignment-control > button").last(),
        ).toBeInViewport();
        await phone.screenshot({
          path: `docs/screenshots/v06-${info.project.name}-quick-${size.width}x${size.height}.png`,
          animations: "disabled",
        });
        await quick.getByRole("button", { name: t.close, exact: true }).click();
      }
    }
    await phone.setViewportSize({ width: 390, height: 844 });
    await connections[0].client.close({
      code: 1012,
      reason: "QA interruption",
    });
    await expect(phone.locator(".remote-connection")).toContainText(
      t.reconnecting,
    );
    expect(await phone.locator(".remote-text").innerText()).not.toContain(
      "Here you can write",
    );
    await expect(phone.locator(".remote-connection")).toContainText(
      t.connected,
    );
    await expect(phone.locator(".remote-text")).toContainText(
      "Here you can write",
    );
    const resumedFont = await remoteValue(phone, t, "fontSize");
    await expect(resumedFont).toHaveValue("68");
    await closeRemoteValue(phone, t);
    await page
      .locator("header")
      .getByRole("button", { name: t.remoteConnection, exact: true })
      .click();
    await pairing
      .getByRole("checkbox", { name: t.allowPreview, exact: true })
      .uncheck();
    await expect(
      phone.getByRole("heading", { name: t.previewPrivate, exact: true }),
    ).toBeVisible();
    await pairing.getByRole("button", { name: t.revoke, exact: true }).click();
    await expect(phone.locator(".remote-connection")).toContainText(
      t.disconnected,
    );
    await expect(
      phone.getByRole("button", { name: t.play, exact: true }),
    ).toBeDisabled();
    await phone.screenshot({
      path: `docs/screenshots/v06-${info.project.name}-${locale}-disconnected.png`,
      animations: "disabled",
    });
    await context.close();
  });
  test(`${locale}: custom folder dialogs, toolbar and shared menu alignment`, async ({
    page,
  }, info) => {
    await create(page, locale);
    if (!(await page.locator(".library").isVisible()))
      await page
        .locator("header")
        .getByRole("button", { name: t.library, exact: true })
        .click();
    await page.getByRole("button", { name: t.newFolder, exact: true }).click();
    let dialog = page.getByRole("dialog", { name: t.newFolder, exact: true });
    await expect(dialog.getByRole("textbox")).toBeFocused();
    await dialog.getByRole("button", { name: t.create, exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText(t.nameRequired);
    await dialog.getByRole("textbox").fill("Collection");
    await page.screenshot({
      path: `docs/screenshots/v06-${info.project.name}-${locale}-folder-dialog.png`,
      animations: "disabled",
    });
    await dialog.getByRole("textbox").press("Enter");
    await expect(dialog).not.toBeVisible();
    await page.getByRole("button", { name: t.newFolder, exact: true }).click();
    dialog = page.getByRole("dialog", { name: t.newFolder, exact: true });
    await dialog.getByRole("textbox").fill(" collection ");
    await dialog.getByRole("textbox").press("Enter");
    await expect(dialog.getByRole("alert")).toHaveText(t.duplicateName);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: t.newFolder, exact: true }),
    ).toBeFocused();
    const trigger = page
      .locator("header")
      .getByRole("combobox", { name: t.language, exact: true });
    await trigger.click();
    const id = await trigger.getAttribute("aria-controls");
    await expect(page.locator(`[id="${id}"]`)).toBeVisible();
    await expect(trigger.locator(".picker-chevron")).toHaveCount(0);
    const center = await trigger.evaluate((el) => {
      const a = el.getBoundingClientRect(),
        b = el.querySelector("span")!.getBoundingClientRect();
      return Math.abs(a.y + a.height / 2 - b.y - b.height / 2);
    });
    expect(center).toBeLessThan(1);
    await page.screenshot({
      path: `docs/screenshots/v06-${info.project.name}-${locale}-language.png`,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await chooseSelect(
      page.getByRole("combobox", { name: t.folder, exact: true }),
      await page
        .getByRole("combobox", { name: t.folder, exact: true })
        .evaluate((el) =>
          el.tagName === "SELECT"
            ? (el as HTMLSelectElement).options[1].value
            : "",
        )
        .then(async (value) => {
          if (value) return value;
          const el = page.getByRole("combobox", {
            name: t.folder,
            exact: true,
          });
          await el.click();
          const id = await el.getAttribute("aria-controls");
          const v = await page
            .locator(`[id="${id}"]`)
            .getByRole("option", { name: "Collection", exact: true })
            .getAttribute("data-value");
          await page.keyboard.press("Escape");
          return v!;
        }),
    );
    await page
      .getByRole("button", { name: t.renameFolder, exact: true })
      .click();
    dialog = page.getByRole("dialog", { name: t.renameFolder, exact: true });
    await dialog.getByRole("textbox").fill("Renamed");
    await dialog.getByRole("textbox").press("Enter");
    await page
      .getByRole("button", { name: t.deleteFolder, exact: true })
      .click();
    dialog = page.getByRole("dialog", { name: t.deleteFolder, exact: true });
    await dialog.getByRole("button", { name: t.confirm, exact: true }).click();
    await expect(page.locator(".script-list button")).toHaveCount(1);
    await page
      .locator(".library")
      .getByRole("button", { name: t.closeLibrary, exact: true })
      .click();
    const actions = page.getByRole("toolbar", {
      name: t.documentActions,
      exact: true,
    });
    await expect(actions.getByRole("button")).toHaveCount(5);
    const rows = await actions
      .getByRole("button")
      .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().top));
    expect(Math.max(...rows) - Math.min(...rows)).toBeLessThan(1);
    for (const action of await actions.getByRole("button").all()) {
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeInViewport();
    }
    await actions.evaluate((el) => {
      el.scrollLeft = 0;
    });
    await page.screenshot({
      path: `docs/screenshots/v06-${info.project.name}-${locale}-studio.png`,
      animations: "disabled",
    });
    await actions.getByRole("button", { name: t.delete, exact: true }).click();
    dialog = page.getByRole("dialog", { name: t.confirmDelete, exact: true });
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("textbox", { name: t.body, exact: true }),
    ).toHaveValue(/Here you can write/);
  });
}

test("empty/edited script, stale target, private control and persisted typography", async ({
  page,
  browser,
}) => {
  await create(page);
  const t = dictionaries.en;
  await page.getByRole("textbox", { name: t.body, exact: true }).fill("");
  await page
    .locator("header")
    .getByRole("button", { name: t.remoteConnection, exact: true })
    .click();
  const pair = page.getByRole("dialog", {
    name: t.remoteConnection,
    exact: true,
  });
  const invite = await pair
    .getByRole("link", { name: t.invite, exact: true })
    .getAttribute("href");
  await page.keyboard.press("Escape");
  await expect(pair).not.toBeVisible();
  const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
    }),
    phone = await context.newPage();
  let server: import("@playwright/test").WebSocketRoute;
  let target = "";
  const acks: string[] = [];
  await phone.routeWebSocket("**/api/rooms/*", (client) => {
    server = client.connectToServer();
    server.onMessage((message) => {
      const m = JSON.parse(String(message));
      if (m.state?.controls) target = m.state.controls.target;
      if (m.type === "ack") acks.push(m.id);
      client.send(message);
    });
  });
  await phone.goto(invite!);
  await expect(phone.locator(".remote-connection")).toHaveText(t.connected);
  await expect(pair).not.toBeVisible();
  await expect(
    phone.getByRole("slider", { name: t.position, exact: true }),
  ).toBeDisabled();
  await expect(phone.locator(".timeline-time")).toHaveText("00:00−00:00");
  await expect.poll(() => target).not.toBe("");
  const oldTarget = target;
  await page
    .getByRole("textbox", { name: t.body, exact: true })
    .fill("A newly edited script.\n\nAnother real paragraph.");
  await expect.poll(() => target).not.toBe(oldTarget);
  const id = crypto.randomUUID();
  server!.send(
    JSON.stringify({
      type: "command",
      id,
      command: {
        action: "setPreference",
        target: oldTarget,
        key: "fontSize",
        value: 99,
      },
    }),
  );
  await expect.poll(() => acks.includes(id)).toBe(true);
  const font = await remoteValue(phone, t, "fontSize");
  await expect(font).toHaveValue("40");
  await font.fill("68");
  await font.blur();
  await expect(font).toHaveValue("68");
  await expect(
    page.getByRole("textbox", { name: t.body, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: t.saved }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: t.read, exact: true }).click();
  await prepareReader(page, t);
  await expect(page.locator(".reader article")).toHaveCSS("font-size", "68px");
  await context.close();
});

test("JSON import/export validation, centered import and folder associations survive deletion", async ({
  page,
}, info) => {
  await create(page);
  const t = dictionaries.en;
  if (!(await page.locator(".library").isVisible()))
    await page
      .locator("header")
      .getByRole("button", { name: t.library, exact: true })
      .click();
  const input = page.locator("input[type=file]");
  await input.setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByRole("alert")).toContainText(t.invalidImport);
  await page
    .getByRole("alert")
    .getByRole("button", { name: t.close, exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: t.body, exact: true }),
  ).toHaveValue(/Here you can write/);
  const { createScript, exportBundle } =
    await import("../../packages/protocol/domain");
  await input.setInputFiles({
    name: "script.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      exportBundle([
        createScript(
          "JSON import",
          "Imported text.\n\nKeep this association safe.",
        ),
      ]),
    ),
  });
  await expect(
    page.getByRole("textbox", { name: t.title, exact: true }),
  ).toHaveValue("JSON import");
  if (!(await page.locator(".library").isVisible()))
    await page
      .locator("header")
      .getByRole("button", { name: t.library, exact: true })
      .click();
  const centered = await page.locator(".file-button").evaluate((el) => {
    const box = el.getBoundingClientRect(),
      range = document.createRange();
    range.selectNode(el.firstChild!);
    const label = range.getBoundingClientRect();
    return {
      x: Math.abs(label.x + label.width / 2 - box.x - box.width / 2),
      y: Math.abs(label.y + label.height / 2 - box.y - box.height / 2),
    };
  });
  expect(centered.x).toBeLessThan(2);
  expect(centered.y).toBeLessThan(2);
  await page.screenshot({
    path: `docs/screenshots/v06-${info.project.name}-import.png`,
    animations: "disabled",
  });
  await page.getByRole("button", { name: t.newFolder, exact: true }).click();
  let dialog = page.getByRole("dialog", { name: t.newFolder, exact: true });
  await dialog.getByRole("textbox").fill("Archive");
  await dialog.getByRole("textbox").press("Enter");
  const filter = page.getByRole("combobox", { name: t.folder, exact: true });
  await filter.click();
  const id = await filter.getAttribute("aria-controls");
  const folderId = (await page
    .locator(`[id="${id}"]`)
    .getByRole("option", { name: "Archive", exact: true })
    .getAttribute("data-value"))!;
  await page.keyboard.press("Escape");
  await page
    .locator(".library")
    .getByRole("button", { name: t.closeLibrary, exact: true })
    .click();
  await chooseSelect(
    page.getByRole("combobox", { name: t.scriptFolder, exact: true }),
    folderId,
  );
  await page
    .locator("header")
    .getByRole("button", { name: t.library, exact: true })
    .click();
  await chooseSelect(
    page.getByRole("combobox", { name: t.folder, exact: true }),
    folderId,
  );
  await expect(page.locator(".script-list button")).toHaveCount(1);
  await page.getByRole("button", { name: t.deleteFolder, exact: true }).click();
  dialog = page.getByRole("dialog", { name: t.deleteFolder, exact: true });
  await dialog.getByRole("button", { name: t.confirm, exact: true }).click();
  await expect(page.locator(".script-list button")).toHaveCount(2);
  await page
    .locator(".library")
    .getByRole("button", { name: t.closeLibrary, exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: t.scriptFolder, exact: true }),
  ).toContainText(t.noFolder);
  const download = page.waitForEvent("download");
  await page
    .getByRole("toolbar")
    .getByRole("button", { name: t.exportJSON, exact: true })
    .click();
  const file = await download;
  const { readFile } = await import("node:fs/promises");
  const bundle = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(bundle.version).toBe(1);
  expect(bundle.scripts[0].body).toBe(
    "Imported text.\n\nKeep this association safe.",
  );
  await page.reload();
  const selector = page
    .locator("header")
    .getByRole("combobox", { name: t.currentScript, exact: true });
  await selector.click();
  const listId = await selector.getAttribute("aria-controls");
  await page
    .locator(`[id="${listId}"]`)
    .getByRole("option", { name: "JSON import", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: t.body, exact: true }),
  ).toHaveValue("Imported text.\n\nKeep this association safe.");
});

// Explicit fixture preference for legacy translated scenarios; v07.spec tests fresh autodetection.
test.beforeEach(async ({ page }, info) => {
  const locale = /^(en|uk|ru):/.exec(info.title)?.[1];
  if (locale)
    await page.addInitScript((value) => {
      if (!localStorage.getItem("teleo.locale"))
        localStorage.setItem("teleo.locale", value);
    }, locale);
});

// Legacy scenarios start with their intended empty workspace; onboarding has its own fresh-install suite.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("teleo.demo.auto"))
      localStorage.setItem("teleo.demo.auto", "false");
  });
});
