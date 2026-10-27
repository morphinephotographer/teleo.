import { openSettings, closeSettings } from "./helpers";
import { test, expect } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";

for (const locale of ["en", "uk", "ru"] as const) {
  test(`${locale}: compact studio keeps editing and settings inside the viewport`, async ({
    page,
  }, info) => {
    const t = dictionaries[locale];
    for (const size of [
      { width: 1440, height: 800 },
      { width: 1024, height: 700 },
      { width: 390, height: 664 },
      { width: 320, height: 568 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      await page.goto(`/studio?lang=${locale}`);
      if (!(await page.locator(".script-list button").count())) {
        await page
          .getByRole("button", { name: t.newScript, exact: true })
          .first()
          .click();
      } else {
        const editor = page.getByRole("tab", { name: t.editor, exact: true });
        if (await editor.isVisible()) await editor.click();
      }
      await page
        .getByRole("textbox", { name: t.body, exact: true })
        .fill("Long reading copy.\n\n".repeat(200));
      await expect(
        page.getByRole("button", { name: t.read, exact: true }),
      ).toBeInViewport();
      await expect(
        page.getByRole("textbox", { name: t.body, exact: true }),
      ).toBeInViewport();
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollHeight <= innerHeight &&
            document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await openSettings(page, t, "appearance");
      await expect(
        page.getByRole("slider", { name: t.focusPosition, exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight,
        ),
      ).toBe(true);
      await closeSettings(page, t);
      await page
        .locator(".speed-group")
        .getByRole("button", { name: t.speedUp, exact: true })
        .click();
      if (size.width === 390 || size.width === 1440) {
        await page.screenshot({
          path: `docs/screenshots/compact-${info.project.name}-${locale}-${size.width}.png`,
        });
      }
    }
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
  });
});

// Explicit fixture preference for legacy translated scenarios; v07.spec tests fresh autodetection.
test.beforeEach(async ({ page }, info) => {
  const locale = /^(en|uk|ru):/.exec(info.title)?.[1];
  if (locale)
    await page.addInitScript((value) => {
      if (!localStorage.getItem("teleo.locale"))
        localStorage.setItem("teleo.locale", value);
    }, locale);
});

// Legacy scenarios start with their intended empty workspace; onboarding has its own fresh-install suite.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("teleo.demo.auto"))
      localStorage.setItem("teleo.demo.auto", "false");
  });
});
