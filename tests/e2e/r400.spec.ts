import { test, expect, type Page } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
import { openSettings, closeSettings, chooseSelect } from "./helpers";
const baseline = process.env.TELEO_R400_BASELINE === "1";
const local =
  !process.env.TELEO_R400_URL ||
  new URL(process.env.TELEO_R400_URL).hostname === "127.0.0.1";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
    localStorage.setItem("teleo.demo.auto", "false");
  });
  if (local)
    await page.setExtraHTTPHeaders({ "CF-Connecting-IP": crypto.randomUUID() });
  await page.emulateMedia({ reducedMotion: "reduce" });
});
async function physical(page: Page, locale: "en" | "uk" | "ru" = "en") {
  const t = dictionaries[locale];
  await page.goto("/studio?lang=" + locale);
  if (await page.evaluate(() => !!localStorage.getItem("teleo.selectedScript")))
    await expect(
      page.getByRole("textbox", { name: t.body, exact: true }),
    ).toBeVisible();
  else {
    await page
      .getByRole("button", { name: t.newScript, exact: true })
      .first()
      .click();
    await page
      .getByRole("textbox", { name: t.body, exact: true })
      .fill("R400 test paragraph.\n\n".repeat(80));
  }
  const section = (await openSettings(page, t))
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: t.physical }) });
  await section.locator("summary").click();
  return section;
}
if (baseline)
  test("baseline existing physical-keyboard settings", async ({
    page,
  }, info) => {
    for (const [width, height] of [
      [1440, 900],
      [834, 1112],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await physical(page);
      await page.screenshot({
        path: `docs/screenshots/r400-before-${info.project.name}-${width}x${height}.png`,
      });
    }
  });
const en = dictionaries.en;
async function enable(page: Page, locale: "en" | "uk" | "ru" = "en") {
  const section = await physical(page, locale),
    t = dictionaries[locale];
  await chooseSelect(
    section.getByRole("combobox", { name: t.profile, exact: true }),
    "r400",
  );
  return section;
}
async function read(page: Page) {
  await closeSettings(page, en);
  await page.getByRole("button", { name: en.read, exact: true }).click();
  await expect(page.locator(".reader")).toBeVisible();
  const expand = page
    .locator(".reader-dock")
    .getByRole("button", { name: en.expandControls, exact: true });
  if (await expand.isVisible()) await expand.click();
  await page.locator(".reader-dock .dock-play").focus();
}
async function key(
  page: Page,
  code: string,
  extra: Record<string, unknown> = {},
) {
  return page.evaluate(
    ({ code, extra }) => {
      const e = new KeyboardEvent("keydown", {
        key: code,
        code,
        bubbles: true,
        cancelable: true,
        ...extra,
      });
      document.body.dispatchEvent(e);
      return e.defaultPrevented;
    },
    { code, extra },
  );
}
if (!baseline) {
  for (const locale of ["en", "uk", "ru"] as const)
    test(`${locale}: R400 settings, safe disable, persistence and layout`, async ({
      page,
    }, info) => {
      const t = dictionaries[locale];
      await page.addInitScript(
        (value) => localStorage.setItem("teleo.locale", value),
        locale,
      );
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.addInitScript(() => {
        if (!localStorage.getItem("teleo.mapping"))
          localStorage.setItem(
            "teleo.mapping",
            JSON.stringify({ KeyQ: "restart" }),
          );
      });
      let section = await enable(page, locale);
      await expect(
        section.getByRole("combobox", { name: t.profile, exact: true }),
      ).toContainText(t.r400);
      await expect(section).toContainText(t.r400Help);
      await expect(section).toContainText("Period");
      await expect(section).toContainText(t.r400Escape);
      for (const [width, height] of [
        [1440, 900],
        [834, 1112],
        [390, 844],
      ]) {
        await page.setViewportSize({ width, height });
        if (width !== 1440) {
          await closeSettings(page, t);
          section = await physical(page, locale);
        }
        await section
          .getByRole("combobox", { name: t.profile, exact: true })
          .scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `docs/screenshots/r400-after-${info.project.name}-${locale}-${width}x${height}.png`,
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      await section
        .getByRole("checkbox", { name: t.enabled, exact: true })
        .uncheck();
      await page.reload();
      section = await physical(page, locale);
      await expect(
        section.getByRole("checkbox", { name: t.enabled, exact: true }),
      ).not.toBeChecked();
      await expect(
        section.getByRole("combobox", { name: t.profile, exact: true }),
      ).toContainText(t.r400);
      expect(
        await page.evaluate(() =>
          JSON.parse(localStorage.getItem("teleo.mapping")!),
        ),
      ).toEqual({ KeyQ: "restart" });
    });
  test("R400 actions preserve playback, timer, speed and script; held PageDown acts once", async ({
    page,
  }) => {
    await enable(page);
    await read(page);
    const dock = page.locator(".reader-dock"),
      position = dock.getByRole("slider", { name: en.position, exact: true });
    await position.fill("500");
    expect(await key(page, "Period", { key: "ю" })).toBe(true);
    await expect(
      dock.getByRole("button", { name: en.pause, exact: true }),
    ).toBeVisible();
    expect(await key(page, "Period", { repeat: true })).toBe(true);
    await expect(
      dock.getByRole("button", { name: en.pause, exact: true }),
    ).toBeVisible();
    await key(page, "Period");
    await expect(
      dock.getByRole("button", { name: en.play, exact: true }),
    ).toBeVisible();
    expect(Number(await position.inputValue())).toBeGreaterThanOrEqual(500);
    await expect(dock.locator(".speed-group output")).toHaveText("1.0×");
    await position.press("Home");
    await dock
      .getByRole("button", { name: en.nextParagraph, exact: true })
      .click();
    const next = Number(await position.inputValue());
    await position.press("Home");
    await key(page, "PageDown");
    for (let i = 0; i < 35; i++)
      expect(await key(page, "PageDown", { repeat: true })).toBe(true);
    await expect
      .poll(async () => Number(await position.inputValue()))
      .toBeCloseTo(next, 0);
    await key(page, "PageUp");
    expect(Number(await position.inputValue())).toBeLessThan(next);
    await dock.getByRole("button", { name: en.timer, exact: true }).click();
    await dock
      .getByRole("group", { name: en.timer, exact: true })
      .getByRole("button", { name: `3 ${en.seconds}`, exact: true })
      .click();
    await key(page, "Period");
    await expect(page.locator(".countdown")).toHaveText("3");
    await page.waitForTimeout(1100);
    await key(page, "Period");
    const remaining = Number(await page.locator(".countdown").textContent());
    await key(page, "Period");
    expect(
      Number(await page.locator(".countdown").textContent()),
    ).toBeLessThanOrEqual(remaining);
    await key(page, "Period");
    await key(page, "Escape");
    await expect(page.locator(".reader")).toBeVisible();
    await expect(
      page
        .locator("header")
        .getByRole("combobox", { name: en.currentScript, exact: true }),
    ).toContainText(en.untitled);
  });
  test("unmapped/disabled keys, editor, editable elements, modal and unrelated routes stay untouched", async ({
    page,
  }) => {
    const section = await enable(page);
    expect(await key(page, "Period")).toBe(false);
    expect(await key(page, "F5")).toBe(false);
    await section
      .getByRole("checkbox", { name: en.enabled, exact: true })
      .uncheck();
    await read(page);
    expect(await key(page, "Period")).toBe(false);
    await page.getByRole("button", { name: en.exit, exact: true }).click();
    await enable(page);
    await read(page);
    for (const extra of [
      { metaKey: true },
      { ctrlKey: true },
      { altKey: true },
      { isComposing: true },
    ])
      expect(await key(page, "Period", extra)).toBe(false);
    for (const tag of ["input", "textarea", "div"])
      expect(
        await page.evaluate((tag) => {
          const element = document.createElement(tag);
          if (tag === "div") element.contentEditable = "true";
          document.querySelector(".reader")!.append(element);
          const event = new KeyboardEvent("keydown", {
            key: ".",
            code: "Period",
            bubbles: true,
            cancelable: true,
          });
          element.dispatchEvent(event);
          element.remove();
          return event.defaultPrevented;
        }, tag),
      ).toBe(false);
    await page
      .locator(".reader-top")
      .getByRole("button", { name: en.connect, exact: true })
      .click();
    expect(await key(page, "Period")).toBe(false);
    expect(await key(page, "F5")).toBe(false);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: en.close, exact: true })
      .click();
    await page.goto("/help?lang=en");
    expect(await key(page, "Period")).toBe(false);
    expect(await key(page, "PageDown")).toBe(false);
    await page.goto("/remote?lang=en");
    expect(await key(page, "F5")).toBe(false);
  });
  test("fullscreen events and errors keep Reader and playback without Escape delivery", async ({
    page,
  }, info) => {
    await page.addInitScript(() => {
      const full = { current: null as Element | null };
      Object.defineProperty(document, "fullscreenEnabled", {
        configurable: true,
        get: () => true,
      });
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        get: () => full.current,
      });
      (
        window as unknown as { r400Requests: number; r400Fail: boolean }
      ).r400Requests = 0;
      Element.prototype.requestFullscreen = function () {
        const w = window as unknown as {
          r400Requests: number;
          r400Fail: boolean;
        };
        w.r400Requests++;
        if (w.r400Fail) return Promise.reject(Error("QA denial"));
        Object.assign(full, { current: this });
        document.dispatchEvent(new Event("fullscreenchange"));
        return Promise.resolve();
      };
      document.exitFullscreen = () => {
        full.current = null;
        document.dispatchEvent(new Event("fullscreenchange"));
        return Promise.resolve();
      };
    });
    await enable(page);
    await read(page);
    await key(page, "Period");
    await page.keyboard.press("F5");
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.fullscreenElement?.classList.contains("reader"),
        ),
      )
      .toBe(true);
    await page.keyboard.press("F5");
    expect(
      await page.evaluate(
        () => (window as unknown as { r400Requests: number }).r400Requests,
      ),
    ).toBe(1);
    await page.evaluate(() => document.exitFullscreen());
    await expect(page.locator(".app-shell")).not.toHaveClass(/immersive/);
    await expect(page.locator(".reader")).toBeVisible();
    await expect(
      page
        .locator(".reader-dock")
        .getByRole("button", { name: en.pause, exact: true }),
    ).toBeVisible();
    await key(page, "Escape");
    await expect(page.locator(".reader")).toBeVisible();
    await page.evaluate(() => {
      (window as unknown as { r400Fail: boolean }).r400Fail = true;
    });
    await page.keyboard.press("F5");
    await expect(page.locator(".reader-fullscreen-feedback")).toHaveText(
      en.fullscreenUnavailable,
    );
    await expect(page.locator(".reader")).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/r400-${info.project.name}-fullscreen-fallback.png`,
    });
  });
  test("trusted F5 uses real DOM fullscreen where supported and manual exit never closes Reader", async ({
    page,
  }, info) => {
    await enable(page);
    await read(page);
    const supported = await page.evaluate(
      () =>
        document.fullscreenEnabled &&
        !!document.querySelector(".reader")?.requestFullscreen,
    );
    await page.keyboard.press("F5");
    if (!supported) {
      await expect(page.locator(".reader-fullscreen-feedback")).toHaveText(
        en.fullscreenUnavailable,
      );
      test.info().annotations.push({
        type: "DOM fullscreen",
        description: "Unsupported by this automated browser; fallback verified",
      });
      return;
    }
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(true);
    expect(
      await page.evaluate(() =>
        document.fullscreenElement?.classList.contains("reader"),
      ),
    ).toBe(true);
    console.log(
      info.project.name +
        ": fullscreen geometry " +
        JSON.stringify(
          await page
            .locator(".reader")
            .evaluate((el) => ({
              rect: el.getBoundingClientRect().toJSON(),
              height: innerHeight,
              width: innerWidth,
              position: getComputedStyle(el).position,
              selector: el.matches(":fullscreen"),
            })),
        ),
    );
    const pause = await page.locator(".reader-dock .dock-play").boundingBox();
    expect(pause!.y + pause!.height).toBeLessThanOrEqual(
      await page.evaluate(() => innerHeight),
    );
    await page.screenshot({
      path: `docs/screenshots/r400-${info.project.name}-dom-fullscreen.png`,
    });
    await page.evaluate(() => document.exitFullscreen());
    await expect(page.locator(".app-shell")).not.toHaveClass(/immersive/);
    await expect(page.locator(".reader")).toBeVisible();
    await page.keyboard.press("F5");
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(true);
    await page.evaluate(() => document.exitFullscreen());
    console.log(info.project.name + ": real DOM fullscreen enter/exit passed");
  });
  test("R400 host actions synchronize with an approved independent iPhone remote", async ({
    page,
    browser,
  }, info) => {
    await enable(page);
    await read(page);
    await page
      .locator(".reader-top")
      .getByRole("button", { name: en.connect, exact: true })
      .click();
    const pair = page.getByRole("dialog", {
      name: en.remoteConnection,
      exact: true,
    });
    const invite = await pair
      .getByRole("link", { name: en.invite, exact: true })
      .getAttribute("href");
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      }),
      phone = await context.newPage();
    try {
      await phone.goto(invite!);
      await pair.getByRole("button", { name: en.allow, exact: true }).click();
      await expect(pair).not.toBeVisible();
      await key(page, "Period");
      await expect(
        phone.getByRole("button", { name: en.pause, exact: true }),
      ).toBeVisible();
      await key(page, "Period");
      await expect(
        phone.getByRole("button", { name: en.play, exact: true }),
      ).toBeVisible();
      await key(page, "PageDown");
      await expect
        .poll(() =>
          phone
            .getByRole("slider", { name: en.position, exact: true })
            .inputValue(),
        )
        .not.toBe("0");
      await page
        .locator(".reader-dock")
        .getByRole("button", { name: en.speedUp, exact: true })
        .click();
      await expect(phone.locator(".remote-speed")).toHaveText("1.1×");
      await phone
        .getByRole("button", { name: en.speedUp, exact: true })
        .click();
      await expect(page.locator(".reader-dock .speed-group output")).toHaveText(
        "1.2×",
      );
      await phone
        .getByRole("button", { name: en.quickSettings, exact: true })
        .click();
      const font = phone
        .locator(".remote-quick-menu")
        .getByRole("slider", { name: en.fontSize, exact: true });
      await font.fill("68");
      await font.blur();
      await expect(page.locator(".reader article")).toHaveCSS(
        "font-size",
        "68px",
      );
      await phone.screenshot({
        path: `docs/screenshots/r400-${info.project.name}-paired.png`,
      });
    } finally {
      await context.close();
    }
  });
}
