import { test, expect, type Page } from "@playwright/test";
import { writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chooseSelect } from "./helpers";
import { dictionaries } from "../../apps/web/src/i18n";
const t = dictionaries.en;
const baseline = process.env.TELEO_APPROVAL_BASELINE === "1";
const capture = process.env.TELEO_APPROVAL_CAPTURE || "before";
const body = Array.from({ length: 24 }, (_, i) =>
  `Paragraph ${i + 1}. Your words, your pace. A clear voice carries the story forward. `.repeat(
    5,
  ),
).join("\n\n");
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
    if (localStorage.getItem("teleo.demo.auto") === null)
      localStorage.setItem("teleo.demo.auto", "false");
    localStorage.setItem("teleo.locale", "en");
  });

  await page.setExtraHTTPHeaders({ "CF-Connecting-IP": crypto.randomUUID() });
});
async function saved(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).filter(
          (key) =>
            key.startsWith("teleo.recovery.") && localStorage.getItem(key),
        ),
      ),
    )
    .toEqual([]);
}
async function coordinate(page: Page, selector: string, focus?: number) {
  return page.locator(selector).evaluate(
    async (view, { body, focus }) => {
      const path = "/src/text-position.ts";
      const { textOffsetAtView } = await import(path);
      let offset = 0;
      const blocks = body.split("\n\n").map((text) => {
        const block = { text, offset };
        offset += text.length + 2;
        return block;
      });
      return textOffsetAtView(
        view,
        blocks,
        focus ??
          (parseFloat(getComputedStyle(view).paddingTop) / view.clientHeight) *
            100,
      );
    },
    { body, focus },
  );
}
async function create(page: Page) {
  await page.goto("/studio");
  // Wait for the existing library initialization before simulating user edits.
  await page
    .locator("header")
    .getByRole("button", { name: t.settings, exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: t.autoDemo, exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: t.newScript, exact: true })
    .first()
    .click();
  await page.getByRole("textbox", { name: t.body, exact: true }).fill(body);
  await page
    .getByRole("textbox", { name: t.body, exact: true })
    .evaluate((el) => {
      el.scrollTop = 0;
    });
  await page.getByRole("textbox", { name: t.body, exact: true }).blur();
  await saved(page);
}
if (!baseline) {
  test("Editor has no playback UI; approved Reading toolbar; original remote button unchanged", async ({
    page,
  }, info) => {
    await create(page);
    const expected = JSON.parse(
      readFileSync("tests/e2e/approval-v3-baseline.json", "utf8"),
    )[info.project.name.replace("approval-", "")];
    for (const sample of expected) {
      await page.setViewportSize({
        width: sample.width,
        height: sample.height,
      });
      const remote = page
        .locator("header")
        .getByRole("button", { name: t.remoteConnection, exact: true });
      await expect.poll(() => remote.boundingBox()).toEqual(sample.rect);
      expect(await remote.locator("svg").evaluate((el) => el.outerHTML)).toBe(
        sample.svg,
      );
      await expect(page.locator(".reader-controls")).toHaveCount(0);
      await expect(
        page.getByRole("toolbar", { name: t.playbackSettings, exact: true }),
      ).toHaveCount(0);
      await expect(page.locator(".integrated-settings")).toHaveCount(0);
      if (sample.width < 600) continue;
      await page.getByRole("button", { name: t.read, exact: true }).click();
      const toolbar = page.locator(".approved-reader-toolbar");
      await expect(toolbar).toBeVisible();
      const clipped = await toolbar
        .locator(".approved-pill > .picker-trigger span")
        .evaluateAll((nodes) =>
          nodes
            .filter((el) => el.scrollWidth > el.clientWidth + 1)
            .map((el) => el.textContent),
        );
      expect(clipped).toEqual([]);
      const children = toolbar.locator(":scope > *");
      await expect(children).toHaveCount(13);
      const labels = await children.evaluateAll((nodes) =>
        nodes.map(
          (n) =>
            n.getAttribute("aria-label") ||
            n.querySelector('[role="group"]')?.getAttribute("aria-label") ||
            n.querySelector("button")?.getAttribute("aria-label"),
        ),
      );
      expect(labels).toEqual([
        t.restart,
        t.focusDimming,
        t.focusLine,
        t.timer,
        t.textWidth,
        t.fontSize,
        t.play,
        t.speed,
        t.lineHeight,
        t.alignment,
        t.mirrorHorizontal,
        t.mirrorVertical,
        t.fullscreen,
      ]);
      const r = await toolbar.boundingBox(),
        play = await toolbar.locator(".dock-play").boundingBox();
      expect(
        Math.abs(play!.x + play!.width / 2 - r!.x - r!.width / 2),
      ).toBeLessThan(2);
      expect(r!.x).toBeGreaterThanOrEqual(0);
      expect(r!.x + r!.width).toBeLessThanOrEqual(sample.width);
      await expect(
        toolbar.getByRole("button", { name: t.close, exact: true }),
      ).toHaveCount(0);
      await toolbar
        .getByRole("button", { name: t.fontSize, exact: true })
        .click();
      await page
        .getByRole("dialog", { name: t.fontSize, exact: true })
        .getByRole("slider")
        .fill("60");
      await page.keyboard.press("Escape");
      await expect(page.locator(".reader article")).toHaveCSS(
        "font-size",
        "60px",
      );
      await page.screenshot({
        path: `docs/screenshots/approval-v3-${info.project.name}-reading-${sample.width}.png`,
      });
      await toolbar.getByRole("button", { name: t.play, exact: true }).click();
      await expect(
        toolbar.getByRole("button", { name: t.pause, exact: true }),
      ).toBeVisible();
      await toolbar.getByRole("button", { name: t.pause, exact: true }).click();
      await page.getByRole("button", { name: t.editor, exact: true }).click();
      await expect(page.locator(".reader-controls")).toHaveCount(0);
      await expect(
        page.getByRole("toolbar", { name: t.playbackSettings, exact: true }),
      ).toHaveCount(0);
    }
  });
  test("settings/appearance retain state; only folders gain focus/hover trash", async ({
    page,
  }, info) => {
    await create(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
      .locator("header")
      .getByRole("button", { name: t.settings, exact: true })
      .click();
    const settings = page.getByRole("dialog", {
      name: t.settings,
      exact: true,
    });
    await expect(settings.locator('input[type="range"]')).toHaveCount(0);
    await expect(
      settings.getByRole("checkbox", { name: t.autoDemo, exact: true }),
    ).toHaveCount(1);
    await page.screenshot({
      path: `docs/screenshots/approval-v3-${info.project.name}-settings.png`,
    });
    await settings
      .getByRole("checkbox", { name: t.autoDemo, exact: true })
      .check();
    await settings.locator("summary").click();
    await chooseSelect(
      settings.getByRole("combobox", { name: t.profile, exact: true }),
      "r400",
    );
    await expect(settings).toContainText(t.r400Help);
    await settings.getByRole("button", { name: t.test, exact: true }).click();
    await page.keyboard.press("KeyQ");
    await expect(settings.locator("output")).toContainText("KeyQ");

    await page.keyboard.press("Escape");
    await page
      .locator("header")
      .getByRole("button", { name: t.appearanceMenu, exact: true })
      .click();
    const appearance = page.getByRole("dialog", {
      name: t.appearanceMenu,
      exact: true,
    });
    await appearance
      .getByRole("button", { name: t.readingAppearance, exact: true })
      .click();
    await page
      .getByRole("dialog", { name: t.readingAppearance, exact: true })
      .getByRole("group", { name: t.readingAppearance, exact: true })
      .getByRole("button", { name: t.light, exact: true })
      .click();
    await expect(page.locator(".app-shell")).toHaveClass(/theme-system/);
    await page.keyboard.press("Escape");
    await appearance
      .getByRole("button", { name: t.interfaceTheme, exact: true })
      .click();
    await page
      .getByRole("dialog", { name: t.interfaceTheme, exact: true })
      .getByRole("group", { name: t.interfaceTheme, exact: true })
      .getByRole("button", { name: t.dark, exact: true })
      .click();
    await expect(page.locator(".app-shell")).toHaveClass(/theme-dark/);
    await page.keyboard.press("Escape");
    await page.screenshot({
      path: `docs/screenshots/approval-v3-${info.project.name}-appearance.png`,
    });
    await page.keyboard.press("Escape");
    await saved(page);
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: t.body, exact: true }),
    ).toHaveValue(body);
    await expect(page.locator(".script-list > button")).toHaveCount(1);
    await expect(page.locator(".app-shell")).toHaveClass(/theme-dark/);
    await page.getByRole("button", { name: t.read, exact: true }).click();
    await expect(page.locator(".reader")).toHaveClass(/light/);
    await page.getByRole("button", { name: t.editor, exact: true }).click();
    await page.getByRole("button", { name: t.newFolder, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").fill("Folder A");
    await dialog.getByRole("button", { name: t.create, exact: true }).click();
    await page.locator(".folder-picker > button").click();
    const row = page.locator(".folder-option");
    const trash = row.getByRole("menuitem", {
      name: `${t.deleteFolder}: Folder A`,
      exact: true,
    });
    await page.mouse.move(0, 0);
    await expect(trash).toHaveCSS("opacity", "0");
    const before = await row.boundingBox();
    await row.hover();
    await expect(trash).toHaveCSS("opacity", "1");
    expect(await row.boundingBox()).toEqual(before);
    const trashRect = (await trash.boundingBox())!,
      iconRect = (await trash.locator("svg").boundingBox())!;
    expect(
      Math.abs(trashRect.x + trashRect.width - before!.x - before!.width + 2),
    ).toBeLessThan(1);
    expect(
      Math.abs(
        iconRect.x + iconRect.width / 2 - trashRect.x - trashRect.width / 2,
      ),
    ).toBeLessThan(1);
    await page.screenshot({
      path: `docs/screenshots/approval-v3-${info.project.name}-folder.png`,
    });
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowDown");
    await expect(
      row.getByRole("menuitem", { name: "Folder A", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(trash).toBeFocused();
    await expect(trash).toHaveCSS("opacity", "1");
    await expect(page.locator(".script-list .folder-trash")).toHaveCount(0);
    await trash.click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: t.confirm, exact: true })
      .click();
    await expect(page.locator(".script-list > button")).toHaveCount(1);
    await expect(
      page.getByRole("textbox", { name: t.body, exact: true }),
    ).toHaveValue(body);
    await expect(
      page
        .locator(".library")
        .getByRole("button", { name: t.restoreDemo, exact: true }),
    ).toBeVisible();
    await page
      .locator(".library")
      .getByRole("button", { name: t.restoreDemo, exact: true })
      .click();
    await expect(page.locator(".script-list > button")).toHaveCount(2);
    await page
      .locator(".library")
      .getByRole("button", { name: t.openDemo, exact: true })
      .click();
    await expect(page.locator(".script-list > button")).toHaveCount(2);
  });
  test("existing phone visuals and continuous timeline/text positioning across wrapping", async ({
    page,
    browser,
    browserName,
  }, info) => {
    test.setTimeout(60000);
    await create(page);
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
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
      serviceWorkers: "block",
      hasTouch: true,
    });
    const phone = await ctx.newPage();
    let seeks = 0;
    phone.on("websocket", (ws) =>
      ws.on("framesent", (frame) => {
        const m = JSON.parse(String(frame.payload));
        if (m.type === "command" && m.command.action === "seek") seeks++;
      }),
    );
    try {
      await phone.goto(invite!);
      await pair.getByRole("button", { name: t.allow, exact: true }).click();
      await page
        .locator("header")
        .getByRole("button", { name: t.remoteConnection, exact: true })
        .click();
      await pair
        .getByRole("checkbox", { name: t.allowPreview, exact: true })
        .check();
      await pair.getByRole("button", { name: t.close, exact: true }).click();
      await expect(phone.locator(".remote-text")).toContainText("Paragraph 1");
      const screenshot = await phone.screenshot({
        path: `docs/screenshots/approval-v3-${info.project.name}-phone.png`,
      });
      if (process.platform === "darwin") {
        const { PNG } = createRequire(import.meta.url)(
          "../../node_modules/playwright-core/lib/utilsBundle.js",
        );
        const before = PNG.sync.read(
            readFileSync(
              `docs/screenshots/approval-v3-before-${info.project.name}-phone.png`,
            ),
          ),
          after = PNG.sync.read(screenshot);
        expect([after.width, after.height]).toEqual([
          before.width,
          before.height,
        ]);
        let changed = 0;
        const scale = after.width / 390;
        for (let y = 0; y < after.height; y++)
          for (let x = 0; x < after.width; x++) {
            if (y >= 125 * scale && y <= 480 * scale) continue;
            const i = (y * after.width + x) * 4;
            if (
              !before.data
                .subarray(i, i + 4)
                .equals(after.data.subarray(i, i + 4))
            )
              changed++;
          }
        expect(changed).toBe(0);
      }
      await page.getByRole("button", { name: t.read, exact: true }).click();
      const position = phone.getByRole("slider", {
        name: t.position,
        exact: true,
      });
      await expect(position).toBeEnabled();
      await position.dispatchEvent("pointerdown");
      for (const value of [101.25, 112.75, 123.125, 134.375]) {
        await position.fill(String(value));
        await phone.waitForTimeout(140);
      }
      const hostDuringDrag = await page
        .locator(".reading-viewport")
        .evaluate((el) => el.scrollTop);
      expect(hostDuringDrag).toBeGreaterThan(100);
      expect(seeks).toBeGreaterThan(1);
      expect(seeks).toBeLessThan(10);
      await position.dispatchEvent("pointerup");
      await expect
        .poll(() =>
          page
            .locator(".reading-viewport")
            .evaluate(
              (el) => el.scrollTop / (el.scrollHeight - el.clientHeight),
            ),
        )
        .toBeCloseTo(0.134375, 3);
      // Host-to-phone progress must move within one paragraph, rather than snapping at its boundary.
      const before = await phone
        .locator(".remote-text")
        .evaluate((el) => el.scrollTop);
      await page.locator(".reading-viewport").evaluate((el) => {
        el.scrollTop += 40;
        el.dispatchEvent(new Event("scroll"));
      });
      await expect
        .poll(() =>
          phone.locator(".remote-text").evaluate((el) => el.scrollTop),
        )
        .not.toBe(before);
      const hostBefore = await page
        .locator(".reading-viewport")
        .evaluate((el) => el.scrollTop);
      if (browserName === "chromium") {
        const cdp = await ctx.newCDPSession(phone);
        const r = (await phone.locator(".remote-text").boundingBox())!;
        const x = r.x + r.width / 2,
          y = r.y + Math.min(210, r.height - 20);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y }],
        });
        for (const dy of [20, 40, 60, 80, 100]) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x, y: y - dy }],
          });
          await phone.waitForTimeout(80);
        }
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      } else {
        await phone.locator(".remote-text").dispatchEvent("touchstart");
        for (let i = 0; i < 5; i++) {
          await phone.locator(".remote-text").evaluate((el) => {
            el.scrollTop += 20;
            el.dispatchEvent(new Event("scroll"));
          });
          await phone.waitForTimeout(140);
        }
        await phone.locator(".remote-text").dispatchEvent("touchend");
      }
      await expect
        .poll(() =>
          page.locator(".reading-viewport").evaluate((el) => el.scrollTop),
        )
        .toBeGreaterThan(hostBefore);
      await phone.waitForTimeout(500);
      const after = await page
        .locator(".reading-viewport")
        .evaluate((el) => el.scrollTop);
      await phone.locator(".remote-text").dispatchEvent("touchstart");
      await phone.locator(".remote-text").evaluate((el) => {
        el.scrollTop -= 60;
        el.dispatchEvent(new Event("scroll"));
      });
      await phone.locator(".remote-text").dispatchEvent("touchend");
      await expect
        .poll(() =>
          page.locator(".reading-viewport").evaluate((el) => el.scrollTop),
        )
        .toBeLessThan(after);
      await expect(
        phone.getByRole("button", { name: t.play, exact: true }),
      ).toBeVisible();
      expect(seeks).toBeLessThan(25);
      await expect
        .poll(async () =>
          Math.abs(
            (await coordinate(page, ".reading-viewport", 35)) -
              (await coordinate(phone, ".remote-text")),
          ),
        )
        .toBeLessThan(2);
      // Scrubbing during playback preserves the playing state and resumes from the final sample.
      await phone.getByRole("button", { name: t.play, exact: true }).click();
      await expect(
        phone.getByRole("button", { name: t.pause, exact: true }),
      ).toBeVisible();
      await position.dispatchEvent("pointerdown");
      await position.fill("321.234");
      await position.dispatchEvent("pointerup");
      await expect(
        phone.getByRole("button", { name: t.pause, exact: true }),
      ).toBeVisible();
      await expect
        .poll(() =>
          page
            .locator(".reading-viewport")
            .evaluate(
              (el) => el.scrollTop / (el.scrollHeight - el.clientHeight),
            ),
        )
        .toBeGreaterThan(0.321);
      await phone.getByRole("button", { name: t.pause, exact: true }).click();
    } finally {
      await ctx.close();
    }
  });
}

if (baseline)
  test("baseline unchanged header and existing phone", async ({
    page,
    browser,
  }, info) => {
    await create(page);
    const geometry = [];
    for (const [width, height] of [
      [1440, 900],
      [834, 1112],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      const remote = page
        .locator("header")
        .getByRole("button", { name: t.remoteConnection, exact: true });
      geometry.push({
        width,
        height,
        rect: await remote.boundingBox(),
        svg: await remote.locator("svg").evaluate((el) => el.outerHTML),
      });
      await page.screenshot({
        path: `docs/screenshots/approval-v3-${capture}-${info.project.name}-${width}.png`,
      });
    }
    writeFileSync(
      `/private/tmp/teleo-approval-${capture}-${info.project.name}-geometry.json`,
      JSON.stringify(geometry),
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
      .locator("header")
      .getByRole("button", { name: t.remoteConnection, exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: t.remoteConnection,
      exact: true,
    });
    const invite = await dialog
      .getByRole("link", { name: t.invite, exact: true })
      .getAttribute("href");
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
      serviceWorkers: "block",
    });
    const phone = await ctx.newPage();
    try {
      await phone.goto(invite!);
      await dialog.getByRole("button", { name: t.allow, exact: true }).click();
      await page
        .locator("header")
        .getByRole("button", { name: t.remoteConnection, exact: true })
        .click();
      await dialog
        .getByRole("checkbox", { name: t.allowPreview, exact: true })
        .check();
      await dialog.getByRole("button", { name: t.close, exact: true }).click();
      await expect(phone.locator(".remote-text")).toContainText("Paragraph 1");
      for (const part of [
        "remote-header",
        "remote-timeline",
        "remote-playback",
        "remote-paragraphs",
        "remote-quick-trigger",
      ])
        await phone.locator("." + part).screenshot({
          path: `docs/screenshots/approval-v3-${capture}-${info.project.name}-${part}.png`,
        });
      await phone.screenshot({
        path: `docs/screenshots/approval-v3-${capture}-${info.project.name}-phone.png`,
      });
    } finally {
      await ctx.close();
    }
  });
