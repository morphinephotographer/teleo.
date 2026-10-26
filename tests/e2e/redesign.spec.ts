import { test, expect, type Page } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
const en = dictionaries.en;
async function skipSession(page: Page) {
  await page.addInitScript(() =>
    sessionStorage.setItem("teleo.intro.seen.v1", "true"),
  );
}
async function create(page: Page) {
  await page.goto("/?lang=en");
  await page
    .getByRole("button", { name: en.newScript, exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: en.title, exact: true })
    .fill("The art of a clear voice.");
  await page
    .getByRole("textbox", { name: en.body, exact: true })
    .fill(
      "Take a breath. Find your rhythm.\n\nYour words deserve a little space.\n\nOne thought. One moment. One clear voice.\n\n".repeat(
        20,
      ),
    );
}
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
}
test("intro resolves, dismisses automatically and never replays during navigation or reload", async ({
  page,
}, info) => {
  await page.goto("/?lang=en");
  const intro = page.getByRole("dialog", { name: "teleo.", exact: true });
  await expect(intro).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveAttribute("inert", "");
  await page.waitForTimeout(2200);
  await page.screenshot({
    path: `docs/screenshots/premium-${info.project.name}-intro.png`,
  });
  await expect(intro).toHaveCount(0, { timeout: 2500 });
  await expect(page.locator(".workspace")).toBeVisible();
  await page.getByLabel(en.menu, { exact: true }).click();
  await page.getByRole("link", { name: en.help, exact: true }).click();
  await page.getByRole("button", { name: en.launch, exact: true }).click();
  await expect(page.locator(".brand-intro")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".workspace")).toBeVisible();
  await expect(page.locator(".brand-intro")).toHaveCount(0);
});
test("intro skip works by keyboard and restores application focus", async ({
  page,
}) => {
  await page.goto("/studio?lang=uk");
  const skip = page.getByRole("button", {
    name: dictionaries.uk.skip,
    exact: true,
  });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".brand-intro")).toHaveCount(0);
  await expect(page.locator("header .brand")).toBeFocused();
  await page
    .getByRole("button", { name: dictionaries.uk.newScript, exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("textbox", { name: dictionaries.uk.body, exact: true }),
  ).toBeVisible();
});
test("reduced motion bypasses intro; remote deep links are never covered", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?lang=ru");
  await expect(page.locator(".workspace")).toBeVisible();
  await expect(page.locator(".brand-intro")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/remote?lang=ru");
  await expect(page.locator(".controller")).toBeVisible();
  await expect(page.locator(".brand-intro")).toHaveCount(0);
});
test("session storage denial still permits skipping and internal navigation", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw Error("disabled");
      },
    }),
  );
  await page.goto("/?lang=en");
  await page.getByRole("button", { name: en.skip, exact: true }).click();
  await page.getByLabel(en.menu, { exact: true }).click();
  await page.getByRole("link", { name: en.help, exact: true }).click();
  await page.getByRole("button", { name: en.launch, exact: true }).click();
  await expect(page.locator(".brand-intro")).toHaveCount(0);
});
for (const locale of ["en", "uk", "ru"] as const) {
  test(`${locale}: desktop, tablet and phone layouts preserve editing and prompting`, async ({
    page,
  }, info) => {
    await skipSession(page);
    const t = dictionaries[locale];
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
      await page.goto("/studio?lang=" + locale);
      if (!(await page.locator(".script-list button").count()))
        await page
          .getByRole("button", { name: t.newScript, exact: true })
          .first()
          .click();
      const body = page.getByRole("textbox", { name: t.body, exact: true });
      await body.fill(
        "Take a breath.\n\nFind your rhythm.\n\nYour words. Your pace.\n\n".repeat(
          30,
        ),
      );
      await body.blur();
      await expect(page.locator(".document-metrics")).toContainText(t.words);
      await fits(page);
      await expect(body).toBeInViewport();
      if (
        info.project.name === "desktop" &&
        [1440, 834, 390].includes(size.width)
      )
        await page.screenshot({
          path: `docs/screenshots/premium-${locale}-${size.width}-editor.png`,
        });
      await page.getByRole("button", { name: t.read, exact: true }).click();
      const dock = page.locator(".reader-controls");
      await dock.getByRole("button", { name: t.play, exact: true }).click();
      await page.waitForTimeout(200);
      expect(
        Number(
          await page
            .getByRole("slider", { name: t.position, exact: true })
            .inputValue(),
        ),
      ).toBeGreaterThan(0);
      await dock.getByRole("button", { name: t.pause, exact: true }).click();
      await dock.getByRole("button", { name: t.speedUp, exact: true }).click();
      await expect(dock.locator("output")).toContainText("1.25");
      await dock
        .getByRole("button", { name: t.mirrorHorizontal, exact: true })
        .click();
      await expect(
        dock.getByRole("button", { name: t.mirrorHorizontal, exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(
        await page
          .locator(".reading-viewport article")
          .evaluate((el) => getComputedStyle(el).transform),
      ).toContain("-1");
      await dock
        .getByRole("button", { name: t.mirrorHorizontal, exact: true })
        .click();
      await expect(
        dock.getByRole("button", { name: t.play, exact: true }),
      ).toBeInViewport();
      const reader = page.locator(".reader");
      expect(
        await reader.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
      ).toBe(true);
      await fits(page);
      if (
        info.project.name === "desktop" &&
        [1440, 834, 390].includes(size.width)
      )
        await page.screenshot({
          path: `docs/screenshots/premium-${locale}-${size.width}-reader.png`,
        });
      await page.getByRole("button", { name: t.exit, exact: true }).click();
      // Set portable preferences back before the next viewport iteration.
      await page
        .locator("header")
        .getByRole("button", { name: t.settings, exact: true })
        .click();
      const sheet = page.getByRole("dialog");
      await sheet
        .getByRole("checkbox", { name: t.mirrorHorizontal, exact: true })
        .uncheck();
      await sheet.getByRole("slider", { name: t.speed, exact: true }).fill("1");
      await sheet.getByRole("button", { name: t.close, exact: true }).click();
      await expect(
        page.getByRole("status").filter({ hasText: t.saved }),
      ).toBeVisible();
    }
  });
}
test("settings sheet traps focus, persists preferences and Escape preserves reader", async ({
  page,
}, info) => {
  await skipSession(page);
  await create(page);
  await page.getByRole("button", { name: en.read, exact: true }).click();
  await page
    .locator("header")
    .getByRole("button", { name: en.settings, exact: true })
    .click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await sheet
    .getByRole("slider", { name: en.fontSize, exact: true })
    .fill("52");
  await sheet
    .getByRole("slider", { name: en.focusPosition, exact: true })
    .fill("45");
  await sheet
    .getByRole("checkbox", { name: en.focusDimming, exact: true })
    .check();
  await sheet
    .getByRole("group", { name: en.interfaceTheme, exact: true })
    .getByRole("button", { name: en.dark, exact: true })
    .click();
  await sheet.locator(".settings").evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({
    path: `docs/screenshots/premium-${info.project.name}-settings.png`,
  });
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      Boolean(document.activeElement?.closest("dialog")),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();
  await expect(page.locator(".reader")).toBeVisible();
  await expect(page.locator(".reading-viewport")).toHaveClass(
    /dim-surroundings/,
  );
  await page.getByRole("button", { name: en.exit, exact: true }).click();
  await page.reload();
  await expect(page.locator(".app-shell")).toHaveClass(/theme-dark/);
  await page
    .locator("header")
    .getByRole("button", { name: en.settings, exact: true })
    .click();
  await expect(
    sheet.getByRole("slider", { name: en.fontSize, exact: true }),
  ).toHaveValue("52");
});
test("viewport fullscreen fallback, collapsible library and simulated keyboard resize", async ({
  page,
}) => {
  await skipSession(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await create(page);
  await page.getByRole("textbox", { name: en.body, exact: true }).focus();
  await page.evaluate(() => {
    Object.defineProperty(visualViewport!, "height", {
      configurable: true,
      value: 480,
    });
    visualViewport!.dispatchEvent(new Event("resize"));
  });
  expect(
    await page
      .locator(".app-shell")
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBeLessThanOrEqual(480);
  await expect(
    page.getByRole("textbox", { name: en.body, exact: true }),
  ).toBeInViewport();
  await page.evaluate(() => {
    delete (visualViewport as unknown as Record<string, unknown>).height;
    visualViewport!.dispatchEvent(new Event("resize"));
  });
  await page
    .locator("header")
    .getByRole("button", { name: en.library, exact: true })
    .click();
  await expect(page.locator(".library")).toBeVisible();
  await page
    .getByRole("button", { name: en.closeLibrary, exact: true })
    .click();
  await expect(page.locator(".library")).not.toBeVisible();
  await page.getByRole("button", { name: en.read, exact: true }).click();
  await page.evaluate(() =>
    Object.defineProperty(document, "fullscreenEnabled", {
      value: false,
      configurable: true,
    }),
  );
  await page
    .locator(".reader-controls")
    .getByRole("button", { name: en.fullscreen, exact: true })
    .click();
  await expect(page.locator(".app-shell")).toHaveClass(/immersive/);
  await page
    .locator(".reader-controls")
    .getByRole("button", { name: en.fullscreen, exact: true })
    .click();
  await expect(page.locator(".app-shell")).not.toHaveClass(/immersive/);
  await fits(page);
  await page
    .locator("header")
    .getByRole("button", { name: en.library, exact: true })
    .click();
  await expect(page.locator(".reader")).toHaveCount(0);
  await expect(page.locator(".library")).toBeVisible();
});
