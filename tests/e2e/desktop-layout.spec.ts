import { test, expect } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
const t = dictionaries.en;
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
    localStorage.setItem("teleo.locale", "en");
  });
});
test("wide desktop keeps library and aligns header modes to editor", async ({
  page,
}) => {
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
    await expect(page.locator("header > .script-selector")).toBeHidden();
    const modes = page.locator("header > .segmented");
    await expect(modes).toBeVisible();
    const modeRect = (await modes.boundingBox())!,
      editor = (await page.locator(".editor").boundingBox())!;
    expect(Math.abs(modeRect.x - editor.x)).toBeLessThan(1);
    expect(
      await page
        .locator("header > .brand")
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBe(30);
    await expect(page.locator(".desktop-workspace-mode")).toHaveCount(0);
  }
  await page.screenshot({ path: "test-results/desktop-layout/wide.png" });
  await page
    .locator("header > .segmented")
    .getByRole("button", { name: t.read, exact: true })
    .click();
  await expect(page.locator(".reader")).toBeVisible();
});
test("touch tablets and phones retain header modes, logo and sidebar controls", async ({
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
      await expect(page.locator("header > .segmented")).toBeVisible();
      await expect(page.locator(".desktop-workspace-mode")).toBeHidden();
      await expect(
        page
          .locator("header")
          .getByRole("button", { name: t.library, exact: true }),
      ).toBeVisible();
      expect(
        await page
          .locator("header > .brand")
          .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ).toBeLessThan(60);
    }
  } finally {
    await context.close();
  }
});
