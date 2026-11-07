import { test, expect, type Page } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
const t = dictionaries.en;
const baseline = process.env.TELEO_READER_BASELINE === "1";
const text = Array.from({ length: 30 }, (_, n) =>
  `Paragraph ${n + 1}. Your words, your pace. A calm, clear voice carries the story forward. Every word belongs in this script and stays in view as you read. `.repeat(
    3,
  ),
).join("\n\n");
const errorsByPage = new WeakMap<Page, string[]>();
test.afterEach(async ({ page }) => {
  expect(errorsByPage.get(page)).toEqual([]);
});
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  errorsByPage.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
    localStorage.setItem("teleo.demo.auto", "false");
  });
  if (
    !process.env.TELEO_READER_URL ||
    new URL(process.env.TELEO_READER_URL).hostname === "127.0.0.1"
  )
    await page.setExtraHTTPHeaders({ "CF-Connecting-IP": crypto.randomUUID() });
  await page.emulateMedia({ reducedMotion: "reduce" });
});
async function create(page: Page) {
  await page.goto("/studio?lang=en");
  if (await page.evaluate(() => !!localStorage.getItem("teleo.selectedScript")))
    await expect(
      page.getByRole("textbox", { name: t.body, exact: true }),
    ).toBeVisible();
  if (
    !(await page
      .getByRole("button", { name: t.newScript, exact: true })
      .first()
      .isVisible())
  )
    await page
      .locator("header")
      .getByRole("button", { name: t.library, exact: true })
      .click();
  await page
    .getByRole("button", { name: t.newScript, exact: true })
    .first()
    .click();
  await page.getByRole("textbox", { name: t.body, exact: true }).fill(text);
  await page.getByRole("textbox", { name: t.body, exact: true }).blur();
}
if (baseline)
  test("baseline real reader and paired remote screens", async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(90000);
    for (const [width, height] of [
      [1440, 900],
      [1024, 768],
      [834, 1112],
      [390, 844],
      [375, 667],
      [844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      await create(page);
      await page.screenshot({
        animations: "disabled",
        path: `docs/screenshots/v12-before-${info.project.name}-studio-${width}x${height}.png`,
      });
      await page.getByRole("button", { name: t.read, exact: true }).click();
      await page.screenshot({
        animations: "disabled",
        path: `docs/screenshots/v12-before-${info.project.name}-reader-${width}x${height}.png`,
      });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
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
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const phone = await context.newPage();
    try {
      await phone.goto(invite!);
      await expect(pair).not.toBeVisible();
      await page
        .locator("header")
        .getByRole("button", { name: t.remoteConnection, exact: true })
        .click();
      await pair
        .getByRole("checkbox", { name: t.allowPreview, exact: true })
        .check();
      await pair.getByRole("button", { name: t.close, exact: true }).click();
      await expect(phone.locator(".remote-text")).toContainText("Paragraph 1");
      await phone.screenshot({
        animations: "disabled",
        path: `docs/screenshots/v12-before-${info.project.name}-remote.png`,
      });
      await phone
        .getByRole("button", { name: t.quickSettings, exact: true })
        .click();
      await phone.screenshot({
        animations: "disabled",
        path: `docs/screenshots/v12-before-${info.project.name}-remote-quick.png`,
      });
    } finally {
      await context.close();
    }
  });

async function expand(page: Page) {
  await expect(page.locator(".reader-dock")).toBeVisible();
  const button = page
    .locator(".reader-dock")
    .getByRole("button", { name: t.expandControls, exact: true });
  if (await button.isVisible()) await button.click();
}
async function typography(
  page: Page,
  key: "fontSize" | "lineHeight" | "textWidth",
) {
  await expand(page);
  if (!(await page.locator(".dock-text-tabs").isVisible()))
    await page.locator(".dock-aa").click();
  await page
    .locator(".dock-text-tabs")
    .getByRole("button", { name: t[key], exact: true })
    .click();
  return page
    .locator(".dock-inline-panel")
    .getByRole("slider", { name: t[key], exact: true });
}
async function mark(page: Page) {
  return page.locator(".reading-viewport").evaluate((view) => {
    const p = view.querySelectorAll("[data-paragraph]")[10],
      node = p.firstChild!;
    const r = document.createRange();
    r.setStart(node, 120);
    r.setEnd(node, 121);
    const y = view.getBoundingClientRect().top + view.clientHeight * 0.35;
    (view as HTMLElement).scrollTop += r.getBoundingClientRect().top - y;
    return { paragraph: 10, offset: 120 };
  });
}
async function delta(page: Page) {
  return page.locator(".reading-viewport").evaluate((view) => {
    const node = view.querySelectorAll("[data-paragraph]")[10].firstChild!;
    const r = document.createRange();
    r.setStart(node, 120);
    r.setEnd(node, 121);
    return (
      r.getBoundingClientRect().top -
      view.getBoundingClientRect().top -
      view.clientHeight * 0.35
    );
  });
}
if (!baseline) {
  test("exact speed, continuous one-tap pause and responsive live dock", async ({
    page,
  }, info) => {
    test.setTimeout(90000);
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [1024, 768],
      [834, 1112],
      [390, 844],
      [375, 667],
      [844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      await create(page);
      await page.screenshot({
        animations: "disabled",
        path: `docs/screenshots/v12-after-${info.project.name}-studio-${width}x${height}.png`,
      });
      await page.getByRole("button", { name: t.read, exact: true }).click();
      const dock = page.locator(".reader-dock");
      await expand(page);
      const speed = dock.getByRole("status", { name: t.speed, exact: true });
      await expect(speed).toHaveText("1.0×");
      await dock.getByRole("button", { name: t.speedUp, exact: true }).click();
      await expect(speed).toHaveText("1.1×");
      await dock.getByRole("button", { name: t.speedUp, exact: true }).click();
      await expect(speed).toHaveText("1.2×");
      await dock
        .getByRole("button", { name: t.speedDown, exact: true })
        .click();
      await expect(speed).toHaveText("1.1×");
      await dock
        .getByRole("button", { name: t.speedDown, exact: true })
        .click();
      await expect(speed).toHaveText("1.0×");
      await page.keyboard.press("ArrowUp");
      await expect(speed).toHaveText("1.1×");
      await page.keyboard.press("ArrowDown");
      await expect(speed).toHaveText("1.0×");
      const font = await typography(page, "fontSize");
      if (width === 1440)
        await page.screenshot({
          path: `docs/screenshots/v12-after-${info.project.name}-font-default.png`,
        });
      await font.fill("52");
      await expect(page.locator(".reader article")).toHaveCSS(
        "font-size",
        "52px",
      );
      const view = await page.locator(".reading-viewport").boundingBox(),
        panel = await page.locator(".dock-inline-panel").boundingBox();
      expect(view!.height).toBeGreaterThan(40);
      expect(view!.y + view!.height).toBeLessThanOrEqual(panel!.y + 1);
      await dock.getByRole("button", { name: t.play, exact: true }).click();
      await expect(
        dock.getByRole("button", { name: t.pause, exact: true }),
      ).toBeVisible();
      await page.waitForTimeout(width === 375 ? 5100 : 150);
      await font.fill("68");
      await expect(page.locator(".reader article")).toHaveCSS(
        "font-size",
        "68px",
      );
      await expect(
        dock.getByRole("button", { name: t.pause, exact: true }),
      ).toBeVisible();
      await font.fill("52");
      await dock.getByRole("button", { name: t.pause, exact: true }).click();
      await page.screenshot({
        animations: "disabled",
        path: `docs/screenshots/v12-after-${info.project.name}-reader-${width}x${height}.png`,
      });
      if (width <= 600 || height <= 500) {
        await dock
          .getByRole("button", { name: t.collapseControls, exact: true })
          .click();
        await dock.getByRole("button", { name: t.play, exact: true }).click();
        await expect(
          dock.getByRole("button", { name: t.pause, exact: true }),
        ).toBeVisible();
        await dock.getByRole("button", { name: t.pause, exact: true }).click();
        await page.screenshot({
          animations: "disabled",
          path: `docs/screenshots/v12-after-${info.project.name}-mini-${width}x${height}.png`,
        });
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  });
  test("known character survives typography, dock resize, orientation and mirrors", async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await create(page);
    await page.getByRole("button", { name: t.read, exact: true }).click();
    await page.waitForTimeout(200);
    await mark(page);
    await page.waitForTimeout(200);

    for (const [key, value] of [
      ["fontSize", "72"],
      ["lineHeight", "2.1"],
      ["textWidth", "480"],
      ["fontSize", "100"],
      ["fontSize", "16"],
    ] as const) {
      const slider = await typography(page, key);
      await slider.fill(value);
      await page.waitForTimeout(150);
      expect(Math.abs(await delta(page))).toBeLessThan(150);
      if (key === "fontSize")
        await page.screenshot({
          animations: "disabled",
          path: `docs/screenshots/v12-after-${info.project.name}-font-${value}.png`,
        });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    expect(Math.abs(await delta(page))).toBeLessThan(150);
    await expand(page);
    await page
      .locator(".reader-dock")
      .getByRole("button", { name: t.timer, exact: true })
      .click();
    for (const key of [
      "mirrorHorizontal",
      "mirrorVertical",
      "mirrorVertical",
      "mirrorHorizontal",
    ] as const) {
      await page
        .locator(".dock-secondary")
        .getByRole("button", { name: t[key], exact: true })
        .click();
      await page.waitForTimeout(150);
      expect(Math.abs(await delta(page))).toBeLessThan(150);
    }
    await page.screenshot({
      animations: "disabled",
      path: `docs/screenshots/v12-after-${info.project.name}-semantic-anchor.png`,
    });
    // Safari does not focus a button on pointer click. Exercise Escape from an actual keyboard control.
    await page
      .locator(".dock-secondary")
      .getByRole("button", { name: t.mirrorHorizontal, exact: true })
      .focus();
    await page.keyboard.press("Escape");
    await expect(page.locator(".reader")).toBeVisible();
    await expect(page.locator(".dock-inline-panel")).toHaveCount(0);
    await expect(page.locator(".dock-tools-trigger")).toBeFocused();
  });
  test("paired rapid relative speed, inline typography, consent and reconnect", async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await create(page);
    await page.getByRole("button", { name: t.read, exact: true }).click();
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
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const phone = await context.newPage();
    phone.on("pageerror", (error) =>
      errorsByPage.get(page)!.push(error.message),
    );
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let duplicate = true,
      changes = 0;
    await phone.routeWebSocket("**/api/rooms/*", (client) => {
      const server = client.connectToServer();
      let closed = false;
      client.onMessage((message) => {
        const m = JSON.parse(String(message));
        if (m.type === "command" && m.command?.action === "setPreference")
          changes++;
        server.send(message);
        if (
          duplicate &&
          m.type === "command" &&
          m.command?.action === "speedUp"
        ) {
          duplicate = false;
          server.send(message);
        }
      });
      server.onMessage((message) => {
        const m = JSON.parse(String(message));
        if (m.type === "ack") {
          const timer = setTimeout(() => {
            timers.delete(timer);
            if (!closed) client.send(message);
          }, 140);
          timers.add(timer);
        } else if (!closed) client.send(message);
      });
      server.onClose((code, reason) => {
        closed = true;
        client.close({ code, reason });
      });
      client.onClose(() => {
        closed = true;
        server.close();
      });
    });
    try {
      await pair
        .getByRole("checkbox", { name: t.allowPreview, exact: true })
        .uncheck();
      await phone.goto(invite!);
      await expect(pair).not.toBeVisible();
      await expect(phone.locator(".remote-speed")).toHaveText("1.0×");
      await expect(phone.locator(".remote-text")).not.toContainText(
        "Paragraph 1",
      );
      await page
        .locator("header")
        .getByRole("button", { name: t.remoteConnection, exact: true })
        .click();
      await pair
        .getByRole("checkbox", { name: t.allowPreview, exact: true })
        .check();
      await pair.getByRole("button", { name: t.close, exact: true }).click();
      await expect(phone.locator(".remote-text")).toContainText("Paragraph 1");
      const plus = phone.getByRole("button", { name: t.speedUp, exact: true });
      await plus.evaluate((el) => {
        for (let i = 0; i < 10; i++) (el as HTMLButtonElement).click();
      });
      await expect(phone.locator(".remote-speed")).toHaveText("2.0×");
      await expect(page.locator(".reader-dock .speed-group output")).toHaveText(
        "2.0×",
      );
      const minus = phone.getByRole("button", {
        name: t.speedDown,
        exact: true,
      });
      await minus.evaluate((el) => {
        for (let i = 0; i < 10; i++) (el as HTMLButtonElement).click();
      });
      await expect(phone.locator(".remote-speed")).toHaveText("1.0×");
      await page.bringToFront();
      await page
        .locator(".reader-dock")
        .getByRole("button", { name: t.speedUp, exact: true })
        .click();
      await expect(page.locator(".reader-dock .speed-group output")).toHaveText(
        "1.1×",
      );
      await expect(phone.locator(".remote-speed")).toHaveText("1.1×");
      await page
        .locator(".reader-dock")
        .getByRole("button", { name: t.speedDown, exact: true })
        .click();
      await expect(phone.locator(".remote-speed")).toHaveText("1.0×");
      await mark(page);
      await page.waitForTimeout(200);
      await phone.screenshot({
        path: `docs/screenshots/v12-after-${info.project.name}-remote.png`,
      });
      await phone
        .getByRole("button", { name: t.quickSettings, exact: true })
        .click();
      await expect(phone.locator(".remote-main-play")).toBeVisible();
      await expect(phone.getByRole("dialog")).toHaveCount(0);
      const slider = phone
        .locator(".remote-quick-menu")
        .getByRole("slider", { name: t.fontSize, exact: true });
      const changeCount = changes;
      await slider.dispatchEvent("pointerdown");
      for (const value of [50, 52, 54, 56, 58, 60, 62, 64, 66, 68])
        await slider.fill(String(value));
      await slider.dispatchEvent("pointerup");
      await expect(page.locator(".reader article")).toHaveCSS(
        "font-size",
        "68px",
      );
      expect(Math.abs(await delta(page))).toBeLessThan(150);
      expect(changes - changeCount).toBeLessThan(10);
      await expect(
        phone.locator('.remote-text [aria-current="true"]'),
      ).toHaveCSS("content-visibility", "visible");
      await expect
        .poll(() =>
          phone.locator(".remote-text").evaluate((view) => {
            const active = view
                .querySelector('[aria-current="true"]')!
                .getBoundingClientRect(),
              box = view.getBoundingClientRect();
            return active.top < box.bottom && active.bottom > box.top;
          }),
        )
        .toBe(true);
      await slider.dispatchEvent("pointerdown");
      await slider.fill("99");
      await slider.dispatchEvent("pointercancel");
      await phone.waitForTimeout(250);
      await expect(slider).toHaveValue("68");
      await phone.screenshot({
        path: `docs/screenshots/v12-after-${info.project.name}-remote-quick.png`,
      });
      await phone
        .locator(".remote-quick-menu")
        .getByRole("button", { name: t.close, exact: true })
        .click();
      await phone
        .getByRole("button", { name: t.advancedSettings, exact: true })
        .click();
      await phone
        .getByRole("button", { name: t.expandedText, exact: true })
        .click();
      await expect(phone.locator(".controller")).toHaveClass(/current-text/);
      await phone.screenshot({
        path: `docs/screenshots/v12-after-${info.project.name}-remote-current-text.png`,
      });
      await page
        .locator("header")
        .getByRole("button", { name: t.remoteConnection, exact: true })
        .click();
      await pair.getByRole("button", { name: t.revoke, exact: true }).click();
      await expect(
        phone.getByRole("button", { name: t.reconnect, exact: true }),
      ).toBeVisible();
      await phone.screenshot({
        path: `docs/screenshots/v12-after-${info.project.name}-remote-reconnect.png`,
      });
    } finally {
      for (const timer of timers) clearTimeout(timer);
      await context.close();
    }
  });
}
if (!baseline) {
  test("legacy persisted speed remains truthful on reload and explicit stepping", async ({
    page,
  }) => {
    await create(page);
    await expect(
      page.getByRole("status").filter({ hasText: t.saved }),
    ).toBeVisible();
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open("teleo");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction("scripts", "readwrite"),
            store = tx.objectStore("scripts");
          const r = store.get(localStorage.getItem("teleo.selectedScript")!);
          r.onsuccess = () =>
            store.put({
              ...r.result,
              preferences: { ...r.result.preferences, speed: 0.75 },
            });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } finally {
        db.close();
      }
    });
    await page.reload();
    await expect(
      page.locator(".reader-controls .speed-group output"),
    ).toHaveText("0.75×");
    await page.getByRole("button", { name: t.read, exact: true }).click();
    await expand(page);
    const dock = page.locator(".reader-dock");
    await expect(dock.locator(".speed-group output")).toHaveText("0.75×");
    await dock.getByRole("button", { name: t.speedUp, exact: true }).click();
    await expect(dock.locator(".speed-group output")).toHaveText("0.8×");
    await page.getByRole("button", { name: t.exit, exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: t.saved }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.locator(".reader-controls .speed-group output"),
    ).toHaveText("0.8×");
    await page.getByRole("button", { name: t.read, exact: true }).click();
    await expand(page);
    const plus = page
        .locator(".reader-dock")
        .getByRole("button", { name: t.speedUp, exact: true }),
      minus = page
        .locator(".reader-dock")
        .getByRole("button", { name: t.speedDown, exact: true });
    await plus.evaluate((el) => {
      for (let i = 0; i < 30; i++) (el as HTMLButtonElement).click();
    });
    await expect(page.locator(".reader-dock .speed-group output")).toHaveText(
      "3.0×",
    );
    await expect(plus).toBeDisabled();
    await minus.evaluate((el) => {
      for (let i = 0; i < 30; i++) (el as HTMLButtonElement).click();
    });
    await expect(page.locator(".reader-dock .speed-group output")).toHaveText(
      "0.5×",
    );
    await expect(minus).toBeDisabled();
  });
  test("countdown, end, empty script and typography persistence", async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await create(page);
    await page.getByRole("button", { name: t.read, exact: true }).click();
    await expand(page);
    const dock = page.locator(".reader-dock");
    await dock.getByRole("button", { name: t.timer, exact: true }).click();
    await dock
      .getByRole("group", { name: t.timer, exact: true })
      .getByRole("button", { name: `3 ${t.seconds}`, exact: true })
      .click();
    await dock.getByRole("button", { name: t.play, exact: true }).click();
    await expect(page.locator(".countdown")).toHaveText("3");
    await page.waitForTimeout(1200);
    const font = await typography(page, "fontSize");
    await font.fill("68");
    await expect(
      dock.getByRole("button", { name: t.pause, exact: true }),
    ).toBeVisible();
    expect(Number(await page.locator(".countdown").textContent())).toBeLessThan(
      3,
    );
    await dock.getByRole("button", { name: t.speedUp, exact: true }).click();
    await expect(dock.locator(".speed-group output")).toHaveText("1.1×");
    await dock.getByRole("button", { name: t.pause, exact: true }).click();
    await dock
      .getByRole("slider", { name: t.position, exact: true })
      .press("End");
    await font.fill("100");
    await font.fill("16");
    await expect(page.locator(".reader article")).toHaveCSS(
      "font-size",
      "16px",
    );
    const last = await page.locator(".reading-viewport").evaluate((view) => {
      const rect = view
          .querySelector("[data-paragraph]:last-child")!
          .getBoundingClientRect(),
        v = view.getBoundingClientRect();
      return rect.top < v.bottom && rect.bottom > v.top;
    });
    expect(last).toBe(true);
    await page.screenshot({
      path: `docs/screenshots/v12-after-${info.project.name}-end.png`,
    });
    await page.getByRole("button", { name: t.exit, exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: t.saved }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: t.read, exact: true }).click();
    await expect(page.locator(".reader article")).toHaveCSS(
      "font-size",
      "16px",
    );
    await page.getByRole("button", { name: t.exit, exact: true }).click();
    await page.getByRole("textbox", { name: t.body, exact: true }).fill("");
    await page.getByRole("button", { name: t.read, exact: true }).click();
    await expand(page);
    await expect(
      dock.getByRole("slider", { name: t.position, exact: true }),
    ).toBeDisabled();
    await (await typography(page, "fontSize")).fill("100");
    expect(errors).toEqual([]);
  });
}
