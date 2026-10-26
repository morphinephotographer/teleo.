import { test, expect } from "@playwright/test";
test("production assets: all locales and scripts work offline", async ({
  page,
  context,
}) => {
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
    await page.getByRole("combobox", { name, exact: true }).selectOption(value);
    await expect(page.locator("html")).toHaveAttribute("lang", value);
  }
  await expect(
    page.getByRole("textbox", { name: "Ваші слова", exact: true }),
  ).toHaveValue("Offline 🌍\n\nТекст");
});
