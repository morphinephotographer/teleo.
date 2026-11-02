import { test, expect, type Page } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
const t = dictionaries.en;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
  });
});

async function openStudio(page: Page) {
  await page.goto("/studio?lang=en");
  await expect(
    page.getByRole("button", { name: t.read, exact: true }).first(),
  ).toBeVisible();
}

test("Trash, Import and Open last icons share one column", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStudio(page);
  await expect(page.locator(".library-footer")).toBeVisible();
  const left = (selector: string) =>
    page.locator(selector).evaluate((el) => el.getBoundingClientRect().left);
  const trash = await left(".library-trash-row > svg");
  const imported = await left(".library-footer > button:nth-of-type(1) > svg");
  const last = await left(".library-footer > button:nth-of-type(2) > svg");
  expect(Math.abs(trash - imported)).toBeLessThanOrEqual(1);
  expect(Math.abs(trash - last)).toBeLessThanOrEqual(1);
});

test("Reader hides the editor workspace behind it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStudio(page);
  const workspace = page.locator("main.workspace");
  await page.getByRole("button", { name: t.read, exact: true }).first().click();
  await expect(page.locator(".reader")).toBeVisible();
  await expect(workspace).toBeHidden();
  await page
    .locator(".reader-top")
    .getByRole("button", { name: t.exit, exact: true })
    .click();
  await expect(workspace).toBeVisible();
});

for (const width of [1440, 1024, 860, 720, 660])
  test(`Reader toolbar keeps alignment and values readable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await openStudio(page);
    await page
      .getByRole("button", { name: t.read, exact: true })
      .first()
      .click();
    const toolbar = page.locator(".approved-reader-toolbar");
    await expect(toolbar).toBeVisible();
    const buttons = await toolbar
      .locator(".alignment-control button")
      .evaluateAll((list) => list.map((b) => b.getBoundingClientRect().width));
    expect(buttons).toHaveLength(3);
    for (const w of buttons) expect(w).toBeGreaterThanOrEqual(28);
    const clipped = await toolbar
      .locator(".approved-pill > .picker-trigger span")
      .evaluateAll((list) =>
        list
          .filter((s) => s.scrollWidth > s.clientWidth + 1)
          .map((s) => s.textContent),
      );
    expect(clipped).toEqual([]);
    // Nothing overflows the toolbar itself.
    const overflow = await toolbar.evaluate(
      (el) => el.scrollWidth - el.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
