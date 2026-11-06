import { test, expect } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
const t = dictionaries.en;
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
    localStorage.setItem("teleo.locale", "en");
  });
});
test("wide desktop keeps library and centres the script title", async ({
  page,
}, info) => {
  test.skip(
    info.project.name === "mobile",
    "the wide layout is for a mouse or trackpad",
  );
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto("/studio");
  await expect(page.locator(".editor textarea")).toHaveValue(/Welcome/);
  await page.getByRole("button", { name: t.closeLibrary, exact: true }).click();
  for (const width of [1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const library = page.locator(".library");
    await expect(library).toBeVisible();
    await expect(
      page
        .locator("header")
        .getByRole("button", { name: t.library, exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: t.closeLibrary, exact: true }),
    ).toBeHidden();
    // 1.4 top bar: the script title sits on the screen's centre line.
    const title = (await page
      .locator("header .script-selector .picker-trigger")
      .boundingBox())!;
    expect(Math.abs(title.x + title.width / 2 - width / 2)).toBeLessThan(2);
    await expect(page.locator("header .topbar-read")).toBeVisible();
    expect(
      await page
        .locator("header .brand")
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBe(53);
    expect(
      (await page.locator(".app-shell > header").boundingBox())!.height,
    ).toBe(52);
    await expect(page.locator(".desktop-workspace-mode")).toHaveCount(0);
  }
  await page.screenshot({ path: "test-results/desktop-layout/wide.png" });
  await page
    .locator("header")
    .getByRole("button", { name: t.read, exact: true })
    .click();
  await expect(page.locator(".reader")).toBeVisible();
});
test("touch tablets and phones keep Read, logo and sidebar controls", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 1366, height: 1024 },
  });
  const page = await context.newPage();
  await page.addInitScript(() =>
    sessionStorage.setItem("teleo.intro.seen.v1", "true"),
  );
  try {
    for (const [width, height] of [
      [1366, 1024],
      [1024, 768],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto("/studio");
      await expect(page.locator("header .topbar-read")).toBeVisible();
      await expect(page.locator(".desktop-workspace-mode")).toBeHidden();
      // iPad in landscape pins the library open; elsewhere it has a toggle.
      const pinned = width > 900 && width > height;
      await expect(
        page
          .locator("header")
          .getByRole("button", { name: t.library, exact: true }),
      ).toBeVisible({ visible: !pinned });
      if (pinned) await expect(page.locator(".library")).toBeVisible();
      expect(
        await page
          .locator("header .brand")
          .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ).toBeLessThan(60);
    }
  } finally {
    await context.close();
  }
});

test("iPad status bar leaves room above the editor and windowed reader after rotation", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  // Desktop browser runners report zero safe-area insets. Substitute a controllable
  // inset in the served stylesheet to exercise the installed iPad layout.
  await page.route("**/*.css", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replaceAll(
        "env(safe-area-inset-top)",
        "var(--test-safe-area-top, 0px)",
      ),
    });
  });
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
    localStorage.setItem("teleo.locale", "en");
  });
  try {
    for (const [width, height] of [
      [1390, 970],
      [970, 1390],
      [820, 1180],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto("/studio");
      await expect(page.locator(".editor textarea")).toHaveValue(/Welcome/);
      const header = page.locator(".app-shell > header");
      const editor = page.locator(".editor");
      const originalHeader = (await header.boundingBox())!;
      const originalEditor = (await editor.boundingBox())!;
      await page.evaluate(() =>
        document.documentElement.style.setProperty(
          "--test-safe-area-top",
          "24px",
        ),
      );
      const shiftedHeader = (await header.boundingBox())!;
      const shiftedEditor = (await editor.boundingBox())!;
      expect(shiftedHeader.y - originalHeader.y).toBe(24);
      expect(shiftedEditor.y - originalEditor.y).toBe(24);
      expect(shiftedEditor.y + shiftedEditor.height).toBeLessThanOrEqual(
        height,
      );
      await header.getByRole("button", { name: t.read, exact: true }).click();
      const reader = page.locator(".reader");
      await expect(reader).toBeVisible();
      if (await page.locator(".app-shell.immersive").count()) {
        await page
          .locator(".reader-top")
          .getByRole("button", { name: t.fullscreen, exact: true })
          .click();
      }
      await expect(reader).toHaveCSS("margin-top", "24px");
      const shiftedReader = (await reader.boundingBox())!;
      expect(shiftedReader.y).toBeGreaterThanOrEqual(
        shiftedHeader.y + shiftedHeader.height,
      );
      expect(shiftedReader.y + shiftedReader.height).toBeLessThanOrEqual(
        height,
      );
      await page.evaluate(() =>
        document.documentElement.style.setProperty(
          "--test-safe-area-top",
          "0px",
        ),
      );
      await expect(reader).toHaveCSS("margin-top", "0px");
      await expect
        .poll(async () => shiftedReader.y - (await reader.boundingBox())!.y)
        .toBe(24);
    }
  } finally {
    await context.close();
  }
});
