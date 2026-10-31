import { test, expect, type Locator } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
const t = dictionaries.en;
async function expectCircles(dock: Locator) {
  for (const button of await dock.locator("button:visible").all()) {
    const shape = await button.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        radius: getComputedStyle(el).borderRadius,
      };
    });
    expect(shape.width).toBeGreaterThanOrEqual(44);
    expect(Math.abs(shape.width - shape.height)).toBeLessThan(0.1);
    expect(shape.radius).toBe("50%");
  }
}
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
  await expectCircles(dock);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const buttons = await dock
      .locator(".mobile-reader-main button")
      .evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().toJSON()),
      );
    expect(buttons.every((r) => r.left >= 0 && r.right <= width)).toBe(true);
    const play = buttons[2];
    expect(Math.abs(play.x + play.width / 2 - width / 2)).toBeLessThan(1);
  }
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

for (const locale of ["en", "uk", "ru"] as const) {
  test(`${locale}: installed shell fills window and Welcome controls have separate rows`, async ({
    page,
  }) => {
    const text = dictionaries[locale];
    await page.addInitScript((lang) => {
      Object.defineProperty(navigator, "standalone", {
        value: true,
        configurable: true,
      });
      sessionStorage.setItem("teleo.intro.seen.v1", "true");
      localStorage.setItem("teleo.locale", lang);
      localStorage.setItem("teleo.theme", "dark");
    }, locale);
    await page.goto("/studio");
    await expect(page.locator("html")).toHaveAttribute(
      "data-standalone",
      "true",
    );
    await expect(page.locator(".app-shell")).toHaveCSS("position", "absolute");
    const rect = await page.locator(".editor").boundingBox();
    expect(844 - rect!.y - rect!.height).toBeLessThanOrEqual(1);
    const body = page.getByRole("textbox", { name: text.body, exact: true });
    await body.focus();
    await page.evaluate(() => {
      Object.defineProperty(visualViewport!, "height", {
        get: () => innerHeight - 300,
        configurable: true,
      });
      visualViewport!.dispatchEvent(new Event("resize"));
    });
    await expect(page.locator("html")).toHaveAttribute("data-keyboard", "true");
    await expect(page.locator(".app-shell")).toHaveCSS("height", "544px");
    await body.blur();
    await page.evaluate(() => {
      Reflect.deleteProperty(visualViewport!, "height");
      visualViewport!.dispatchEvent(new Event("resize"));
    });
    await expect(page.locator("html")).toHaveAttribute(
      "data-keyboard",
      "false",
    );
    await expect(page.locator(".app-shell")).toHaveCSS("height", "844px");
    await page.locator("header .top-settings > button").click();
    const welcome = page.locator(".top-settings .welcome-preference");
    const label = (await welcome.locator(".check").boundingBox())!;
    const button = (await welcome
      .getByRole("button", { name: text.openDemo, exact: true })
      .boundingBox())!;
    expect(button.y).toBeGreaterThanOrEqual(label.y + label.height);
    const checkbox = (await welcome.getByRole("checkbox").boundingBox())!;
    expect(checkbox.y).toBeGreaterThanOrEqual(label.y);
    expect(checkbox.y + checkbox.height).toBeLessThanOrEqual(
      label.y + label.height,
    );
    await page.screenshot({
      path: `test-results/mobile-layout/standalone-${locale}-settings.png`,
      animations: "disabled",
    });
    await page.locator("header .top-settings > button").click();
    await page.getByRole("button", { name: text.read, exact: true }).click();
    const dock = page.locator(".mobile-reader-dock");
    const toggle = dock.getByRole("button", {
      name: text.expandControls,
      exact: true,
    });
    await expect(toggle).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await toggle.click();
    await expect(
      dock.getByRole("button", { name: text.collapseControls, exact: true }),
    ).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    const bounds = (await dock.boundingBox())!;
    await expectCircles(dock);
    expect(844 - bounds.y - bounds.height).toBeLessThanOrEqual(6);
    await page.screenshot({
      path: `test-results/mobile-layout/standalone-${locale}-reader.png`,
    });
  });
}

test("Safari tab follows the visible viewport as browser controls change height", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", {
      value: false,
      configurable: true,
    });
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
  });
  await page.goto("/studio");
  await expect(page.locator("html")).toHaveAttribute(
    "data-standalone",
    "false",
  );
  await expect(page.locator(".app-shell")).toHaveCSS("position", "absolute");
  await page.evaluate(() => {
    Object.defineProperty(visualViewport!, "height", {
      get: () => innerHeight - 100,
      configurable: true,
    });
    visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect(page.locator(".app-shell")).toHaveCSS("height", "744px");
  await expect(page.locator("html")).toHaveAttribute("data-keyboard", "false");
  const bounds = (await page.locator(".editor").boundingBox())!;
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(744);
  await page.evaluate(() => {
    Reflect.deleteProperty(visualViewport!, "height");
    visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect(page.locator(".app-shell")).toHaveCSS("height", "844px");
});
