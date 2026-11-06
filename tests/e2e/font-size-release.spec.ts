import { test, expect, type Page } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
import { remoteValue } from "./helpers";
const t = dictionaries.en;
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
    localStorage.setItem("teleo.tour.v140", "done");
    localStorage.setItem("teleo.demo.auto", "false");
    localStorage.setItem("teleo.locale", "en");
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
});
async function create(page: Page) {
  await page.goto("/studio");
  await page
    .getByRole("button", { name: t.newScript, exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: t.body, exact: true })
    .fill("Large print stays readable.\n\n".repeat(45));
  await expect(page.locator('.editor-top [role="status"]')).toHaveText(t.saved);
}
async function font(page: Page) {
  const input = page.getByRole("slider", { name: t.fontSize, exact: true });
  if (!(await input.isVisible())) {
    const trigger = page
      .locator(".reader-controls")
      .getByRole("button", { name: t.fontSize, exact: true });
    if (await trigger.isVisible()) await trigger.click();
    else
      await page
        .locator(".reader-controls")
        .getByRole("button", { name: t.expandControls, exact: true })
        .click();
  }
  await expect(input).toBeVisible();
  return input;
}
test("font 120 persists and reads in portrait, landscape and fullscreen", async ({
  page,
}, info) => {
  await create(page);
  await page
    .locator("header")
    .getByRole("button", { name: t.read, exact: true })
    .click();
  const slider = await font(page);
  await expect(slider).toHaveAttribute("max", "120");
  await slider.fill("120");
  await expect(page.locator(".reader article")).toHaveCSS("font-size", "120px");
  await page.keyboard.press("Escape");
  await page.screenshot({ path: info.outputPath("font-120.png") });
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: size.height, height: size.width });
  await expect(page.locator(".reader article")).toHaveCSS("font-size", "120px");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await page
    .locator("header")
    .getByRole("button", { name: t.read, exact: true })
    .click();
  await expect(page.locator(".reader article")).toHaveCSS("font-size", "120px");
  await page
    .locator(".reader")
    .getByRole("button", { name: t.fullscreen, exact: true })
    .first()
    .click();
  await expect(page.locator(".reader article")).toHaveCSS("font-size", "120px");
});
test("font 120 synchronizes both ways with an approved phone remote", async ({
  page,
  browser,
}) => {
  await create(page);
  await page
    .locator("header")
    .getByRole("button", { name: t.remoteConnection, exact: true })
    .click();
  const pairing = page.getByRole("dialog", {
    name: t.remoteConnection,
    exact: true,
  });
  const invitation = await pairing
    .getByRole("link", { name: t.invite, exact: true })
    .getAttribute("href");
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  await phoneContext.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
    localStorage.setItem("teleo.tour.v140", "done");
    localStorage.setItem("teleo.locale", "en");
  });
  try {
    const phone = await phoneContext.newPage();
    await phone.goto(invitation!);
    await pairing.getByRole("button", { name: t.allow, exact: true }).click();
    await expect(pairing).not.toBeVisible();
    await page
      .locator("header")
      .getByRole("button", { name: t.read, exact: true })
      .click();
    await expect(
      phone.getByRole("button", { name: t.play, exact: true }),
    ).toBeEnabled();
    const remote = await remoteValue(phone, t, "fontSize");
    await expect(remote).toHaveAttribute("max", "120");
    await remote.fill("120");
    await expect(page.locator(".reader article")).toHaveCSS(
      "font-size",
      "120px",
    );
    await (await font(page)).fill("119");
    await expect(remote).toHaveValue("119");
  } finally {
    await phoneContext.close();
  }
});
