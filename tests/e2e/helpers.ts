import { expect, type Locator, type Page } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
export async function chooseSelect(trigger: Locator, value: string) {
  if (await trigger.evaluate((el) => el.tagName === "SELECT")) {
    await trigger.selectOption(value);
    return;
  }
  await trigger.click();
  const id = await trigger.getAttribute("aria-controls");
  const popup = trigger.page().locator(`[id="${id}"]`);
  await expect(popup).toBeVisible();
  await popup.locator(`[data-value="${value}"]`).click();
  await expect(popup).not.toBeVisible();
}
export async function openSettings(
  page: Page,
  t: typeof dictionaries.en,
  tab?: "playback" | "text" | "appearance",
) {
  let settings = page.locator(".integrated-settings");
  if (!(await settings.isVisible())) {
    await page
      .locator("header")
      .getByRole("button", { name: t.settings, exact: true })
      .click();
    settings = page.getByRole("dialog");
  }
  void tab; // Only Appearance remains in this panel; operational controls moved to the dock.
  return settings;
}
export async function closeSettings(page: Page, t: typeof dictionaries.en) {
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible())
    await dialog.getByRole("button", { name: t.close, exact: true }).click();
}
export async function disconnectPhone(phone: Page, t: typeof dictionaries.en) {
  await phone
    .getByRole("button", { name: t.advancedSettings, exact: true })
    .click();
  await phone
    .locator(".remote-list")
    .getByRole("button")
    .filter({ hasText: t.studio })
    .click();
  await phone.getByRole("button", { name: t.revoke, exact: true }).click();
}

export async function managePhone(page: Page, t: typeof dictionaries.en) {
  const dialog = page.getByRole("dialog", {
    name: t.remoteConnection,
    exact: true,
  });
  if (!(await dialog.isVisible()))
    await page
      .locator("header")
      .getByRole("button", { name: t.remoteConnection, exact: true })
      .click();
  return dialog;
}

export async function remoteValue(
  phone: Page,
  t: typeof dictionaries.en,
  key: "fontSize" | "lineHeight" | "textWidth",
) {
  if (!(await phone.locator(".remote-settings-page").isVisible()))
    await phone
      .getByRole("button", { name: t.advancedSettings, exact: true })
      .click();
  await phone
    .locator(".remote-settings-page .remote-list")
    .getByRole("button")
    .filter({ hasText: t[key] })
    .click();
  return phone
    .locator(".remote-settings-page")
    .getByRole("slider", { name: t[key], exact: true });
}
export async function closeRemoteValue(phone: Page, t: typeof dictionaries.en) {
  await phone
    .locator(".remote-settings-page")
    .getByRole("button", { name: t.back, exact: true })
    .click();
  await phone
    .locator(".remote-settings-page")
    .getByRole("button", { name: t.back, exact: true })
    .click();
}
export async function setTimer(
  page: Page,
  t: typeof dictionaries.en,
  n: number,
) {
  if (await page.locator(".reader-dock").isVisible()) {
    await prepareReader(page, t);
    const tools = page.locator(".dock-countdown");
    if (!(await tools.isVisible()))
      await page
        .locator(".reader-dock")
        .getByRole("button", { name: t.timer, exact: true })
        .click();
    await tools
      .getByRole("button", {
        name: n ? `${n} ${t.seconds}` : t.off,
        exact: true,
      })
      .click();
    return;
  }
  // Desktop toolbar: one round button cycles Off → 3 → 5 → 10 s.
  const target = `${t.timer}: ${n ? `${n} ${t.seconds}` : t.off}`;
  const cycle = page.locator(".reader-controls .dock-timer");
  for (let i = 0; i < 4; i++) {
    if ((await cycle.getAttribute("aria-label")) === target) return;
    await cycle.click();
  }
  await expect(cycle).toHaveAttribute("aria-label", target);
}

/** Legacy workspace scenarios deliberately use windowed Reader; dedicated v1.2 tests cover viewport fill. */
export async function prepareReader(page: Page, t: typeof dictionaries.en) {
  await expect(page.locator(".reader")).toBeVisible();
  if (await page.locator(".app-shell.immersive").count())
    await page
      .locator(".reader-top")
      .getByRole("button", { name: t.fullscreen, exact: true })
      .click();
  const expand = page
    .locator(".reader-dock")
    .getByRole("button", { name: t.expandControls, exact: true });
  if (await expand.isVisible()) await expand.click();
}
export async function readerTypography(
  page: Page,
  t: typeof dictionaries.en,
  key: "fontSize" | "lineHeight" | "textWidth",
) {
  const dock = page.locator(".reader-dock");
  if (await dock.isVisible()) {
    await prepareReader(page, t);
    if (!(await page.locator(".dock-text-tabs").isVisible()))
      await dock.locator(".dock-aa").click();
    await dock
      .locator(".dock-text-tabs")
      .getByRole("button", { name: t[key], exact: true })
      .click();
  }
  return page
    .locator(".reader-controls")
    .getByRole("slider", { name: t[key], exact: true });
}
