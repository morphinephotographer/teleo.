import { prepareReader } from "./helpers";
import { test, expect, type Page } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
import { welcomeBodies } from "../../apps/web/src/welcome";
import { chooseSelect, openSettings, closeSettings } from "./helpers";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("teleo.intro.seen.v1", "true"),
  );
});
async function gettingStarted(page: Page, locale: "en" | "uk" | "ru" = "en") {
  const t = dictionaries[locale];
  const settings = await openSettings(page, t);
  const section = settings
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: t.gettingStarted }) });
  if (
    !(await section.getAttribute("open")) &&
    (await section.evaluate((el) => !el.hasAttribute("open")))
  )
    await section.locator("summary").click();
  return section;
}
for (const locale of ["en", "uk", "ru"] as const)
  test(`${locale}: first launch selects Welcome; reload, UI language and edits are preserved`, async ({
    page,
  }, info) => {
    const t = dictionaries[locale];
    await page.addInitScript((value) => {
      if (!localStorage.getItem("teleo.locale"))
        localStorage.setItem("teleo.locale", value);
    }, locale);
    await page.goto("/studio");
    const title = page.getByRole("textbox", { name: t.title, exact: true });
    const body = page.getByRole("textbox", { name: t.body, exact: true });
    await expect(title).toHaveValue("Welcome");
    await expect(body).toHaveValue(welcomeBodies[locale]);
    const count = () =>
      page.evaluate(async () => {
        const request = indexedDB.open("teleo");
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          return await new Promise<number>((resolve, reject) => {
            const request = db
              .transaction("scripts")
              .objectStore("scripts")
              .count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
        } finally {
          db.close();
        }
      });
    await expect.poll(count).toBe(1);
    await page.screenshot({
      path: `docs/screenshots/welcome-${info.project.name}-${locale}-editor.png`,
      animations: "disabled",
    });
    await body.fill("My edited Welcome 🌍\n\nDo not translate or reset this.");
    await body.blur();
    await expect(
      page.getByRole("status").filter({ hasText: t.saved }),
    ).toBeVisible();
    await chooseSelect(
      page
        .locator("header")
        .getByRole("combobox", { name: t.language, exact: true }),
      "en",
    );
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: dictionaries.en.body, exact: true }),
    ).toHaveValue("My edited Welcome 🌍\n\nDo not translate or reset this.");
    await expect.poll(count).toBe(1);
  });
test("simultaneous tabs create one demo and preserve returning selection", async ({
  page,
  context,
}) => {
  const second = await context.newPage();
  await second.addInitScript(() =>
    sessionStorage.setItem("teleo.intro.seen.v1", "true"),
  );
  await Promise.all([page.goto("/studio"), second.goto("/studio")]);
  await expect(
    page.getByRole("textbox", { name: dictionaries.en.title, exact: true }),
  ).toHaveValue("Welcome");
  await expect(
    second.getByRole("textbox", { name: dictionaries.en.title, exact: true }),
  ).toHaveValue("Welcome");
  if (!(await page.locator(".library").isVisible()))
    await page
      .locator("header")
      .getByRole("button", { name: dictionaries.en.library, exact: true })
      .click();
  await page
    .getByRole("button", { name: dictionaries.en.newScript, exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: dictionaries.en.title, exact: true })
    .fill("My selected script");
  await page
    .getByRole("textbox", { name: dictionaries.en.body, exact: true })
    .fill("Personal body");
  await page
    .getByRole("textbox", { name: dictionaries.en.body, exact: true })
    .blur();
  await expect(
    page.getByRole("status").filter({ hasText: dictionaries.en.saved }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: dictionaries.en.title, exact: true }),
  ).toHaveValue("My selected script");
  await second.close();
});
test("deleted demo stays deleted; disabled preference and explicit restoration persist", async ({
  page,
}, info) => {
  const t = dictionaries.en;
  await page.goto("/studio");
  await expect(
    page.getByRole("textbox", { name: t.title, exact: true }),
  ).toHaveValue("Welcome");
  let section = await gettingStarted(page);
  await section
    .getByRole("checkbox", { name: t.autoDemo, exact: true })
    .uncheck();
  await closeSettings(page, t);
  await page.getByRole("button", { name: t.delete, exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: t.confirm, exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("textbox", { name: t.title, exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: t.title, exact: true }),
  ).toHaveCount(0);
  section = await gettingStarted(page);
  await expect(
    section.getByRole("checkbox", { name: t.autoDemo, exact: true }),
  ).not.toBeChecked();
  await page.screenshot({
    path: `docs/screenshots/welcome-${info.project.name}-settings-empty.png`,
    animations: "disabled",
  });
  await section
    .getByRole("button", { name: t.restoreDemo, exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: t.title, exact: true }),
  ).toHaveValue("Welcome");
  section = await gettingStarted(page);
  await expect(
    section.getByRole("button", { name: t.openDemo, exact: true }),
  ).toBeVisible();
  await expect(
    section.getByRole("checkbox", { name: t.autoDemo, exact: true }),
  ).not.toBeChecked();
  await section.getByRole("button", { name: t.openDemo, exact: true }).click();
});
test("disabled first run stays empty after enabling; restoration uses current locale", async ({
  page,
}) => {
  const t = dictionaries.en;
  await page.addInitScript(() => {
    if (!localStorage.getItem("teleo.demo.auto"))
      localStorage.setItem("teleo.demo.auto", "false");
  });
  await page.goto("/studio");
  let section = await gettingStarted(page);
  await section
    .getByRole("checkbox", { name: t.autoDemo, exact: true })
    .check();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: t.body, exact: true }),
  ).toHaveCount(0);
  await chooseSelect(
    page
      .locator("header")
      .getByRole("combobox", { name: t.language, exact: true }),
    "uk",
  );
  section = await gettingStarted(page, "uk");
  await section
    .getByRole("button", { name: dictionaries.uk.restoreDemo, exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: dictionaries.uk.body, exact: true }),
  ).toHaveValue(welcomeBodies.uk);
});
test("edited demo is retained beside one fresh restored demo, with playback and paragraphs", async ({
  page,
}, info) => {
  const t = dictionaries.en;
  await page.goto("/studio");
  const body = page.getByRole("textbox", { name: t.body, exact: true });
  await expect(body).toHaveValue(welcomeBodies.en);
  await body.fill("My own Welcome content");
  await body.blur();
  const section = await gettingStarted(page);
  await section
    .getByRole("button", { name: t.restoreDemo, exact: true })
    .click();
  await expect(body).toHaveValue(welcomeBodies.en);
  await page.getByRole("button", { name: t.read, exact: true }).click();
  await prepareReader(page, t);
  const dock = page.locator(".reader-controls");
  await dock
    .getByRole("button", { name: t.nextParagraph, exact: true })
    .click();
  await expect
    .poll(() =>
      page.locator(".reading-viewport").evaluate((el) => el.scrollTop),
    )
    .toBeGreaterThan(0);
  await dock.getByRole("button", { name: t.play, exact: true }).click();
  await expect(
    dock.getByRole("button", { name: t.pause, exact: true }),
  ).toBeVisible();
  await dock.getByRole("button", { name: t.pause, exact: true }).click();
  await page.screenshot({
    path: `docs/screenshots/welcome-${info.project.name}-reader.png`,
    animations: "disabled",
  });
  await page.getByRole("button", { name: t.editor, exact: true }).click();
  await chooseSelect(
    page.getByRole("combobox", { name: t.currentScript, exact: true }),
    await page.evaluate(async () => {
      const request = indexedDB.open("teleo");
      const db = await new Promise<IDBDatabase>((resolve) => {
        request.onsuccess = () => resolve(request.result);
      });
      const items = await new Promise<{ scriptId: string; body: string }[]>(
        (resolve) => {
          const q = db.transaction("scripts").objectStore("scripts").getAll();
          q.onsuccess = () => resolve(q.result);
        },
      );
      db.close();
      return items.find((item) => item.body === "My own Welcome content")!
        .scriptId;
    }),
  );
  await expect(body).toHaveValue("My own Welcome content");
});

for (const empty of [true, false])
  test(`legacy ${empty ? "empty" : "populated"} library returns without automatic Welcome`, async ({
    page,
  }) => {
    // Load a non-app resource so the legacy database is established before React bootstrap.
    await page.route("**/onboarding-fixture", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Legacy data fixture</title>",
      }),
    );
    await page.goto("/onboarding-fixture");
    await page.evaluate(async (empty) => {
      const request = indexedDB.open("teleo", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("scripts", { keyPath: "scriptId" });
        request.result.createObjectStore("revisions", {
          keyPath: "revisionId",
        });
        request.result.createObjectStore("folders", { keyPath: "folderId" });
      };
      const db = await new Promise<IDBDatabase>((resolve) => {
        request.onsuccess = () => resolve(request.result);
      });
      if (!empty) {
        const tx = db.transaction("scripts", "readwrite");
        for (const id of ["legacy-first", "legacy-selected"])
          tx.objectStore("scripts").put({
            scriptId: id,
            title: id,
            body: "My saved words",
            createdAt: "2026-10-01T00:00:00.000Z",
            updatedAt: "2026-10-01T00:00:00.000Z",
            preferences: {
              speed: 1.5,
              fontSize: 52,
              lineHeight: 1.6,
              textWidth: 760,
              alignment: "center",
              mirrorHorizontal: false,
              mirrorVertical: false,
              focusLine: true,
              countdownSeconds: 0,
              appearance: "dark",
            },
          });
        await new Promise<void>((resolve) => {
          tx.oncomplete = () => resolve();
        });
        localStorage.setItem("teleo.selectedScript", "legacy-selected");
        localStorage.setItem("teleo.position.legacy-selected", "200");
      }
      db.close();
    }, empty);
    await page.goto("/studio");
    if (!empty) {
      await expect(
        page.getByRole("textbox", { name: dictionaries.en.title, exact: true }),
      ).toHaveValue("legacy-selected");
      await expect(
        page.getByRole("textbox", { name: dictionaries.en.body, exact: true }),
      ).toHaveValue("My saved words");
      await page.reload();
      await expect(
        page.getByRole("textbox", { name: dictionaries.en.title, exact: true }),
      ).toHaveValue("legacy-selected");
      expect(
        await page.evaluate(() =>
          localStorage.getItem("teleo.position.legacy-selected"),
        ),
      ).toBe("200");
    }
    const section = await gettingStarted(page);
    await expect(
      section.getByRole("button", {
        name: dictionaries.en.restoreDemo,
        exact: true,
      }),
    ).toBeEnabled();
    if (empty)
      await expect(
        page.getByRole("textbox", { name: dictionaries.en.body, exact: true }),
      ).toHaveCount(0);
  });
