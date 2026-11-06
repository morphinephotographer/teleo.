import { test, expect, type Page } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
const t = dictionaries.en;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
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

test("Timer and Alignment are round buttons that cycle on each press", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStudio(page);
  await page.getByRole("button", { name: t.read, exact: true }).first().click();
  const toolbar = page.locator(".approved-reader-toolbar");
  await expect(toolbar).toBeVisible();
  // The old wide controls are gone from the desktop toolbar.
  await expect(toolbar.locator(".alignment-control")).toHaveCount(0);
  await expect(toolbar.getByRole("menuitem")).toHaveCount(0);

  const timer = toolbar.locator(".dock-timer");
  const label = (n: number) => `${t.timer}: ${n ? `${n} ${t.seconds}` : t.off}`;
  await expect(timer).toHaveAttribute("aria-label", label(0));
  for (const n of [3, 5, 10, 0]) {
    await timer.click();
    await expect(timer).toHaveAttribute("aria-label", label(n));
    if (n)
      await expect(timer.locator(".dock-cycle-badge")).toHaveText(String(n));
    else await expect(timer.locator(".dock-cycle-badge")).toHaveCount(0);
  }
  const round = await timer.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return (
      Math.abs(r.width - r.height) < 1 && getComputedStyle(el).borderRadius
    );
  });
  expect(round).toBe("50%");

  const alignment = toolbar.locator(".dock-alignment-cycle");
  const text = page.locator(".reading-viewport article");
  for (const [name, css] of [
    [t.alignCenter, "center"],
    [t.alignRight, "right"],
    [t.alignLeft, "left"],
  ] as const) {
    await alignment.click();
    await expect(alignment).toHaveAttribute(
      "aria-label",
      `${t.alignment}: ${name}`,
    );
    await expect(text).toHaveCSS("text-align", css);
  }
  // The choice is kept with the script.
  await alignment.click();
  await page.reload();
  await page.getByRole("button", { name: t.read, exact: true }).first().click();
  await expect(page.locator(".reading-viewport article")).toHaveCSS(
    "text-align",
    "center",
  );
});

for (const width of [1440, 1024, 860, 720, 660, 620, 601])
  test(`Reader toolbar values stay readable at ${width}px`, async ({
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
    for (const cycle of [".dock-timer", ".dock-alignment-cycle"])
      await expect(toolbar.locator(cycle)).toBeVisible();
    const clipped = await toolbar
      .locator(".approved-pill > .picker-trigger span")
      .evaluateAll((list) =>
        list
          .filter((s) => s.scrollWidth > s.clientWidth)
          .map((s) => s.textContent),
      );
    expect(clipped).toEqual([]);
    // Nothing overflows the toolbar itself.
    const overflow = await toolbar.evaluate(
      (el) => el.scrollWidth - el.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
