import { readerTypography } from "./helpers";
import { prepareReader } from "./helpers";
import { test, expect, type Page } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
const t = dictionaries.en;
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
    if (!localStorage.getItem("teleo.demo.auto"))
      localStorage.setItem("teleo.demo.auto", "false");
  });
});
async function create(
  page: Page,
  body = "Original words.\n\nSecond paragraph.",
) {
  await page.goto("/studio?lang=en");
  await page
    .getByRole("button", { name: t.newScript, exact: true })
    .first()
    .click();
  await page.getByRole("textbox", { name: t.body, exact: true }).fill(body);
  await page.getByRole("textbox", { name: t.body, exact: true }).blur();
  await expect(
    page.getByRole("status").filter({ hasText: t.saved }),
  ).toBeVisible();
}
async function stored(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("teleo", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const result = await new Promise<
      { body: string; deletedAt?: string; title: string }[]
    >((resolve, reject) => {
      const request = db.transaction("scripts").objectStore("scripts").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  });
}
test("stale edits remain recoverable without overwriting newer text or tombstones", async ({
  page,
  context,
}, info) => {
  await create(page);
  const stale = await context.newPage();
  await stale.goto("/studio?lang=en");
  await expect(
    stale.getByRole("textbox", { name: t.body, exact: true }),
  ).toHaveValue("Original words.\n\nSecond paragraph.");
  await page
    .getByRole("textbox", { name: t.body, exact: true })
    .fill("Fresh text in the first tab");
  await page.getByRole("textbox", { name: t.body, exact: true }).blur();
  await expect(
    page.getByRole("status").filter({ hasText: t.saved }),
  ).toBeVisible();
  await stale
    .getByRole("textbox", { name: t.body, exact: true })
    .fill("Draft from stale tab");
  await stale.getByRole("textbox", { name: t.body, exact: true }).blur();
  await expect(
    stale.getByRole("status").filter({ hasText: t.saveConflict }),
  ).toBeVisible();
  expect((await stored(page))[0].body).toBe("Fresh text in the first tab");
  await stale.screenshot({
    animations: "disabled",
    path: `docs/screenshots/full-audit-${info.project.name}-conflict.png`,
  });
  await stale.reload();
  await expect(
    stale.getByRole("textbox", { name: t.body, exact: true }),
  ).toHaveValue("Draft from stale tab");
  let scripts = await stored(page);
  expect(scripts.map((s) => s.body).sort()).toEqual(
    ["Draft from stale tab", "Fresh text in the first tab"].sort(),
  );
  await stale.reload();
  expect(await stored(page)).toHaveLength(2);
  // The original page is still editing the original record. Delete it deliberately.
  await page.getByRole("button", { name: t.delete, exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: t.confirm, exact: true })
    .click();
  await expect
    .poll(async () => (await stored(page)).filter((s) => s.deletedAt).length)
    .toBe(1);
  scripts = await stored(page);
  expect(scripts.find((s) => s.deletedAt)?.body).toBe(
    "Fresh text in the first tab",
  );
  await stale.close();
});
test("Back dismisses a modal and fullscreen rejection does not break editing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/help?lang=en");
  await page.getByRole("button", { name: t.launch, exact: true }).click();
  await page
    .getByRole("button", { name: t.newScript, exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: t.body, exact: true })
    .fill("Read this safely.");
  await page.getByRole("button", { name: t.read, exact: true }).click();
  await prepareReader(page, t);
  await page.evaluate(() => {
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => document.documentElement,
    });
    document.exitFullscreen = () =>
      Promise.reject(Error("Audit fullscreen denied"));
  });
  await page.getByRole("button", { name: t.editor, exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: t.body, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: t.delete, exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/help/);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: t.helpTitle })).toBeVisible();
  expect(errors).toEqual([]);
});
test("responsive editor, reading, language menus and remote at six sizes plus landscape", async ({
  page,
}, info) => {
  await create(page, "A calm voice.\n\nYour words. Your pace.\n\n".repeat(30));
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [1024, 768],
    [834, 1112],
    [390, 844],
    [375, 667],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    if (width <= 900 && (await page.locator(".library").isVisible()))
      await page
        .locator(".library")
        .getByRole("button", { name: t.closeLibrary, exact: true })
        .click();
    await expect(
      page.getByRole("textbox", { name: t.body, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const language = page.locator("header .language-control");
    await expect(language).toHaveCount(1);
    const box = (await language.boundingBox())!;
    expect(box.width).toBe(44);
    expect(box.height).toBe(44);
    await language.getByRole("combobox").click();
    await expect(
      page.getByRole("option", { name: /Українська/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.screenshot({
      animations: "disabled",
      path: `docs/screenshots/full-audit-${info.project.name}-studio-${width}x${height}.png`,
    });
    await page.getByRole("button", { name: t.read, exact: true }).click();
  await prepareReader(page, t);
    await page
      .locator(".reader-controls")
      .getByRole("button", { name: t.play, exact: true })
      .click();
    await expect
      .poll(() =>
        page.locator(".reading-viewport").evaluate((el) => el.scrollTop),
      )
      .toBeGreaterThan(0);
    await page
      .locator(".reader-controls")
      .getByRole("button", { name: t.pause, exact: true })
      .click();
    await (await readerTypography(page, t, "fontSize")).fill("52");
    await expect(page.locator(".reader article")).toHaveCSS(
      "font-size",
      "52px",
    );
    await page.screenshot({
      animations: "disabled",
      path: `docs/screenshots/full-audit-${info.project.name}-reader-${width}x${height}.png`,
    });
    await page.getByRole("button", { name: t.editor, exact: true }).click();
  }
  await page.goto("/remote?lang=en");
  for (const [width, height] of [
    [390, 844],
    [375, 667],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator(".remote-main-play")).toBeVisible();
    const play = (await page.locator(".remote-main-play").boundingBox())!;
    expect(play.y + play.height).toBeLessThanOrEqual(height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      animations: "disabled",
      path: `docs/screenshots/full-audit-${info.project.name}-remote-${width}x${height}.png`,
    });
  }
  expect(errors).toEqual([]);
});

test("preview hash failure clears phone text; remote fullscreen exit rejection is handled", async ({
  page,
  browser,
  baseURL,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await create(page, "Original private preview");
  await page
    .locator("header")
    .getByRole("button", { name: t.remoteConnection, exact: true })
    .click();
  const pair = page.getByRole("dialog", {
    name: t.remoteConnection,
    exact: true,
  });
  const invite = await pair
    .getByRole("link", { name: t.invite, exact: true })
    .getAttribute("href");
  const phoneContext = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const phone = await phoneContext.newPage();
  phone.on("pageerror", (e) => errors.push(e.message));
  try {
    await phone.goto(invite!);
    await pair.getByRole("button", { name: t.allow, exact: true }).click();
    await expect(pair).not.toBeVisible();
    await page
      .locator("header")
      .getByRole("button", { name: t.remoteConnection, exact: true })
      .click();
    await pair
      .getByRole("checkbox", { name: t.allowPreview, exact: true })
      .check();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: t.close, exact: true })
      .click();
    await expect(phone.locator(".remote-text")).toContainText(
      "Original private preview",
    );
    await phone.evaluate(() => {
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        get: () => document.documentElement,
      });
      document.exitFullscreen = () =>
        Promise.reject(Error("Audit denied exit"));
    });
    await phone
      .getByRole("button", { name: t.advancedSettings, exact: true })
      .click();
    await phone
      .getByRole("button", { name: t.fullscreen, exact: true })
      .click();
    await phone
      .locator(".remote-settings-page")
      .getByRole("button", { name: t.back, exact: true })
      .click();
    await page.evaluate(() => {
      crypto.subtle.digest = () =>
        Promise.reject(Error("Audit digest failure"));
    });
    await page
      .getByRole("textbox", { name: t.body, exact: true })
      .fill("New private words stay saved");
    await page.getByRole("textbox", { name: t.body, exact: true }).blur();
    await expect(phone.locator(".remote-text")).not.toContainText(
      "Original private preview",
    );
    await expect(phone.locator(".remote-text")).not.toContainText(
      "New private words",
    );
    await expect(page.getByRole("alert")).toContainText(t.unavailable);
    await expect
      .poll(async () => (await stored(page))[0].body)
      .toBe("New private words stay saved");
    await phone.screenshot({
      animations: "disabled",
      path: `docs/screenshots/full-audit-${info.project.name}-preview-failure.png`,
    });
    expect(errors).toEqual([]);
  } finally {
    await phoneContext.close();
  }
});

test("independent stale tabs retain both recovery drafts; malformed entries do not block them", async ({
  page,
  context,
}) => {
  await create(page, "Original shared script");
  const b = await context.newPage(),
    c = await context.newPage();
  await b.goto("/studio?lang=en");
  await c.goto("/studio?lang=en");
  await expect(
    c.getByRole("textbox", { name: t.body, exact: true }),
  ).toHaveValue("Original shared script");
  await page
    .getByRole("textbox", { name: t.body, exact: true })
    .fill("Durable newer version");
  await page.getByRole("textbox", { name: t.body, exact: true }).blur();
  await expect(
    page.getByRole("status").filter({ hasText: t.saved }),
  ).toBeVisible();
  for (const [tab, text] of [
    [b, "Draft B"],
    [c, "Draft C"],
  ] as const) {
    await tab.getByRole("textbox", { name: t.body, exact: true }).fill(text);
    await tab.getByRole("textbox", { name: t.body, exact: true }).blur();
    await expect(
      tab.getByRole("status").filter({ hasText: t.saveConflict }),
    ).toBeVisible();
  }
  const drafts = await page.evaluate(() =>
    Object.entries(localStorage)
      .filter(([k, v]) => k.startsWith("teleo.recovery.") && v)
      .map(([, v]) => JSON.parse(v).body),
  );
  expect(drafts.sort()).toEqual(["Draft B", "Draft C"]);
  await page.evaluate(() =>
    localStorage.setItem("teleo.recovery.malformed", "{bad"),
  );
  const recovered = await context.newPage();
  await recovered.goto("/studio?lang=en");
  await expect
    .poll(async () => (await stored(recovered)).map((s) => s.body).sort())
    .toEqual(["Draft B", "Draft C", "Durable newer version"].sort());
  await recovered.reload();
  expect(await stored(recovered)).toHaveLength(3);
  await b.close();
  await c.close();
  await recovered.close();
});

test("a large local TXT recovery is restored intact rather than rejected as a portable JSON import", async ({
  page,
}) => {
  // Deliberate 2MB single-word browser-layout stress case; retain full content assertions.
  test.setTimeout(90000);
  await page.goto("/studio?lang=en");
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const scriptId = crypto.randomUUID();
    localStorage.setItem("teleo.selectedScript", scriptId);
    localStorage.setItem(
      "teleo.recovery." + scriptId,
      JSON.stringify({
        scriptId,
        title: "Large TXT draft",
        body: "x".repeat(2_000_001),
        createdAt: now,
        updatedAt: now,
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
      }),
    );
  });
  await page.reload();
  const editor = page.getByRole("textbox", { name: t.body, exact: true });
  await expect(editor).toBeVisible({ timeout: 30000 });
  expect((await editor.inputValue()).length).toBe(2_000_001);
  expect((await stored(page))[0].body.length).toBe(2_000_001);
  await page.reload();
  expect(
    (
      await page
        .getByRole("textbox", { name: t.body, exact: true })
        .inputValue()
    ).length,
  ).toBe(2_000_001);
  expect(await stored(page)).toHaveLength(1);
});
