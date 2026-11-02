import { test, expect } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
import { MATRIX_LANDED } from "../../apps/web/src/intro-matrix";

for (const locale of ["en", "uk", "ru"] as const)
  test(`${locale}: intro #1 assembles teleo. and skip sits at the bottom centre`, async ({
    page,
  }) => {
    const t = dictionaries[locale];
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript(
      (l) => localStorage.setItem("teleo.locale", l),
      locale,
    );
    await page.clock.install();
    await page.goto(`/studio?lang=${locale}`);
    const intro = page.getByRole("dialog", { name: "teleo.", exact: true });
    await expect(intro).toBeVisible();
    await expect(intro.locator("canvas.intro-rain")).toBeVisible();
    const skip = intro.getByRole("button", { name: t.skip, exact: true });
    await expect(skip).toBeFocused();
    const box = (await skip.boundingBox())!;
    const view = page.viewportSize()!;
    expect(Math.abs(box.x + box.width / 2 - view.width / 2)).toBeLessThan(2);
    expect(view.height - (box.y + box.height)).toBeLessThan(80);
    expect(box.y).toBeGreaterThan(view.height / 2);

    await page.clock.runFor(MATRIX_LANDED + 200);
    const word = intro.locator(".intro-static");
    await expect(word).toHaveText("teleo.");
    await expect(word.locator("span").last()).toBeVisible();
    await page.clock.runFor(1200);
    await expect(page.locator(".brand-intro")).toHaveCount(0);
    await expect(page.locator(".app-shell")).not.toHaveAttribute("inert", "");
  });

test("skip closes the intro at once and returns focus to the app", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => localStorage.setItem("teleo.locale", "ru"));
  await page.goto("/studio?lang=ru");
  const skip = page.getByRole("button", {
    name: dictionaries.ru.skip,
    exact: true,
  });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".brand-intro")).toHaveCount(0);
  await expect(page.locator("header button:enabled").first()).toBeFocused();
  await page.reload();
  await expect(page.locator(".brand-intro")).toHaveCount(0);
});

test("reduced motion skips the intro", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio?lang=en");
  await expect(page.locator(".workspace")).toBeVisible();
  await expect(page.locator(".brand-intro")).toHaveCount(0);
});
