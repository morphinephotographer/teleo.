import { expect, test } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";

const t = dictionaries.en;
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
    if (!localStorage.getItem("teleo.tour.v130"))
      localStorage.setItem("teleo.tour.v130", "force");
  });
});

test("1.3.0 tour walks editor, tools, phone, Reader and voice once", async ({
  page,
}) => {
  await page.goto("/studio");
  for (const title of [
    t.tourEditorTitle,
    t.tourToolsTitle,
    t.tourPhoneTitle,
    t.tourReadTitle,
  ]) {
    await expect(page.getByRole("dialog", { name: title })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator(".tour-spotlight")).toBeVisible();
    await page.getByRole("button", { name: t.tourNext, exact: true }).click();
  }
  // The voice step opens Reader for the tour.
  await expect(
    page.getByRole("dialog", { name: t.tourVoiceTitle }),
  ).toBeVisible();
  await expect(page.locator(".reader")).toBeVisible();
  await page.getByRole("button", { name: t.tourBack, exact: true }).click();
  await expect(page.locator(".reader")).toHaveCount(0);
  await page.getByRole("button", { name: t.tourNext, exact: true }).click();
  await page.getByRole("button", { name: t.tourFinish, exact: true }).click();
  await expect(page.locator(".tour")).toHaveCount(0);
  await expect(page.locator(".reader")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".editor textarea")).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.locator(".tour")).toHaveCount(0);
});

test("Escape closes the tour and remembers it", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.locator(".tour-card")).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press("Escape");
  await expect(page.locator(".tour")).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("teleo.tour.v130")),
  ).toBe("done");
});
