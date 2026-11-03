import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dictionaries } from "../../apps/web/src/i18n";

const fixture = (name: string) => readFileSync(`tests/fixtures/docx/${name}`);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
    localStorage.setItem("teleo.locale", "ru");
  });
});

async function openLibrary(page: Page) {
  const t = dictionaries.ru;
  await page.goto("/studio?lang=ru");
  await expect(
    page.getByRole("button", { name: t.read, exact: true }).first(),
  ).toBeVisible();
  const library = page.locator(".library");
  if (!(await library.isVisible()))
    await page
      .locator("header")
      .getByRole("button", { name: t.library, exact: true })
      .click();
  await expect(library).toBeVisible();
  return library;
}

test("a Word .docx imports as a script with its paragraphs", async ({
  page,
}) => {
  const t = dictionaries.ru;
  const library = await openLibrary(page);
  await expect(
    library.getByRole("button", { name: t.import, exact: true }),
  ).toBeVisible();
  await library.locator('input[type="file"]').setInputFiles({
    name: "Выступление.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: fixture("script.docx"),
  });
  const body = page.getByRole("textbox", { name: t.body, exact: true });
  await expect(body).toHaveValue(/^Вступление\n\nДобрый вечер!/);
  await expect(body).toHaveValue(/Спасибо! \[пауза\]$/);
  await expect(page.getByRole("textbox", { name: t.title })).toHaveValue(
    "Выступление",
  );
});

test("an old .doc explains how to convert it", async ({ page }) => {
  const t = dictionaries.ru;
  const library = await openLibrary(page);
  await library.locator('input[type="file"]').setInputFiles({
    name: "Старый.doc",
    mimeType: "application/msword",
    buffer: fixture("script.doc"),
  });
  await expect(page.getByRole("alert")).toContainText(t.importOldWord);
  // Nothing was imported (counting rows would race the Welcome script).
  await expect(library.getByText("Старый", { exact: true })).toHaveCount(0);
});

test("the import button label fits on one line", async ({ page }) => {
  const t = dictionaries.ru;
  const library = await openLibrary(page);
  const button = library.getByRole("button", { name: t.import, exact: true });
  const fits = await button.evaluate((el) => {
    const label = el.querySelector("span") as HTMLElement;
    return (
      label.scrollWidth <= label.clientWidth + 1 &&
      label.getBoundingClientRect().height < 24
    );
  });
  expect(fits).toBe(true);
});
