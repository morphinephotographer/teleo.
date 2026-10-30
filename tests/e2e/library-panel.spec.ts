import { test, expect, type Page } from "@playwright/test";
import { dictionaries, type Locale } from "../../apps/web/src/i18n";
import { createScript, exportBundle } from "../../packages/protocol/domain";
import { chooseSelect } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
    if (!localStorage.getItem("teleo.locale"))
      localStorage.setItem("teleo.locale", "ru");
    localStorage.setItem("teleo.demo.auto", "false");
  });
});

async function seed(page: Page, count = 4, locale: Locale = "ru") {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/studio?lang=${locale}`);
  await page.locator(".library-empty").waitFor();
  await page.evaluate(
    async ({ count, locale }) => {
      // Seed only this test's isolated browser context; works against built releases too.
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("teleo", 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = db.transaction(["scripts", "folders"], "readwrite");
      tx.objectStore("folders").put({ folderId: "scripts", title: "Сценарии" });
      tx.objectStore("folders").put({ folderId: "ideas", title: "Идеи" });
      for (let i = 0; i < count; i++)
        tx.objectStore("scripts").put({
          scriptId: `script-${i}`,
          title: i === 0 ? "Знакомство" : `Текст ${i}`,
          body: `Содержимое документа ${i}. уникальный-${i}`,
          createdAt: "2026-10-28T10:00:00Z",
          updatedAt: "2026-10-28T10:00:00Z",
          folderId: i % 2 === 0 ? "scripts" : "ideas",
          preferences: {
            speed: 1,
            fontSize: 40,
            lineHeight: 1.6,
            textWidth: 760,
            alignment: "left",
            mirrorHorizontal: false,
            mirrorVertical: false,
            focusLine: true,
            countdownSeconds: 0,
            appearance: "dark",
          },
        });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
      localStorage.setItem("teleo.selectedScript", "script-0");
      localStorage.setItem("teleo.locale", locale);
    },
    { count, locale },
  );
  await page.reload();
  await expect(page.locator(".title-input")).toHaveValue("Знакомство");
}

async function showLibrary(page: Page) {
  if (!(await page.locator(".library").isVisible()))
    await page
      .locator("header")
      .getByRole("button", {
        name: dictionaries[
          (await page.locator("html").getAttribute("lang")) as Locale
        ].library,
        exact: true,
      })
      .click();
}

async function menu(page: Page, title: string) {
  const row = page.locator(".script-row").filter({
    has: page.locator("strong", { hasText: new RegExp(`^${title}$`) }),
  });
  const trigger = row.locator(".library-row-menu > button");
  await trigger.click();
  const id = await trigger.getAttribute("aria-controls");
  return page.locator(`[id="${id}"]`);
}

test("reference composition, keyboard overflow and locale switching", async ({
  page,
}, info) => {
  await seed(page);
  await page.setViewportSize({ width: 1024, height: 1536 });
  const library = page.locator(".library");
  await expect(library.locator(".library-folder-row")).toHaveCount(2);
  await page.screenshot({
    path: info.outputPath("reference-1024.png"),
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await showLibrary(page);
  await page.screenshot({
    path: info.outputPath("reference-375.png"),
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await library.locator(".library-document").first().focus();
  await page.keyboard.press("Tab");
  const overflow = library.locator(".library-row-menu > button").first();
  await expect(overflow).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("menuitem", { name: dictionaries.ru.delete, exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(overflow).toBeFocused();
  await library.getByRole("searchbox").fill("уникальный-0");
  for (const locale of ["en", "uk", "ru"] as const) {
    const current = (await page.locator("html").getAttribute("lang")) as Locale;
    const trigger = page.locator(".top-settings > button");
    await trigger.click();
    const popup = page.locator(
      `[id="${await trigger.getAttribute("aria-controls")}"]`,
    );
    await chooseSelect(
      popup.getByRole("combobox", {
        name: dictionaries[current].language,
        exact: true,
      }),
      locale,
    );
    await page.keyboard.press("Escape");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(library.locator(".library-footer > button")).toHaveText([
      dictionaries[locale].import,
      dictionaries[locale].openLast,
    ]);
    await expect(library.getByRole("searchbox")).toHaveValue("уникальный-0");
    await expect(library.locator(".script-row")).toHaveCount(1);
  }
});

for (const locale of ["ru", "en", "uk"] as const)
  test(`${locale}: panel layout, fixed actions, search and responsive widths`, async ({
    page,
  }, info) => {
    const t = dictionaries[locale];
    await seed(page, 45, locale);
    const library = page.locator(".library");
    await expect(
      library.getByRole("heading", { name: t.library, exact: true }),
    ).toBeVisible();
    await expect(
      library.getByRole("button", { name: t.openDemo, exact: true }),
    ).toBeHidden();
    await expect(
      library.getByRole("button", { name: t.restoreDemo, exact: true }),
    ).toBeHidden();
    for (const [width, height] of [
      [1440, 1000],
      [1024, 1536],
      [375, 812],
      [320, 568],
    ]) {
      await page.setViewportSize({ width, height });
      await showLibrary(page);
      const create = await library
        .getByRole("button", { name: t.newScript, exact: true })
        .boundingBox();
      const folder = await library
        .getByRole("button", { name: t.newFolder, exact: true })
        .boundingBox();
      expect(create!.y).toBe(folder!.y);
      expect(create!.x + create!.width).toBeLessThan(folder!.x);
      const all = await library.locator(".library-all-folders").boundingBox();
      const trash = await library.locator(".library-trash-row").boundingBox();
      const footer = await library.locator(".library-footer").boundingBox();
      const bounds = await library.boundingBox();
      expect(all!.y).toBeGreaterThan(create!.y + create!.height);
      expect(trash!.y).toBeLessThan(footer!.y);
      expect(footer!.y + footer!.height).toBeLessThan(
        bounds!.y + bounds!.height,
      );
      await expect(library.locator(".library-footer > button")).toHaveText([
        t.import,
        t.openLast,
      ]);
      expect(
        await library
          .locator(".library-folder-button")
          .first()
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      ).toBe("rgba(0, 0, 0, 0)");
      const before = await library.locator(".library-footer").boundingBox();
      await library
        .locator(".library-scroll")
        .evaluate((el) => (el.scrollTop = el.scrollHeight));
      expect(await library.locator(".library-footer").boundingBox()).toEqual(
        before,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (locale === "ru" && [1024, 375].includes(width))
        await page.screenshot({
          path: info.outputPath(`panel-${width}.png`),
        });
    }
    await library
      .getByRole("searchbox", { name: t.search, exact: true })
      .fill("уникальный-17");
    await expect(library.locator(".script-row")).toHaveCount(1);
    await expect(library.locator(".script-row strong")).toHaveText("Текст 17");
    await library.getByRole("searchbox").fill("no such document");
    await expect(library.getByRole("status")).toHaveText(t.noSearchResults);
    await library.getByRole("searchbox").fill("");
    await expect(library.locator(".script-row")).toHaveCount(45);
    await library
      .getByRole("button", { name: t.closeLibrary, exact: true })
      .click();
    await expect(library).toBeHidden();
  });

test("folder creation, expansion, rename, navigation and safe folder removal", async ({
  page,
}) => {
  const t = dictionaries.ru;
  await seed(page);
  const library = page.locator(".library");
  await library.getByRole("button", { name: t.newFolder, exact: true }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("Новая папка тест");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: t.create, exact: true })
    .click();
  const folder = library
    .locator(".library-folder-group")
    .filter({ hasText: "Новая папка тест" });
  await expect(folder).toBeVisible();
  await chooseSelect(
    page.getByRole("combobox", { name: t.scriptFolder, exact: true }),
    await folder.locator(".library-folder-button").evaluate(async () => {
      return await new Promise<string>((resolve, reject) => {
        const request = indexedDB.open("teleo", 2);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const folders = db
            .transaction("folders")
            .objectStore("folders")
            .getAll();
          folders.onerror = () => {
            db.close();
            reject(folders.error);
          };
          folders.onsuccess = () => {
            db.close();
            resolve(
              folders.result.find(
                (f: { title: string }) => f.title === "Новая папка тест",
              ).folderId,
            );
          };
        };
      });
    }),
  );
  await folder.locator(".library-folder-button").click();
  await expect(folder.locator(".library-nested .script-row")).toHaveCount(1);
  await expect(library.locator(".script-row")).toHaveCount(1);
  await folder.locator(".library-folder-row").hover();
  await folder.locator(".library-folder-menu > button").click();
  await page
    .getByRole("menuitem", { name: t.renameFolder, exact: true })
    .click();
  await page.getByRole("dialog").getByRole("textbox").fill("Переименовано");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: t.save, exact: true })
    .click();
  const renamed = library
    .locator(".library-folder-group")
    .filter({ hasText: "Переименовано" });
  await renamed.locator(".library-folder-row").hover();
  await renamed.locator(".library-folder-menu > button").click();
  await page
    .getByRole("menuitem", { name: t.deleteFolder, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: t.confirm, exact: true })
    .click();
  await expect(library.locator(".script-row")).toHaveCount(4);
  await expect(page.locator(".title-input")).toHaveValue("Знакомство");
  await page.reload();
  await expect(page.locator(".script-row")).toHaveCount(4);
});

test("document creation, trash restore, confirmed permanent deletion and last document persistence", async ({
  page,
}) => {
  const t = dictionaries.ru;
  await seed(page);
  const library = page.locator(".library");
  await library.getByRole("button", { name: t.newScript, exact: true }).click();
  await page.locator(".title-input").fill("Новый документ");
  await page
    .getByRole("textbox", { name: t.body, exact: true })
    .fill("Последние несохранённые слова");
  await page.getByRole("textbox", { name: t.body, exact: true }).blur();
  await (
    await menu(page, "Новый документ")
  )
    .getByRole("menuitem", { name: t.delete, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: t.confirm, exact: true })
    .click();
  await expect(library.locator(".script-row")).toHaveCount(4);
  await library
    .getByRole("button", { name: new RegExp(`^${t.trash}`) })
    .click();
  await expect(library.locator(".script-row strong")).toHaveText(
    "Новый документ",
  );
  await (
    await menu(page, "Новый документ")
  )
    .getByRole("menuitem", { name: t.restore, exact: true })
    .click();
  await expect(library.locator(".script-row")).toHaveCount(5);
  await library
    .locator(".library-document")
    .filter({ hasText: "Новый документ" })
    .click();
  await expect(
    page.getByRole("textbox", { name: t.body, exact: true }),
  ).toHaveValue("Последние несохранённые слова");
  await page.reload();
  await expect(page.locator(".title-input")).toHaveValue("Новый документ");
  await page.setViewportSize({ width: 375, height: 812 });
  await showLibrary(page);
  await library.getByRole("button", { name: t.openLast, exact: true }).click();
  await expect(library).toBeHidden();
  await expect(page.locator(".title-input")).toHaveValue("Новый документ");
  await showLibrary(page);
  await (
    await menu(page, "Новый документ")
  )
    .getByRole("menuitem", { name: t.delete, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: t.confirm, exact: true })
    .click();
  await library
    .getByRole("button", { name: new RegExp(`^${t.trash}`) })
    .click();
  await (
    await menu(page, "Новый документ")
  )
    .getByRole("menuitem", { name: t.deleteForever, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: t.cancel, exact: true })
    .click();
  await expect(library.locator(".script-row")).toHaveCount(1);
  await (
    await menu(page, "Новый документ")
  )
    .getByRole("menuitem", { name: t.deleteForever, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: t.deleteForever, exact: true })
    .click();
  await expect(library.getByRole("status")).toHaveText(t.trashEmpty);
  await page.reload();
  await showLibrary(page);
  await expect(library.locator(".script-row")).toHaveCount(4);
});

test("TXT and JSON imports retain validation and content; empty last action is safe", async ({
  page,
}) => {
  const t = dictionaries.ru;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/studio");
  const library = page.locator(".library");
  await expect(
    library.getByRole("button", { name: t.openLast, exact: true }),
  ).toBeDisabled();
  const input = library.locator('input[type="file"]');
  await input.setInputFiles({
    name: "Текст.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Текст из файла 🌍"),
  });
  await expect(
    page.getByRole("textbox", { name: t.body, exact: true }),
  ).toHaveValue("Текст из файла 🌍");
  await input.setInputFiles({
    name: "bundle.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      exportBundle([createScript("JSON документ", "Содержимое JSON")]),
    ),
  });
  await expect(
    page.getByRole("textbox", { name: t.body, exact: true }),
  ).toHaveValue("Содержимое JSON");
  await input.setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  await expect(page.getByRole("alert")).toContainText(t.invalidImport);
  await expect(library.locator(".script-row")).toHaveCount(2);
  await expect(
    page.getByRole("textbox", { name: t.body, exact: true }),
  ).toHaveValue("Содержимое JSON");
});
