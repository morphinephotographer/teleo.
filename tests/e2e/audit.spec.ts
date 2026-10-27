import { test, expect, type Page } from "@playwright/test";
import { chooseSelect } from "./helpers";
import { dictionaries } from "../../apps/web/src/i18n";
const t = dictionaries.en;
for (const locale of ["en", "uk", "ru"])
  test(`${locale}: complete final wordmark survives disabled CSS animations`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.clock.install();
    await page.goto("/studio?lang=" + locale);
    await page.addStyleTag({
      content: ".intro-assembly *, .drift-letter {animation:none!important}",
    });
    await expect(
      page.getByRole("dialog", { name: "teleo.", exact: true }),
    ).toBeVisible();
    await page.clock.runFor(2250);
    const word = page.locator(".intro-static");
    await expect(word).toHaveText("teleo.");
    await expect(word).toBeVisible();
    await expect(page.locator(".intro-assembly")).toHaveCount(0);
    const box = (await word.boundingBox())!;
    expect(box.width).toBeGreaterThan(120);
    await page.screenshot({
      path: `docs/screenshots/audit-${info.project.name}-${locale}-intro.png`,
    });
    await page.clock.runFor(1300);
    await expect(page.locator(".brand-intro")).toHaveCount(0);
    await expect(page.locator(".app-shell")).not.toHaveAttribute("inert", "");
    await page.reload();
    await expect(page.locator(".brand-intro")).toHaveCount(0);
  });
async function create(
  page: Page,
  title = "Audit script",
  body = "Safe original text.",
) {
  await page.addInitScript(() =>
    sessionStorage.setItem("teleo.intro.seen.v1", "true"),
  );
  await page.setExtraHTTPHeaders({ "CF-Connecting-IP": crypto.randomUUID() });
  await page.goto("/studio?lang=en");
  await page
    .getByRole("button", { name: t.newScript, exact: true })
    .first()
    .click();
  await page.getByRole("textbox", { name: t.title, exact: true }).fill(title);
  await page.getByRole("textbox", { name: t.body, exact: true }).fill(body);
  await page.getByRole("textbox", { name: t.body, exact: true }).blur();
  await expect(
    page.getByRole("status").filter({ hasText: t.saved }),
  ).toBeVisible();
}
async function showLibrary(page: Page) {
  if (!(await page.locator(".library").isVisible()))
    await page
      .locator("header")
      .getByRole("button", { name: t.library, exact: true })
      .click();
}
async function failScriptWrites(page: Page) {
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (this.name === "scripts")
        throw new DOMException("Audit quota failure", "QuotaExceededError");
      return original.call(this, value, key);
    };
    (
      window as unknown as { restoreAuditWrites: () => void }
    ).restoreAuditWrites = () => {
      IDBObjectStore.prototype.put = original;
    };
  });
}
async function restoreWrites(page: Page) {
  await page.evaluate(() =>
    (
      window as unknown as { restoreAuditWrites: () => void }
    ).restoreAuditWrites(),
  );
}
test("failed save blocks folder deletion and preserves the latest draft", async ({
  page,
}) => {
  await create(page);
  await showLibrary(page);
  await page.getByRole("button", { name: t.newFolder, exact: true }).click();
  const createDialog = page.getByRole("dialog", {
    name: t.newFolder,
    exact: true,
  });
  await createDialog.getByRole("textbox").fill("Protected");
  await createDialog.getByRole("textbox").press("Enter");
  const filter = page.getByRole("combobox", { name: t.folder, exact: true });
  await filter.click();
  const id = await filter.getAttribute("aria-controls");
  const folder = (await page
    .locator(`[id="${id}"]`)
    .getByRole("option", { name: "Protected", exact: true })
    .getAttribute("data-value"))!;
  await page.keyboard.press("Escape");
  await page
    .locator(".library")
    .getByRole("button", { name: t.closeLibrary, exact: true })
    .click();
  await chooseSelect(
    page.getByRole("combobox", { name: t.scriptFolder, exact: true }),
    folder,
  );
  await expect(
    page.getByRole("status").filter({ hasText: t.saved }),
  ).toBeVisible();
  await showLibrary(page);
  await chooseSelect(filter, folder);
  await failScriptWrites(page);
  await page
    .locator(".library")
    .getByRole("button", { name: t.closeLibrary, exact: true })
    .click();
  await page
    .getByRole("textbox", { name: t.body, exact: true })
    .fill("Latest draft must survive.");
  await showLibrary(page);
  await page.getByRole("button", { name: t.deleteFolder, exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: t.deleteFolder,
    exact: true,
  });
  await dialog.getByRole("button", { name: t.confirm, exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText(t.saveError);
  expect(await page.locator(".editor textarea").inputValue()).toBe(
    "Latest draft must survive.",
  );
  await restoreWrites(page);
  await dialog.getByRole("button", { name: t.cancel, exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: t.saved }),
  ).toBeVisible();
  await page.getByRole("button", { name: t.deleteFolder, exact: true }).click();
  await dialog.getByRole("button", { name: t.confirm, exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("combobox", { name: t.scriptFolder, exact: true }),
  ).toContainText(t.noFolder);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: t.body, exact: true }),
  ).toHaveValue("Latest draft must survive.");
});
test("failed trash write cannot silently delete a script after Cancel", async ({
  page,
}) => {
  await create(page);
  await failScriptWrites(page);
  await page
    .getByRole("toolbar", { name: t.documentActions, exact: true })
    .getByRole("button", { name: t.delete, exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: t.confirmDelete,
    exact: true,
  });
  await dialog.getByRole("button", { name: t.confirm, exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText(t.saveError);
  await restoreWrites(page);
  await dialog.getByRole("button", { name: t.cancel, exact: true }).click();
  await page.waitForTimeout(1100);
  await page.reload();
  await expect(page.locator(".script-list button")).toHaveCount(1);
  await expect(
    page.getByRole("textbox", { name: t.body, exact: true }),
  ).toHaveValue("Safe original text.");
});
test("a queued typography frame cannot change a newly selected script playhead", async ({
  page,
  browser,
}) => {
  await create(page, "Script A", "Paragraph A.\n\n".repeat(120));
  await showLibrary(page);
  await page
    .getByRole("button", { name: t.newScript, exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: t.title, exact: true })
    .fill("Script B");
  await page
    .getByRole("textbox", { name: t.body, exact: true })
    .fill("Paragraph B.\n\n".repeat(120));
  const selector = page
    .locator("header")
    .getByRole("combobox", { name: t.currentScript, exact: true });
  await selector.click();
  let listId = await selector.getAttribute("aria-controls");
  const bId = (await page
    .locator(`[id="${listId}"]`)
    .getByRole("option", { name: "Script B", exact: true })
    .getAttribute("data-value"))!;
  const aId = (await page
    .locator(`[id="${listId}"]`)
    .getByRole("option", { name: "Script A", exact: true })
    .getAttribute("data-value"))!;
  await page.keyboard.press("Escape");
  await page.evaluate(
    (id) => localStorage.setItem("teleo.position." + id, "200"),
    bId,
  );
  await chooseSelect(selector, aId);
  await page.getByRole("button", { name: t.read, exact: true }).click();
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
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    phone = await context.newPage();
  await phone.goto(invite!);
  await pair.getByRole("button", { name: t.allow, exact: true }).click();
  await expect(phone.locator(".remote-connection")).toContainText(t.connected);
  await phone
    .getByRole("button", { name: t.quickTypography, exact: true })
    .click();
  await expect(
    phone
      .getByRole("region", { name: t.quickTypography, exact: true })
      .getByRole("slider", { name: t.fontSize, exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => {
    const request = window.requestAnimationFrame,
      cancel = window.cancelAnimationFrame,
      queue = new Map<number, FrameRequestCallback>();
    let id = -1;
    window.requestAnimationFrame = (cb) => {
      const next = id--;
      queue.set(next, cb);
      return next;
    };
    window.cancelAnimationFrame = (key) => {
      if (key < 0) queue.delete(key);
      else cancel(key);
    };
    (
      window as unknown as { releaseAuditFrames: () => void }
    ).releaseAuditFrames = () => {
      window.requestAnimationFrame = request;
      window.cancelAnimationFrame = cancel;
      for (const callback of queue.values()) callback(performance.now());
      queue.clear();
    };
  });
  await phone.getByRole("slider", { name: t.fontSize, exact: true }).fill("68");
  await phone.getByRole("slider", { name: t.fontSize, exact: true }).blur();
  await expect(page.locator(".reader article")).toHaveCSS("font-size", "68px");
  await selector.dispatchEvent("click");
  listId = await selector.getAttribute("aria-controls");
  await page
    .locator(`[id="${listId}"]`)
    .getByRole("option", { name: "Script B", exact: true })
    .dispatchEvent("click");
  await expect(page.locator(".reader article")).toContainText("Paragraph B.");
  await page.evaluate(() =>
    (
      window as unknown as { releaseAuditFrames: () => void }
    ).releaseAuditFrames(),
  );
  await expect(
    page.getByRole("slider", { name: t.position, exact: true }),
  ).toHaveValue("200");
  await context.close();
});
