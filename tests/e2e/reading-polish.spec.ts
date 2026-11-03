import { test, expect, type Page } from "@playwright/test";
import { dictionaries, type Locale } from "../../apps/web/src/i18n";
import { welcomeBodies } from "../../apps/web/src/welcome";
import { chooseSelect } from "./helpers";
const t = dictionaries.en;
const body = Array.from({ length: 100 }, (_, i) =>
  `Paragraph ${i + 1}. Your words, your pace. A clear voice carries this story forward. `.repeat(
    5,
  ),
).join("\n\n");
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
    if (!localStorage.getItem("teleo.locale"))
      localStorage.setItem("teleo.locale", "en");
    if (!localStorage.getItem("teleo.demo.auto"))
      localStorage.setItem("teleo.demo.auto", "false");
  });
  await page.setExtraHTTPHeaders({ "CF-Connecting-IP": crypto.randomUUID() });
});
async function settings(page: Page) {
  const trigger = page.locator(".app-shell > header .top-settings > button");
  const id = await trigger.getAttribute("aria-controls");
  const menu = page.locator(`[id="${id}"]`);
  if (!(await menu.isVisible())) await trigger.click();
  await expect(menu).toBeVisible();
  return menu;
}
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
async function create(page: Page) {
  await page.goto("/studio");
  await expect(
    (await settings(page)).locator(".welcome-preference input"),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: t.newScript, exact: true })
    .first()
    .click();
  await page.getByRole("textbox", { name: t.body, exact: true }).fill(body);
  await page.getByRole("textbox", { name: t.body, exact: true }).blur();
  await saved(page);
}
async function language(page: Page, locale: Locale) {
  const current = (await page.locator("html").getAttribute("lang")) as Locale;
  await chooseSelect(
    (await settings(page)).getByRole("combobox", {
      name: dictionaries[current].language,
      exact: true,
    }),
    locale,
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}
async function coordinate(page: Page, selector: string, focus: number) {
  return page.locator(selector).evaluate(
    async (view, { body, focus }) => {
      const path = "/src/text-position.ts";
      const { textOffsetAtView } = await import(path);
      let offset = 0;
      const blocks = body.split("\n\n").map((text) => {
        const b = { text, offset };
        offset += text.length + 2;
        return b;
      });
      return textOffsetAtView(view, blocks, focus);
    },
    { body, focus },
  );
}
test("Welcome follows UI language only while pristine; edits, deletion and restoration remain safe", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("polish.seeded")) {
      localStorage.setItem("teleo.locale", "ru");
      localStorage.setItem("teleo.demo.auto", "true");
      sessionStorage.setItem("polish.seeded", "true");
    }
  });
  await page.goto("/studio");
  await expect(
    page.getByRole("textbox", { name: dictionaries.ru.body, exact: true }),
  ).toHaveValue(welcomeBodies.ru);
  for (const locale of ["uk", "en", "ru"] as const) {
    await language(page, locale);
    await expect(
      page.getByRole("textbox", {
        name: dictionaries[locale].body,
        exact: true,
      }),
    ).toHaveValue(welcomeBodies[locale]);
    await expect(page.locator(".script-row")).toHaveCount(1);
  }
  await page
    .getByRole("textbox", { name: dictionaries.ru.body, exact: true })
    .fill("My own edited Welcome — keep this text.");
  await language(page, "en");
  await expect(
    page.getByRole("textbox", { name: t.body, exact: true }),
  ).toHaveValue("My own edited Welcome — keep this text.");
  await saved(page);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: t.body, exact: true }),
  ).toHaveValue("My own edited Welcome — keep this text.");
  await page.locator(".script-row > button:first-child").focus();
  await page.keyboard.press("Tab");
  await expect(
    page.locator(".script-row .library-action-rename"),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".script-row .library-action-trash")).toBeFocused();
  await page.keyboard.press("Enter");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: t.confirm, exact: true })
    .click();
  await expect(page.locator(".script-row")).toHaveCount(0);
  await page.reload();
  await expect(
    (await settings(page)).locator(".welcome-preference input"),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(page.locator(".script-row")).toHaveCount(0);
  await language(page, "uk");
  await page.locator(".library-trash-row").click();
  await page.locator(".script-row .library-row-actions").hover();
  await page.locator(".library-action-restore").click();
  await expect(
    page.getByRole("textbox", { name: dictionaries.uk.body, exact: true }),
  ).toHaveValue("My own edited Welcome — keep this text.");
  await expect(page.locator(".script-row")).toHaveCount(1);
});
test("settings own language/themes; dock hides immediately on Play and returns on Pause without guide movement", async ({
  page,
}, info) => {
  await create(page);
  await expect(
    page.locator(".app-shell > header > .language-control"),
  ).toHaveCount(0);
  await expect(page.locator(".top-appearance")).toHaveCount(0);
  const menu = await settings(page);
  await expect(
    menu.getByRole("combobox", { name: t.language, exact: true }),
  ).toBeVisible();
  const theme = menu.getByRole("button", {
    name: t.interfaceTheme,
    exact: true,
  });
  await theme.click();
  await theme.click();
  await expect(page.locator(".app-shell")).toHaveClass(/theme-dark/);
  await page.screenshot({ path: info.outputPath("settings.png") });
  await page.keyboard.press("Escape");
  for (const [width, height] of [
    [1440, 900],
    [834, 1112],
  ]) {
    await page.setViewportSize({ width, height });
    await page.getByRole("button", { name: t.read, exact: true }).click();
    const toolbar = page.locator(".approved-reader-toolbar");
    await expect(toolbar).toBeVisible();
    const guide = await page.locator(".guide").boundingBox();
    const viewport = await page.locator(".reading-viewport").boundingBox();
    await toolbar.getByRole("button", { name: t.play, exact: true }).click();
    await expect(toolbar).toBeHidden({ timeout: 500 });
    await expect(page.locator(".reader-pause")).toBeVisible();
    expect(await page.locator(".guide").boundingBox()).toEqual(guide);
    expect(await page.locator(".reading-viewport").boundingBox()).toEqual(
      viewport,
    );
    await page.screenshot({
      path: info.outputPath(`playing-${width}.png`),
    });
    await page.locator(".reader-pause").click();
    await expect(toolbar).toBeVisible({ timeout: 500 });
    await expect(page.locator(".reader-pause")).toHaveCount(0);
    await page.screenshot({
      path: info.outputPath(`paused-${width}.png`),
    });
    await page.keyboard.press("Space");
    await expect(toolbar).toBeHidden();
    await page.keyboard.press("Space");
    await expect(toolbar).toBeVisible();
    await page.getByRole("button", { name: t.editor, exact: true }).click();
    await expect(page.locator(".reader-controls")).toHaveCount(0);
  }
});
test("document edge actions are keyboard reachable and deletes only the chosen script", async ({
  page,
}, info) => {
  await create(page);
  await page
    .getByRole("textbox", { name: t.title, exact: true })
    .fill("Script A");
  await saved(page);
  await page
    .getByRole("button", { name: t.newScript, exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: t.title, exact: true })
    .fill("Script B");
  await page
    .getByRole("textbox", { name: t.body, exact: true })
    .fill("Keep script B.");
  await saved(page);
  const row = page
    .locator(".script-row")
    .filter({ has: page.locator("strong", { hasText: "Script A" }) });
  const remove = row.locator(".library-action-trash");
  await page.mouse.move(0, 0);
  await expect(remove).toHaveCSS("opacity", "0");
  const rect = await row.boundingBox();
  await row.hover();
  expect(await row.boundingBox()).toEqual(rect);
  await row.locator(".library-document").focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(remove).toBeFocused();
  await page.screenshot({
    path: `test-results/library/polish-${info.project.name}-script-menu.png`,
  });
  await remove.click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: t.confirm, exact: true })
    .click();
  await expect(page.locator(".script-row")).toHaveCount(1);
  await expect(
    page.getByRole("textbox", { name: t.body, exact: true }),
  ).toHaveValue("Keep script B.");
});
test("phone seeks animate during drag; fixed 18pt text stays on the host guide through typography and touch", async ({
  page,
  browser,
  browserName,
}, info) => {
  test.setTimeout(90000);
  await create(page);
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
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    serviceWorkers: "block",
    reducedMotion: "no-preference",
  });
  const phone = await context.newPage();
  let seeks = 0;
  phone.on("websocket", (ws) =>
    ws.on("framesent", (frame) => {
      const m = JSON.parse(String(frame.payload));
      if (m.type === "command" && m.command.action === "seek") seeks++;
    }),
  );
  try {
    await phone.goto(invite!);
    await dialog.getByRole("button", { name: t.allow, exact: true }).click();
    await expect(phone.locator(".remote-text")).toContainText(t.previewPrivate);
    await expect(phone.locator(".remote-position-guide")).toHaveCount(0);
    await expect(phone.locator(".remote-text")).toHaveCSS("padding-top", "4px");
    await page
      .locator("header")
      .getByRole("button", { name: t.remoteConnection, exact: true })
      .click();
    await dialog
      .getByRole("checkbox", { name: t.allowPreview, exact: true })
      .check();
    await dialog.getByRole("button", { name: t.close, exact: true }).click();
    await expect(phone.locator(".remote-text")).toContainText("Paragraph 100");
    await page.getByRole("button", { name: t.read, exact: true }).click();
    const text = phone.locator(".remote-text");
    await expect
      .poll(() =>
        phone.evaluate(() => {
          const frame = document
            .querySelector(".remote-text-frame")!
            .getBoundingClientRect();
          const text = document
            .querySelector(".remote-text")!
            .getBoundingClientRect();
          const timeline = document
            .querySelector(".remote-timeline")!
            .getBoundingClientRect();
          return Math.max(
            Math.abs(frame.height - text.height),
            Math.abs(frame.y - text.y),
            Math.max(0, text.bottom - timeline.top),
          );
        }),
      )
      .toBeLessThan(1);
    await expect(text).toHaveCSS("font-size", "24px");
    await expect
      .poll(() =>
        text.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight)),
      )
      .toBeCloseTo(38.4, 4);
    await expect(phone.locator(".remote-header .language-control")).toHaveCount(
      0,
    );
    const slider = phone.getByRole("slider", { name: t.position, exact: true });
    await expect(slider).toBeEnabled();
    const positions: number[] = [];
    const dragStarted = performance.now();
    await slider.dispatchEvent("pointerdown");
    for (let i = 0; i < 36; i++) {
      await slider.fill(String(100 + i * 2));
      await phone.waitForTimeout(40);
      positions.push(await text.evaluate((el) => el.scrollTop));
    }
    expect(new Set(positions.map((p) => Math.round(p))).size).toBeGreaterThan(
      3,
    );
    await slider.dispatchEvent("pointerup");
    const dragDuration = performance.now() - dragStarted;
    await expect
      .poll(async () =>
        Math.abs(
          (await coordinate(page, ".reading-viewport", 35)) -
            (await coordinate(phone, ".remote-text", 35)),
        ),
      )
      .toBeLessThan(2);
    await page
      .locator(".approved-reader-toolbar")
      .getByRole("button", { name: t.focusLine, exact: true })
      .click();
    await page
      .getByRole("dialog", { name: t.focusLine, exact: true })
      .getByRole("slider")
      .fill("60");
    await page.keyboard.press("Escape");
    await expect
      .poll(async () => {
        const r = (await phone.locator(".remote-text-frame").boundingBox())!,
          g = (await phone.locator(".remote-position-guide").boundingBox())!;
        return (g.y - r.y) / r.height;
      })
      .toBeCloseTo(0.6, 2);
    await expect
      .poll(async () =>
        Math.abs(
          (await coordinate(page, ".reading-viewport", 60)) -
            (await coordinate(phone, ".remote-text", 60)),
        ),
      )
      .toBeLessThan(2);
    await phone
      .getByRole("button", { name: t.quickSettings, exact: true })
      .click();
    for (const [key, value] of [
      ["fontSize", 80],
      ["lineHeight", 2.2],
      ["textWidth", 1000],
    ] as const) {
      const control = phone
        .locator(".quick-typography")
        .getByRole("slider", { name: t[key], exact: true });
      await control.fill(String(value));
      await control.dispatchEvent("pointerup");
      await expect(text).toHaveCSS("font-size", "24px");
      await expect
        .poll(() =>
          text.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight)),
        )
        .toBeCloseTo(38.4, 4);
    }
    await expect(page.locator(".reader article")).toHaveCSS(
      "font-size",
      "80px",
    );
    await expect(page.locator(".reader article")).toHaveCSS(
      "line-height",
      "176px",
    );
    await expect(page.locator(".reader article")).toHaveCSS(
      "max-width",
      "1000px",
    );
    await phone.locator(".remote-inline-heading").getByRole("button").click();
    await expect
      .poll(async () =>
        Math.abs(
          (await coordinate(page, ".reading-viewport", 60)) -
            (await coordinate(phone, ".remote-text", 60)),
        ),
      )
      .toBeLessThan(2);
    await phone.screenshot({
      path: `docs/screenshots/polish-${info.project.name}-phone.png`,
    });
    // At 18pt local text and 80px/2.2 host text, 1x is only a few local pixels per second.
    // Use 3x so native integer scrollTop exposes enough separate frames to measure smoothing.
    await page
      .locator(".approved-reader-toolbar")
      .getByRole("button", { name: t.speed, exact: true })
      .click();
    await page
      .getByRole("dialog", { name: t.speed, exact: true })
      .getByRole("slider")
      .fill("3");
    await page.keyboard.press("Escape");
    await phone.getByRole("button", { name: t.play, exact: true }).click();
    await expect(page.locator(".approved-reader-toolbar")).toBeHidden();
    await phone.waitForTimeout(600);
    const frames = await text.evaluate(async (el) => {
      const values: number[] = [],
        start = performance.now();
      await new Promise<void>((resolve) => {
        const next = () => {
          values.push(el.scrollTop);
          if (performance.now() - start > 800) resolve();
          else requestAnimationFrame(next);
        };
        requestAnimationFrame(next);
      });
      return values;
    });
    expect(new Set(frames.map((v) => Math.round(v * 10))).size).toBeGreaterThan(
      8,
    );
    await page.locator(".reader-pause").click();
    await expect(page.locator(".approved-reader-toolbar")).toBeVisible();
    await expect
      .poll(async () =>
        Math.abs(
          (await coordinate(page, ".reading-viewport", 60)) -
            (await coordinate(phone, ".remote-text", 60)),
        ),
      )
      .toBeLessThan(2);
    if (browserName === "chromium") {
      const cdp = await context.newCDPSession(phone),
        r = (await text.boundingBox())!;
      const x = r.x + r.width / 2,
        y = r.y + Math.min(180, r.height - 20);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      for (const dy of [20, 40, 60, 80]) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y: y - dy }],
        });
        await phone.waitForTimeout(70);
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } else {
      await text.dispatchEvent("touchstart");
      await text.evaluate((el) => {
        el.scrollTop += 80;
        el.dispatchEvent(new Event("scroll"));
      });
      await text.dispatchEvent("touchend");
    }
    await expect
      .poll(async () =>
        Math.abs(
          (await coordinate(page, ".reading-viewport", 60)) -
            (await coordinate(phone, ".remote-text", 60)),
        ),
      )
      .toBeLessThan(2);
    expect(seeks).toBeLessThanOrEqual(Math.ceil(dragDuration / 200) + 8);
    await phone
      .getByRole("button", { name: t.advancedSettings, exact: true })
      .click();
    await expect(
      phone.locator(".remote-settings-page .language-control"),
    ).toBeVisible();
    await phone
      .getByRole("button", { name: t.expandedText, exact: true })
      .click();
    await expect(text).toHaveCSS("font-size", "24px");
    await page
      .locator("header")
      .getByRole("button", { name: t.remoteConnection, exact: true })
      .click();
    await dialog
      .getByRole("checkbox", { name: t.allowPreview, exact: true })
      .uncheck();
    await expect(text).toContainText(t.previewPrivate);
    await expect(text).not.toContainText("Paragraph 16");
    await expect(phone.locator(".remote-position-guide")).toHaveCount(0);
    await expect(text).toHaveCSS("padding-top", "4px");
    await dialog.getByRole("button", { name: t.revoke, exact: true }).click();
    await expect(phone.locator(".remote-reconnect button")).toBeVisible();
    const frame = (await phone.locator(".remote-text-frame").boundingBox())!,
      reconnect = (await phone
        .locator(".remote-reconnect button")
        .boundingBox())!;
    expect(reconnect.y + reconnect.height).toBeLessThanOrEqual(
      frame.y + frame.height,
    );
  } finally {
    await context.close();
  }
});
