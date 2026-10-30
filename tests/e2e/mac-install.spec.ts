import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dictionaries, type Locale } from "../../apps/web/src/i18n";
import { macIcons } from "../../apps/web/src/mac-icons";
import { createScript } from "../../packages/protocol/domain";

const trigger = (page: Page) =>
  page.locator(".app-shell > header > .top-settings > button");
async function start(page: Page, locale: Locale = "ru") {
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
    localStorage.setItem("teleo.demo.auto", "false");
  });
  await page.goto(`/studio?lang=${locale}`);
  await page.locator(".library-empty").waitFor({ state: "attached" });
  await page.evaluate(
    (value) => localStorage.setItem("teleo.locale", value),
    locale,
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}
async function open(page: Page, locale: Locale = "ru") {
  await trigger(page).click();
  await page
    .getByRole("button", { name: dictionaries[locale].macInstall, exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: dictionaries[locale].macInstall,
    exact: true,
  });
  await expect(dialog).toBeVisible();
  return dialog;
}

for (const locale of ["en", "ru", "uk"] as const) {
  test(`${locale}: four previews, saved choice, exact downloads and manual instructions`, async ({
    page,
  }) => {
    const t = dictionaries[locale];
    await start(page, locale);
    let dialog = await open(page, locale);
    for (const { id, label } of macIcons) {
      const radio = dialog.getByRole("radio", { name: t[label], exact: true });
      await radio.click();
      await expect(radio).toBeChecked();
      await expect(radio.locator("img")).toHaveJSProperty("naturalWidth", 256);
      await expect(page.locator("#teleo-app-manifest")).toHaveAttribute(
        "href",
        `/mac-icons/${id}.webmanifest`,
      );
      await expect(page.locator("#teleo-touch-icon")).toHaveAttribute(
        "href",
        `/mac-icons/teleo_${id}-1024.png`,
      );
      for (const [name, file] of [
        [t.macDownloadPng, `teleo_${id}-1024.png`],
        [t.macDownloadIcns, `teleo_${id}.icns`],
      ]) {
        const downloadEvent = page.waitForEvent("download");
        await dialog.getByRole("link", { name, exact: true }).click();
        const download = await downloadEvent;
        expect(download.suggestedFilename()).toBe(file);
        const actual = await readFile((await download.path())!);
        const expected = await readFile(`apps/web/public/mac-icons/${file}`);
        expect(createHash("sha256").update(actual).digest("hex")).toBe(
          createHash("sha256").update(expected).digest("hex"),
        );
      }
      await page.reload();
      dialog = await open(page, locale);
      await expect(
        dialog.getByRole("radio", { name: t[label], exact: true }),
      ).toBeChecked();
    }
    for (const step of [
      t.macInstallStep1,
      t.macInstallStep2,
      t.macInstallStep3,
      t.macInstalledNote,
    ])
      await expect(dialog.getByText(step, { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger(page)).toBeFocused();
    await trigger(page).click();
    await page
      .getByRole("button", { name: t.interfaceTheme, exact: true })
      .click();
    await page.getByRole("button", { name: t.macInstall, exact: true }).click();
    await expect(
      page.getByRole("radio", { name: t.macWhiteMatte, exact: true }),
    ).toBeChecked();
  });
}

test("keyboard selection, focus trap, Escape and invalid stored selection", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => localStorage.setItem("teleo.macIcon", "invalid"));
  await page.reload();
  const dialog = await open(page);
  const radios = dialog.getByRole("radio");
  await expect(radios.nth(1)).toBeChecked();
  await radios.nth(1).focus();
  for (const [key, index] of [
    ["ArrowRight", 2],
    ["ArrowDown", 3],
    ["ArrowLeft", 2],
    ["ArrowUp", 1],
    ["Home", 0],
    ["End", 3],
  ] as const) {
    await page.keyboard.press(key);
    await expect(radios.nth(index)).toBeChecked();
    await expect(radios.nth(index)).toBeFocused();
  }
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await dialog
    .getByRole("button", { name: dictionaries.ru.close, exact: true })
    .focus();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("link", {
      name: dictionaries.ru.macDownloadIcns,
      exact: true,
    }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger(page)).toBeFocused();
});

test("icon changes preserve documents, folders, revisions, preferences and reading positions", async ({
  page,
}) => {
  await start(page);
  const document = {
    ...createScript("Keep my document", "Original text"),
    scriptId: "keep",
    folderId: "keep-folder",
  };
  await page.evaluate(async (script) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open("teleo", 2);
      req.onsuccess = () => resolve(req.result);
    });
    const tx = db.transaction(["scripts", "folders", "revisions"], "readwrite");
    tx.objectStore("scripts").put(script);
    tx.objectStore("folders").put({
      folderId: "keep-folder",
      title: "Keep folder",
    });
    tx.objectStore("revisions").put({
      revisionId: "keep-revision",
      scriptId: "keep",
      timestamp: script.createdAt,
      title: script.title,
      body: "Earlier text",
      source: "edit",
    });
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    db.close();
    localStorage.setItem("teleo.selectedScript", "keep");
    localStorage.setItem("teleo.lastReadScript", "keep");
    localStorage.setItem("teleo.position.keep", "0.42");
  }, document);
  await page.reload();
  await expect(page.locator(".title-input")).toHaveValue("Keep my document");
  const snapshot = () =>
    page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const req = indexedDB.open("teleo", 2);
        req.onsuccess = () => resolve(req.result);
      });
      const records: Record<string, unknown> = {};
      for (const name of Array.from(db.objectStoreNames)) {
        records[name] = await new Promise((resolve) => {
          const req = db.transaction(name).objectStore(name).getAll();
          req.onsuccess = () => resolve(req.result);
        });
      }
      db.close();
      const local = Object.fromEntries(
        Object.entries(localStorage).filter(([key]) => key !== "teleo.macIcon"),
      );
      return { records, local };
    });
  const before = await snapshot();
  const dialog = await open(page);
  for (const radio of await dialog.getByRole("radio").all())
    await radio.click();
  await page.keyboard.press("Escape");
  await expect.poll(snapshot).toEqual(before);
});

test("settings fit and the install dialog remains usable on small screens in every locale", async ({
  page,
}, info) => {
  for (const locale of ["ru", "uk", "en"] as const) {
    await start(page, locale);
    for (const [width, height] of [
      [1440, 900],
      [375, 667],
      [320, 568],
      [844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      await trigger(page).click();
      const menu = page.locator(".top-settings > [popover]:popover-open");
      for (const surface of [menu, menu.locator(".settings")])
        expect(
          await surface.evaluate(
            (el) => el.scrollHeight <= el.clientHeight + 1,
          ),
        ).toBe(true);
      await menu
        .getByRole("button", {
          name: dictionaries[locale].macInstall,
          exact: true,
        })
        .click();
      const dialog = page.locator(".mac-install-sheet");
      const bounds = (await dialog.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await dialog.locator(".mac-install-note").scrollIntoViewIfNeeded();
      await expect(dialog.locator(".mac-install-note")).toBeInViewport();
      await dialog.locator(".mac-install-content").evaluate((el) => {
        el.scrollTop = 0;
      });
      if (locale === "ru")
        await dialog.screenshot({
          path: info.outputPath(`install-${width}x${height}.png`),
        });
      await page.keyboard.press("Escape");
    }
  }
});
