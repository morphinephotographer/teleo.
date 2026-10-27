import { test, expect, type Page, type Locator } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
import {
  chooseSelect,
  setTimer,
  openSettings,
  closeSettings,
  managePhone,
} from "./helpers";
const staging = process.env.TELEO_V031_URL;
test.beforeEach(async ({ page }) => {
  if (!staging)
    await page.setExtraHTTPHeaders({ "CF-Connecting-IP": crypto.randomUUID() });
  await page.addInitScript(() =>
    sessionStorage.setItem("teleo.intro.seen.v1", "true"),
  );
});
async function create(page: Page, locale = "en") {
  const t = dictionaries[locale as keyof typeof dictionaries];
  await page.goto((staging || "") + "/studio?lang=" + locale);
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
      "First paragraph for a clear voice.\n\nSecond paragraph with a steady rhythm.\n\nThird paragraph, one thought at a time.\n\n".repeat(
        30,
      ),
    );
  await page.getByRole("textbox", { name: t.body, exact: true }).blur();
  await page
    .getByRole("textbox", { name: t.body, exact: true })
    .evaluate((el) => {
      el.scrollTop = 0;
    });
}
async function popup(trigger: Locator) {
  await trigger.click();
  const id = await trigger.getAttribute("aria-controls");
  const menu = trigger.page().locator(`[id="${id}"]`);
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS("opacity", "1");
  const box = (await menu.boundingBox())!;
  const bounds = await trigger.page().evaluate(() => ({
    width: visualViewport?.width || innerWidth,
    height: visualViewport?.height || innerHeight,
    x: visualViewport?.offsetLeft || 0,
    y: visualViewport?.offsetTop || 0,
  }));
  expect(box.x).toBeGreaterThanOrEqual(bounds.x);
  expect(box.y).toBeGreaterThanOrEqual(bounds.y);
  expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
  return menu;
}
async function byLabel(trigger: Locator, label: string, capture?: string) {
  const menu = await popup(trigger);
  if (capture)
    await trigger.page().screenshot({ path: capture, animations: "disabled" });
  const value = (await menu
    .getByRole("option", { name: label, exact: true })
    .getAttribute("data-value"))!;
  await menu.getByRole("option", { name: label, exact: true }).click();
  await expect(menu).not.toBeVisible();
  return value;
}
for (const locale of ["en", "uk", "ru"] as const) {
  const t = dictionaries[locale];
  test(`${locale}: every host picker and contextual menu selects and dismisses`, async ({
    page,
  }, info) => {
    await create(page, locale);
    const language = page
      .locator("header")
      .getByRole("combobox", { name: t.language, exact: true });
    let menu = await popup(language);
    expect(
      await menu
        .getByRole("option", { selected: true })
        .evaluate((el) => getComputedStyle(el).borderRadius),
    ).not.toBe("0px");
    await page.screenshot({
      animations: "disabled",
      path: `docs/screenshots/v06-${info.project.name}-${locale}-language-open.png`,
    });
    if (info.project.name === "desktop")
      await expect(page).toHaveScreenshot(`v06-language-${locale}.png`, {
        animations: "disabled",
        mask: [page.locator(".script-list small")],
        maxDiffPixelRatio: 0.005,
      });
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
    await expect(language).toBeFocused();
    await chooseSelect(language, locale);
    const library = page.locator(".library");
    if (!(await library.isVisible()))
      await page
        .locator("header")
        .getByRole("button", { name: t.library, exact: true })
        .click();
    await page.getByRole("button", { name: t.newFolder, exact: true }).click();
    const folderDialog = page.getByRole("dialog", {
      name: t.newFolder,
      exact: true,
    });
    await folderDialog.getByRole("textbox").fill("Collection");
    await folderDialog.getByRole("textbox").press("Enter");
    await expect(folderDialog).not.toBeVisible();
    const folder = page.getByRole("combobox", { name: t.folder, exact: true });
    const folderId = await byLabel(
      folder,
      "Collection",
      `docs/screenshots/v06-${info.project.name}-${locale}-folder-filter-open.png`,
    );
    // Editor folder is a separate, bottom-edge instance of the shared picker.
    if (info.project.name === "mobile")
      await page
        .getByRole("button", { name: t.closeLibrary, exact: true })
        .click();
    const assigned = page.getByRole("combobox", {
      name: t.scriptFolder,
      exact: true,
    });
    await popup(assigned);
    await page.screenshot({
      path: `docs/screenshots/v06-${info.project.name}-${locale}-assigned-folder-open.png`,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await chooseSelect(assigned, folderId);
    await chooseSelect(assigned, "");
    if (!(await library.isVisible()))
      await page
        .locator("header")
        .getByRole("button", { name: t.library, exact: true })
        .click();
    await chooseSelect(
      page.getByRole("combobox", { name: t.folder, exact: true }),
      "",
    );
    await library
      .getByRole("button", { name: t.newScript, exact: true })
      .click();
    await page
      .getByRole("textbox", { name: t.title, exact: true })
      .fill("Second document");
    await page.getByRole("textbox", { name: t.title, exact: true }).blur();
    await byLabel(
      page
        .locator("header")
        .getByRole("combobox", { name: t.currentScript, exact: true }),
      "A clear voice",
      `docs/screenshots/v06-${info.project.name}-${locale}-script-selector-open.png`,
    );
    expect(
      await page
        .getByRole("textbox", { name: t.body, exact: true })
        .inputValue(),
    ).toContain("First paragraph");
    await openSettings(page, t, "appearance");
    await closeSettings(page, t);
    await setTimer(page, t, 3);
    await setTimer(page, t, 0);
    const settings = await openSettings(page, t, "appearance");
    await settings.getByText(t.physical, { exact: true }).click();
    await popup(
      settings.getByRole("combobox", { name: t.profile, exact: true }),
    );
    await page.screenshot({
      path: `docs/screenshots/v06-${info.project.name}-${locale}-profile-open.png`,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await chooseSelect(
      settings.getByRole("combobox", { name: t.profile, exact: true }),
      "twoButton",
    );
    await expect(
      settings.getByRole("button", { name: t.learnA, exact: true }),
    ).toBeVisible();
    await chooseSelect(
      settings.getByRole("combobox", { name: t.profile, exact: true }),
      "custom",
    );
    const action = settings.getByRole("combobox", {
      name: t.custom,
      exact: true,
    });
    menu = await popup(action);
    await page.screenshot({
      animations: "disabled",
      path: `docs/screenshots/v06-${info.project.name}-${locale}-mapping-open.png`,
    });
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await expect(menu).not.toBeVisible();
    await chooseSelect(action, "speedUp");
    await chooseSelect(
      settings.getByRole("combobox", { name: t.profile, exact: true }),
      "standard",
    );
    await closeSettings(page, t);
    await expect(
      page
        .getByRole("toolbar", { name: t.documentActions, exact: true })
        .getByRole("button"),
    ).toHaveCount(5);
    await page.screenshot({
      animations: "disabled",
      path: `docs/screenshots/v06-${info.project.name}-${locale}-actions.png`,
    });
    await expect(page.locator(".app-menu")).toHaveCount(0);
    await page.goto("/help?lang=" + locale);
    await expect(
      page.getByRole("heading", { name: t.helpTitle, exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: t.launch, exact: true }).click();
    await expect(page.locator(".workspace")).toBeVisible();
  });
}
test("picker positioning at every required viewport; outside/Escape and dark sheet fallback", async ({
  page,
}, info) => {
  test.setTimeout(60000);
  await create(page);
  const t = dictionaries.en;
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 834, height: 1112 },
    { width: 390, height: 844 },
    { width: 375, height: 667 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    let menu = await popup(
      page
        .locator("header")
        .getByRole("combobox", { name: t.language, exact: true }),
    );
    await page.mouse.click(2, 2);
    await expect(menu).not.toBeVisible();
    await openSettings(page, t, "appearance");
    await closeSettings(page, t);
    const countdown = page.locator(".reader-controls").getByRole("combobox", {
      name: t.alignment,
      exact: true,
    });
    menu = await popup(countdown);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(menu).not.toBeVisible();
    if (await page.getByRole("dialog").isVisible()) {
      await countdown.click();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeVisible();
    }
    await closeSettings(page, t);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight &&
          document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/screenshots/v06-${info.project.name}-studio-${size.width}x${size.height}.png`,
      animations: "disabled",
    });
    if (info.project.name === "desktop" && [1440, 834].includes(size.width))
      await page.screenshot({
        animations: "disabled",
        path: `docs/screenshots/v06-${size.width}-studio.png`,
      });
    if (info.project.name === "desktop" && size.width === 834) {
      await page
        .locator(".library")
        .getByRole("button", { name: t.closeLibrary, exact: true })
        .click();
      await expect(
        page.getByRole("textbox", { name: t.body, exact: true }),
      ).toBeVisible();
      await page.screenshot({
        animations: "disabled",
        path: "docs/screenshots/v06-834-editor.png",
      });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: t.read, exact: true }).click();
  await page.evaluate(() =>
    Object.defineProperty(document, "fullscreenEnabled", {
      value: false,
      configurable: true,
    }),
  );
  await page
    .locator(".reader-controls")
    .getByRole("button", { name: t.fullscreen, exact: true })
    .click();
  const immersiveLanguage = page
    .locator(".reader-top")
    .getByRole("combobox", { name: t.language, exact: true });
  await expect(immersiveLanguage).toHaveCSS("color", "rgb(17, 17, 17)");
  const immersiveMenu = await popup(immersiveLanguage);
  await page.screenshot({
    animations: "disabled",
    path: `docs/screenshots/v06-${info.project.name}-immersive-menu.png`,
  });
  await page.keyboard.press("Escape");
  await expect(immersiveMenu).not.toBeVisible();
  await expect(page.locator(".reader")).toBeVisible();
  await chooseSelect(immersiveLanguage, "en");
  await page.getByRole("button", { name: t.exit, exact: true }).click();
  const darkSheet = await openSettings(page, t, "appearance");
  await darkSheet
    .getByRole("group", { name: t.interfaceTheme, exact: true })
    .getByRole("button", { name: t.dark, exact: true })
    .click();
  await closeSettings(page, t);
  const darkMenu = await popup(
    page
      .locator(".reader-controls")
      .getByRole("combobox", { name: t.alignment, exact: true }),
  );
  await expect(darkMenu).toHaveCSS("background-color", "rgb(36, 36, 38)");
  await page.screenshot({
    animations: "disabled",
    path: `docs/screenshots/v06-${info.project.name}-dark-settings-menu.png`,
  });
  await page.keyboard.press("Escape");
  await closeSettings(page, t);
  await page.evaluate(() => {
    Object.defineProperty(visualViewport!, "height", {
      configurable: true,
      value: 380,
    });
    visualViewport!.dispatchEvent(new Event("resize"));
  });
  const keyboardSheet = await openSettings(page, t, "playback");
  await keyboardSheet.getByText(t.physical, { exact: true }).click();
  const keyboardMenu = await popup(
    keyboardSheet.getByRole("combobox", { name: t.profile, exact: true }),
  );
  await page.keyboard.press("Escape");
  await expect(keyboardMenu).not.toBeVisible();
  await closeSettings(page, t);
  await page.evaluate(() => {
    delete (visualViewport as unknown as Record<string, unknown>).height;
    visualViewport!.dispatchEvent(new Event("resize"));
  });
  await page.addInitScript(() => {
    Object.defineProperty(HTMLElement.prototype, "showPopover", {
      value: undefined,
      configurable: true,
    });
  });
  await page.reload();
  const nativeLanguage = page
    .locator("header")
    .getByRole("combobox", { name: t.language, exact: true });
  expect(await nativeLanguage.evaluate((el) => el.tagName)).toBe("SELECT");
  await chooseSelect(nativeLanguage, "en");
  await page
    .locator(".reader-controls")
    .getByRole("button", { name: t.timer, exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: t.timer, exact: true }),
  ).toBeVisible();
  await page.getByRole("menuitem").filter({ hasText: t.off }).click();
  await page.goto("/help?lang=en");
  await expect(
    page.getByRole("heading", { name: t.helpTitle, exact: true }),
  ).toBeVisible();
});
for (const locale of ["en", "uk", "ru"] as const) {
  const t = dictionaries[locale];
  test(`${locale}: real private preview, round controls, revisions, revoke and reconnect`, async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(60000);
    await create(page, locale);
    await page.getByRole("button", { name: t.read, exact: true }).click();
    await page
      .locator(".reader")
      .getByRole("button", { name: t.connect, exact: true })
      .click();
    const invite = (await page
      .getByRole("link", { name: t.invite, exact: true })
      .getAttribute("href"))!;
    const context = await browser.newContext({
      locale,
      viewport: { width: 390, height: 844 },
    });
    const phone = await context.newPage();
    await phone.addInitScript(() =>
      Object.defineProperty(navigator, "vibrate", {
        value: undefined,
        configurable: true,
      }),
    );
    const transports: import("@playwright/test").WebSocketRoute[] = [];
    let holdResumes = false;
    let releaseResume: (() => void) | undefined;
    const received: Record<string, unknown>[] = [];
    const sent: { id: string; command: { action: string } }[] = [];
    // Observe the routed transport itself: routed WebSockets do not generate
    // native page websocket frame events. Forward every frame unchanged.
    await phone.routeWebSocket("**/api/rooms/*", async (client) => {
      transports.push(client);
      if (holdResumes)
        await new Promise<void>((resolve) => {
          releaseResume = resolve;
        });
      const server = client.connectToServer();
      client.onMessage((message) => {
        try {
          const m = JSON.parse(String(message));
          if (m.type === "command") sent.push(m);
        } catch {
          /* Non-JSON transport event. */
        }
        server.send(message);
      });
      server.onMessage((message) => {
        try {
          const m = JSON.parse(String(message));
          if (m.type?.startsWith("preview") || m.type === "ack")
            received.push(m);
        } catch {
          /* Non-JSON transport event. */
        }
        client.send(message);
      });
    });
    async function acknowledged(action: string, click: () => Promise<unknown>) {
      const start = sent.length;
      await click();
      await expect
        .poll(() => sent.slice(start).some((m) => m.command.action === action))
        .toBe(true);
      const command = sent
        .slice(start)
        .find((m) => m.command.action === action)!;
      await expect
        .poll(() =>
          received.some((m) => m.type === "ack" && m.id === command.id),
        )
        .toBe(true);
    }
    await phone.goto(invite);
    await page.getByRole("button", { name: t.allow, exact: true }).click();
    await expect(phone.locator(".remote-connection")).toHaveText(t.connected);
    await phone
      .getByRole("button", { name: t.advancedSettings, exact: true })
      .click();
    const languagePopup = await popup(
      phone
        .locator(".remote-advanced")
        .getByRole("combobox", { name: t.language, exact: true }),
    );
    await phone.screenshot({
      path: `docs/screenshots/v06-${info.project.name}-${locale}-remote-language-open.png`,
      animations: "disabled",
    });
    await languagePopup.locator(`[data-value="${locale}"]`).click();
    await phone
      .getByRole("dialog", { name: t.quickSettings, exact: true })
      .getByRole("button", { name: t.back, exact: true })
      .click();
    await phone.screenshot({
      animations: "disabled",
      path: `docs/screenshots/v06-${info.project.name}-${locale}-remote-main.png`,
    });
    await expect(
      phone.getByRole("heading", { name: t.previewPrivate, exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        received.some(
          (m) => m.type === "previewPermission" && m.allowed === false,
        ),
      )
      .toBe(true);
    expect(received.some((m) => m.type === "previewContent")).toBe(false);
    expect(await phone.locator("body").innerText()).not.toContain(
      "A clear voice",
    );
    await managePhone(page, t);
    await page
      .getByRole("checkbox", { name: t.allowPreview, exact: true })
      .check();
    await expect(phone.locator(".remote-text")).toContainText(
      "First paragraph",
    );
    await page
      .getByRole("dialog", { name: t.remoteConnection, exact: true })
      .getByRole("button", { name: t.close, exact: true })
      .click();
    await expect(phone.locator(".remote-text [aria-current=true]")).toHaveCount(
      1,
    );
    await phone.screenshot({
      animations: "disabled",
      path: `docs/screenshots/v06-${info.project.name}-${locale}-remote-text.png`,
    });
    const wing = phone.getByRole("button", { name: t.speedUp, exact: true });
    await acknowledged("speedUp", () => wing.click());
    await expect(phone.locator(".remote-speed")).toContainText("1.25");
    await acknowledged("play", () =>
      phone.getByRole("button", { name: t.play, exact: true }).click(),
    );
    await expect(
      phone.getByRole("button", { name: t.pause, exact: true }),
    ).toBeVisible();
    await acknowledged("pause", () =>
      phone.getByRole("button", { name: t.pause, exact: true }).click(),
    );
    await acknowledged("nextParagraph", () =>
      phone.getByRole("button", { name: t.nextParagraph, exact: true }).click(),
    );

    const max = Number(
      await page
        .getByRole("slider", { name: t.position, exact: true })
        .getAttribute("max"),
    );
    await page
      .getByRole("slider", { name: t.position, exact: true })
      .fill(String(Math.floor(max * 0.6)));
    await expect
      .poll(async () =>
        Number(
          await phone
            .locator(".remote-text [aria-current=true]")
            .getAttribute("data-preview-paragraph"),
        ),
      )
      .toBeGreaterThan(0);
    // Editing mode keeps the approved session; only the explicit Exit action revokes it.
    await page
      .locator("header")
      .getByRole("button", { name: t.editor, exact: true })
      .click();
    await page
      .getByRole("textbox", { name: t.body, exact: true })
      .fill("Updated live words.\n\nA new paragraph after editing.");
    await expect(phone.locator(".remote-text")).toContainText(
      "Updated live words.",
    );
    await page
      .getByRole("textbox", { name: t.title, exact: true })
      .fill("Revised title");

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
      .fill("Another script");
    await page
      .getByRole("textbox", { name: t.body, exact: true })
      .fill("Different live content after script switching.");
    await expect(phone.locator(".remote-text")).toContainText(
      "Different live content",
    );
    await byLabel(
      page
        .locator("header")
        .getByRole("combobox", { name: t.currentScript, exact: true }),
      "Revised title",
    );
    await expect(phone.locator(".remote-text")).toContainText(
      "Updated live words.",
    );
    await page.getByRole("button", { name: t.read, exact: true }).click();
    await managePhone(page, t);
    await page
      .getByRole("checkbox", { name: t.allowPreview, exact: true })
      .uncheck();
    await expect(
      phone.getByRole("heading", { name: t.previewPrivate, exact: true }),
    ).toBeVisible();
    expect(await phone.locator(".controller").innerText()).not.toContain(
      "Updated live words.",
    );
    await managePhone(page, t);
    await page
      .getByRole("checkbox", { name: t.allowPreview, exact: true })
      .check();
    await expect(phone.locator(".remote-text")).toContainText(
      "Updated live words.",
    );
    await page
      .getByRole("dialog", { name: t.remoteConnection, exact: true })
      .getByRole("button", { name: t.close, exact: true })
      .click();
    holdResumes = true;
    await transports[0].close({ code: 1012, reason: "QA interruption" });
    await expect(phone.locator(".remote-connection")).toContainText(
      t.reconnecting,
    );
    expect(await phone.locator(".controller").innerText()).not.toContain(
      "Updated live words.",
    );

    holdResumes = false;
    releaseResume?.();
    await expect(phone.locator(".remote-connection")).toHaveText(t.connected);
    await expect(phone.locator(".remote-text")).toContainText(
      "Updated live words.",
    );
    for (const size of [
      { width: 375, height: 667 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await phone.setViewportSize(size);
      await expect(
        phone.getByRole("button", { name: t.play, exact: true }),
      ).toBeInViewport();
      await expect(
        phone.getByRole("button", { name: t.speedUp, exact: true }),
      ).toBeInViewport();
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
    }
    await phone.setViewportSize({ width: 390, height: 844 });
    await phone.screenshot({
      animations: "disabled",
      path: `docs/screenshots/v06-${info.project.name}-${locale}-private-preview.png`,
    });
    await phone
      .getByRole("button", { name: t.advancedSettings, exact: true })
      .click();
    await expect(
      phone.getByText(t.hapticsUnavailable, { exact: true }),
    ).toBeVisible();
    await phone
      .getByRole("dialog", { name: t.quickSettings, exact: true })
      .getByRole("button", { name: t.back, exact: true })
      .click();
    await managePhone(page, t);
    await page.getByRole("button", { name: t.revoke, exact: true }).click();
    await expect(phone.locator(".remote-connection")).toContainText(
      t.disconnected,
    );
    expect(await phone.locator(".controller").innerText()).not.toContain(
      "Updated live words.",
    );
    await context.close();
  });
}
