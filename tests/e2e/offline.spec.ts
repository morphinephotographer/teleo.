import { dictionaries, type Locale } from "../../apps/web/src/i18n";
import { chooseSelect, openSettings } from "./helpers";
import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
  });
});
test("production assets: all locales and scripts work offline", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("teleo.locale"))
      localStorage.setItem("teleo.locale", "uk");
  });
  await page.goto("http://127.0.0.1:5174/studio?lang=uk");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((r) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => r(),
          { once: true },
        ),
      );
  });
  await page
    .getByRole("button", { name: "Новий текст", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Ваші слова", exact: true })
    .fill("Offline 🌍\n\nТекст");
  await page.getByRole("textbox", { name: "Ваші слова", exact: true }).blur();
  await expect(
    page.getByRole("status").filter({ hasText: "Збережено на цьому пристрої" }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Ваші слова", exact: true }),
  ).toHaveValue("Offline 🌍\n\nТекст");
  for (const [value, name] of [
    ["ru", "Мова"],
    ["en", "Язык"],
    ["uk", "Language"],
  ]) {
    await chooseSelect(
      (
        await openSettings(
          page,
          dictionaries[
            (await page.locator("html").getAttribute("lang")) as Locale
          ],
        )
      ).getByRole("combobox", { name, exact: true }),
      value,
    );
    await expect(page.locator("html")).toHaveAttribute("lang", value);
  }
  await expect(
    page.getByRole("textbox", { name: "Ваші слова", exact: true }),
  ).toHaveValue("Offline 🌍\n\nТекст");
});

// Legacy scenarios start with their intended empty workspace; onboarding has its own fresh-install suite.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("teleo.demo.auto"))
      localStorage.setItem("teleo.demo.auto", "false");
  });
});
