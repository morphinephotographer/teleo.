import { test, expect } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
const t = dictionaries.en;
test.use({ viewport: { width: 390, height: 844 } });
test("mobile editor, Welcome, reader controls and keyboard-sized viewport", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
    localStorage.setItem("teleo.locale", "en");
    localStorage.setItem("teleo.theme", "dark");
  });
  await page.goto("/studio");
  await page
    .locator("header")
    .getByRole("button", { name: t.settings, exact: true })
    .click();
  await page.getByRole("button", { name: t.openDemo, exact: true }).click();
  const body = page.getByRole("textbox", { name: t.body, exact: true });
  await expect(body).toContainText("");
  await expect(body).toHaveValue(/Hello! Welcome to Teleo/);
  for (const size of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(size);
    await page.reload();
    await expect(body).toHaveValue(/Hello! Welcome to Teleo/);
    await expect
      .poll(() =>
        page
          .locator(".app-shell")
          .evaluate((el) => Math.round(el.getBoundingClientRect().height)),
      )
      .toBe(size.height);
    expect(
      await body.evaluate((el) => el.getBoundingClientRect().height),
    ).toBeGreaterThan(120);
    await page.screenshot({
      path: `test-results/mobile-layout/before-${size.width}.png`,
    });
    for (const button of await page
      .locator(".document-actions > button:visible")
      .all()) {
      const r = await button.boundingBox();
      expect(r!.x).toBeGreaterThanOrEqual(0);
      expect(r!.x + r!.width).toBeLessThanOrEqual(size.width);
      expect(r!.y + r!.height).toBeLessThanOrEqual(size.height);
      await button.click({ trial: true });
    }
    await expect(
      page.locator(".document-actions > button:visible"),
    ).toHaveCount(4);
    await expect(page.locator(".document-action-exportJSON")).toBeHidden();
    const bounds = await page.locator(".editor").boundingBox();
    expect(size.height - bounds!.y - bounds!.height).toBeLessThanOrEqual(8);
    const actions = await page
      .locator(".document-actions > button:visible")
      .evaluateAll((elements) =>
        elements.map((el) => el.getBoundingClientRect().toJSON()),
      );
    expect(actions.every((r) => r.width === 44 && r.height === 44)).toBe(true);
    const gaps = actions.slice(1).map((r, i) => r.x - actions[i].right);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.screenshot({ path: "test-results/mobile-layout/editor.png" });
  await body.focus();
  await page.setViewportSize({ width: 390, height: 390 });
  expect(
    await body.evaluate((el) => el.getBoundingClientRect().height),
  ).toBeGreaterThan(140);
  await page.screenshot({ path: "test-results/mobile-layout/keyboard.png" });
  await body.blur();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: t.read, exact: true }).click();
  await expect(page.locator(".reading-viewport")).toContainText(
    "Hello! Welcome to Teleo",
  );
  const dock = page.locator(".mobile-reader-dock");
  await expect(dock).toBeVisible();
  expect(
    await dock.evaluate((el) => el.getBoundingClientRect().width),
  ).toBeGreaterThan(350);
  const lineButtons = await dock
    .locator(".mobile-lines button")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
  expect(lineButtons[1].left - lineButtons[0].right).toBeGreaterThanOrEqual(8);
  await dock.getByRole("button", { name: t.nextLine, exact: true }).click();
  await dock
    .getByRole("button", { name: t.expandControls, exact: true })
    .click();
  for (const label of [t.fontSize, t.lineHeight, t.letterSpacing])
    await expect(
      dock.getByRole("slider", { name: label, exact: true }),
    ).toBeVisible();
  await dock
    .getByRole("slider", { name: t.letterSpacing, exact: true })
    .fill("2");
  await expect(page.locator(".reading-viewport article")).toHaveCSS(
    "letter-spacing",
    "2px",
  );
  await dock.getByRole("button", { name: t.play, exact: true }).click();
  await expect(
    dock.getByRole("button", { name: t.pause, exact: true }),
  ).toBeVisible();
  await dock.getByRole("button", { name: t.pause, exact: true }).click();
  await page.screenshot({ path: "test-results/mobile-layout/reader.png" });
});
