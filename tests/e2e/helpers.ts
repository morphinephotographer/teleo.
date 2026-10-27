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
  if (tab)
    await settings
      .getByRole("group", { name: t.settings, exact: true })
      .getByRole("button", {
        name: t[
          tab === "playback"
            ? "playbackTab"
            : tab === "text"
              ? "textSettings"
              : "appearance"
        ],
        exact: true,
      })
      .click();
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
