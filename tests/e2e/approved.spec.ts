import { test, expect } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
import {
  openSettings,
  closeSettings,
  chooseSelect,
  remoteValue,
  closeRemoteValue,
  setTimer,
} from "./helpers";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("teleo.intro.seen.v1", "true"),
  );
  await page.setExtraHTTPHeaders({ "CF-Connecting-IP": crypto.randomUUID() });
});
for (const locale of ["en", "uk", "ru"] as const)
  test(`${locale}: approved four screens, operational dock and synchronization`, async ({
    page,
    browser,
  }, info) => {
    const t = dictionaries[locale];
    await page.goto("/studio?lang=" + locale);
    await page
      .getByRole("button", { name: t.newScript, exact: true })
      .first()
      .click();
    await page
      .getByRole("textbox", { name: t.body, exact: true })
      .fill(
        "A calm voice.\n\nA second paragraph for the audience.\n\n".repeat(50),
      );
    await expect(page.locator(".app-menu")).toHaveCount(0);
    const dock = page.locator(".reader-controls");
    const width = await dock
      .getByRole("slider", { name: t.textWidth, exact: true })
      .boundingBox();
    const timer = await dock
      .getByRole("button", { name: t.timer, exact: true })
      .boundingBox();
    const alignment = await dock
      .getByRole("combobox", { name: t.alignment, exact: true })
      .boundingBox();
    expect(width && timer && alignment).toBeTruthy();
    // DOM order remains stable even where responsive rows wrap.
    expect(
      await dock.evaluate((el) => {
        const a = el.querySelector(".typography-group"),
          b = el.querySelector(".dock-timer"),
          c = el.querySelector(".dock-alignment");
        return (
          !!a &&
          !!b &&
          !!c &&
          !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) &&
          !!(b.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING)
        );
      }),
    ).toBe(true);
    await expect(
      dock.getByRole("button", { name: t.timer, exact: true }),
    ).toHaveText("");
    await setTimer(page, t, 3);
    await setTimer(page, t, 0);
    await dock
      .getByRole("slider", { name: t.fontSize, exact: true })
      .fill("52");
    await dock
      .getByRole("slider", { name: t.lineHeight, exact: true })
      .fill("1.5");
    await dock
      .getByRole("slider", { name: t.textWidth, exact: true })
      .fill("1300");
    await chooseSelect(
      dock.getByRole("combobox", { name: t.alignment, exact: true }),
      "left",
    );
    await dock.getByRole("button", { name: t.play, exact: true }).click();
    await expect(page.locator(".reader")).toBeVisible();
    await page
      .locator(".reader-controls")
      .getByRole("button", { name: t.pause, exact: true })
      .click();
    await expect(page.locator(".reader article")).toHaveCSS(
      "font-size",
      "52px",
    );
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
    await expect(pair.getByText(t.localPairingOnly)).toBeVisible();
    await expect(pair.locator("img")).toHaveCount(0);
    await page.screenshot({
      path: `docs/screenshots/approved-${info.project.name}-${locale}-pairing.png`,
    });
    await pair.getByRole("button", { name: t.close, exact: true }).click();
    const appearance = await openSettings(page, t, "appearance");
    await appearance
      .getByRole("group", { name: t.interfaceTheme, exact: true })
      .getByRole("button", { name: t.dark, exact: true })
      .click();
    await closeSettings(page, t);
    await page
      .locator("header")
      .getByRole("button", { name: t.remoteConnection, exact: true })
      .click();
    await page.screenshot({
      path: `docs/screenshots/approved-${info.project.name}-${locale}-pairing-dark.png`,
    });
    const context = await browser.newContext({
      locale,
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const phone = await context.newPage();
    const errors: string[] = [];
    phone.on("pageerror", (e) => errors.push(e.message));
    await phone.goto(invite!);
    await pair.getByRole("button", { name: t.allow, exact: true }).click();
    await expect(pair).not.toBeVisible();
    await page
      .locator("header")
      .getByRole("button", { name: t.remoteConnection, exact: true })
      .click();
    await pair
      .getByRole("checkbox", { name: t.allowPreview, exact: true })
      .click();
    await pair.getByRole("button", { name: t.close, exact: true }).click();
    await expect(phone.locator(".remote-text")).toContainText("A calm voice.");
    await phone.screenshot({
      path: `docs/screenshots/approved-${info.project.name}-${locale}-01-main.png`,
    });
    await phone.locator(".remote-quick-trigger").click();
    const quick = phone.locator(".remote-quick-menu");
    await expect(quick.locator(".remote-list > button")).toHaveCount(6);
    await expect(quick.locator(".remote-list > button")).toHaveText([
      t.timer,
      t.showText,
      t.mirror,
      t.focus,
      t.fullscreen,
      t.connection,
    ]);
    await phone.screenshot({
      path: `docs/screenshots/approved-${info.project.name}-${locale}-02-quick.png`,
    });
    await quick.getByRole("button", { name: t.showText, exact: true }).click();
    await quick.getByRole("button", { name: t.close, exact: true }).click();
    await expect(phone.locator(".remote-text")).toContainText(t.textHidden);
    await phone.locator(".remote-quick-trigger").click();
    await quick.getByRole("button", { name: t.showText, exact: true }).click();
    await quick.getByRole("button", { name: t.close, exact: true }).click();
    for (const key of ["mirror", "focus", "connection"] as const) {
      await phone.locator(".remote-quick-trigger").click();
      await quick.getByRole("button", { name: t[key], exact: true }).click();
      const detail = phone.locator(".remote-settings-page");
      if (key === "connection")
        await expect(
          detail.getByRole("button", { name: t.revoke, exact: true }),
        ).toBeVisible();
      else await expect(detail.getByRole("checkbox")).toHaveCount(2);
      await detail.getByRole("button", { name: t.back, exact: true }).click();
      await detail.getByRole("button", { name: t.back, exact: true }).click();
    }
    await phone.evaluate(() =>
      Object.defineProperty(document, "fullscreenEnabled", {
        value: false,
        configurable: true,
      }),
    );
    for (const enabled of [true, false]) {
      await phone.locator(".remote-quick-trigger").click();
      await quick
        .getByRole("button", { name: t.fullscreen, exact: true })
        .click();
      if (enabled)
        await expect(phone.locator(".controller")).toHaveClass(/viewport-fill/);
      else
        await expect(phone.locator(".controller")).not.toHaveClass(
          /viewport-fill/,
        );
    }
    await phone
      .getByRole("button", { name: t.advancedSettings, exact: true })
      .click();
    const settings = phone.locator(".remote-settings-page");
    await expect(settings.getByRole("heading", { level: 3 })).toHaveText([
      t.textSettings,
      t.playbackTab,
      t.displaySettings,
      t.connection,
    ]);
    await phone.screenshot({
      path: `docs/screenshots/approved-${info.project.name}-${locale}-03-settings.png`,
    });
    await settings
      .getByRole("checkbox", { name: t.mirrorVertical, exact: true })
      .click();
    await expect(page.locator(".reader article")).toHaveCSS(
      "transform",
      "matrix(1, 0, 0, -1, 0, 0)",
    );
    await settings
      .getByRole("checkbox", { name: t.focus, exact: true })
      .click();
    const guide = settings.getByRole("checkbox", {
      name: t.focusLine,
      exact: true,
    });
    if (!(await guide.isChecked())) await guide.click();
    await expect(guide).toBeChecked();
    await expect(page.locator(".reading-viewport")).toHaveClass(
      /dim-surroundings/,
    );
    await settings.getByRole("button").filter({ hasText: t.timer }).click();
    await expect(settings.locator(".timer-options button")).toHaveCount(4);
    await settings
      .locator(".timer-options button")
      .filter({ hasText: `3 ${t.seconds}` })
      .click();
    await expect(
      settings
        .locator(".timer-options button")
        .filter({ hasText: `3 ${t.seconds}` }),
    ).toHaveAttribute("aria-pressed", "true");
    await phone.screenshot({
      path: `docs/screenshots/approved-${info.project.name}-${locale}-04-timer.png`,
    });
    await settings.getByRole("button", { name: t.back, exact: true }).click();
    await settings.getByRole("button", { name: t.back, exact: true }).click();
    await phone.getByRole("button", { name: t.play, exact: true }).click();
    await expect(page.locator(".countdown")).toBeVisible();
    await expect(page.locator(".countdown")).not.toBeVisible({ timeout: 5000 });
    await phone.getByRole("button", { name: t.pause, exact: true }).click();
    const font = await remoteValue(phone, t, "fontSize");
    await font.fill("68");
    await font.blur();
    await expect(font).toHaveValue("68");
    await expect(page.locator(".reader article")).toHaveCSS(
      "font-size",
      "68px",
    );
    await closeRemoteValue(phone, t);
    expect(errors).toEqual([]);
    await context.close();
  });
test("expired invitation clears QR/link and renewal allocates a fresh invite", async ({
  page,
}) => {
  const t = dictionaries.en;
  await page.clock.install();
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
  const old = await pair
    .getByRole("link", { name: t.invite, exact: true })
    .getAttribute("href");
  await page.clock.runFor(120001);
  await expect(pair).toContainText(t.expired);
  await expect(pair.getByRole("link")).toHaveCount(0);
  await pair.getByRole("button", { name: t.reconnect, exact: true }).click();
  await expect(
    pair.getByRole("link", { name: t.invite, exact: true }),
  ).not.toHaveAttribute("href", old!);
});
test("room creation failure is reported as unreachable without a stale invitation", async ({
  page,
}) => {
  const t = dictionaries.en;
  await page.route("**/api/rooms", (r) => r.abort("connectionrefused"));
  await page.goto("/studio?lang=en");
  await page
    .getByRole("button", { name: t.newScript, exact: true })
    .first()
    .click();
  await page
    .locator("header")
    .getByRole("button", { name: t.remoteConnection, exact: true })
    .click();
  await expect(page.locator(".pairing-sheet")).toContainText(
    t.serverUnreachable,
  );
  await expect(page.locator(".pairing-sheet a")).toHaveCount(0);
});

test("a queued typography gesture is cancelled when the host switches scripts", async ({
  page,
  browser,
}) => {
  const t = dictionaries.en;
  await page.goto("/studio?lang=en");
  await page
    .getByRole("button", { name: t.newScript, exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: t.title, exact: true })
    .fill("Script A");
  await page
    .getByRole("textbox", { name: t.body, exact: true })
    .fill("Paragraph A.\n\n".repeat(100));
  await page
    .locator(".reader-controls")
    .getByRole("slider", { name: t.fontSize, exact: true })
    .fill("68");
  if (!(await page.locator(".library").isVisible()))
    await page
      .locator("header")
      .getByRole("button", { name: t.library, exact: true })
      .click();
  await page
    .locator(".library")
    .getByRole("button", { name: t.newScript, exact: true })
    .click();
  await page
    .getByRole("textbox", { name: t.title, exact: true })
    .fill("Script B");
  await page
    .getByRole("textbox", { name: t.body, exact: true })
    .fill("Paragraph B.\n\n".repeat(100));
  await page.getByRole("button", { name: t.read, exact: true }).click();
  await page
    .locator("header")
    .getByRole("button", { name: t.remoteConnection, exact: true })
    .click();
  const pair = page.locator(".pairing-sheet");
  const invite = await pair
    .getByRole("link", { name: t.invite, exact: true })
    .getAttribute("href");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const phone = await context.newPage();
  await phone.goto(invite!);
  await pair.getByRole("button", { name: t.allow, exact: true }).click();
  const font = await remoteValue(phone, t, "fontSize");
  await expect(font).toHaveValue("40");
  await phone.clock.install();
  await phone.clock.pauseAt(new Date());
  await font.fill("99");
  const selector = page
    .locator("header")
    .getByRole("combobox", { name: t.currentScript, exact: true });
  await selector.click();
  const id = await selector.getAttribute("aria-controls");
  await page
    .locator(`[id="${id}"]`)
    .getByRole("option", { name: "Script A", exact: true })
    .click();
  await expect(font).toHaveValue("68");
  await phone.clock.runFor(500);
  await expect(font).toHaveValue("68");
  await expect(page.locator(".reader article")).toHaveCSS("font-size", "68px");
  await context.close();
});
