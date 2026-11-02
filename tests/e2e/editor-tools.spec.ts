import { test, expect, type Page } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
import { openSettings } from "./helpers";
import { readFileSync } from "node:fs";
const t = dictionaries.en;
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
  });
});

async function openStudio(page: Page) {
  await page.goto("/studio?lang=en");
  await expect(
    page.getByRole("button", { name: t.read, exact: true }).first(),
  ).toBeVisible();
}

const body = (page: Page) => page.getByRole("textbox", { name: t.body });

async function setBody(page: Page, text: string) {
  await body(page).fill(text);
  await expect(body(page)).toHaveValue(text);
}

async function select(page: Page, start: number, end: number) {
  await body(page).evaluate(
    (el: HTMLTextAreaElement, [a, b]) => {
      el.focus();
      el.setSelectionRange(a, b);
    },
    [start, end],
  );
}

async function openTools(page: Page) {
  await page.getByRole("button", { name: t.textTools, exact: true }).click();
  const menu = page.getByRole("menu", { name: t.textTools });
  await expect(menu).toBeVisible();
  return menu;
}

const undo = (page: Page) =>
  page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");

test("the tools button sits on the editor's top row and fits every width", async ({
  page,
}) => {
  await openStudio(page);
  const trigger = page.getByRole("button", { name: t.textTools, exact: true });
  await expect(trigger).toBeVisible();
  const top = await page
    .locator(".editor-top")
    .evaluate((el) => el.getBoundingClientRect());
  const box = (await trigger.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(32);
  // The icon (not its hover circle) lines up with the row's right edge.
  const icon = (await trigger.locator("svg").boundingBox())!;
  expect(Math.abs(icon.x + icon.width - top.right)).toBeLessThanOrEqual(3);
  // Vertically centred on the row, not pushing it taller.
  expect(
    Math.abs(box.y + box.height / 2 - (top.top + top.height / 2)),
  ).toBeLessThanOrEqual(3);
  const menu = await openTools(page);
  const m = (await menu.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(m.x).toBeGreaterThanOrEqual(0);
  expect(m.x + m.width).toBeLessThanOrEqual(viewport.width);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("clean up pasted text tidies the whole script and undoes in one step", async ({
  page,
}) => {
  await openStudio(page);
  const messy = "Hello  there. This line\nwas wrapped.\n\n\n\n• One\n• Two";
  await setBody(page, messy);
  await select(page, 0, 0);
  const menu = await openTools(page);
  await expect(menu.getByText(t.appliesToScript)).toBeVisible();
  await menu.getByRole("menuitem", { name: t.toolCleanup }).click();
  await expect(body(page)).toHaveValue(
    "Hello there. This line was wrapped.\n\nOne\n\nTwo",
  );
  await expect(page.locator(".editor-tools-note")).toHaveText(t.textUpdated);
  await expect(body(page)).toBeFocused();
  await undo(page);
  await expect(body(page)).toHaveValue(messy);
});

test("one sentence per paragraph, and nothing-to-change notice", async ({
  page,
}) => {
  await openStudio(page);
  await setBody(page, "First one. Second one! Third?");
  await select(page, 0, 0);
  let menu = await openTools(page);
  await menu.getByRole("menuitem", { name: t.toolSentences }).click();
  await expect(body(page)).toHaveValue("First one.\n\nSecond one!\n\nThird?");
  menu = await openTools(page);
  await menu.getByRole("menuitem", { name: t.toolSentences }).click();
  await expect(page.locator(".editor-tools-note")).toHaveText(
    t.nothingToChange,
  );
});

test("selection tools are disabled until text is selected, then apply to it", async ({
  page,
}) => {
  await openStudio(page);
  await setBody(page, "keep this\nand join\nthese lines");
  await select(page, 0, 0);
  let menu = await openTools(page);
  await expect(menu.getByRole("menuitem", { name: t.toolJoin })).toBeDisabled();
  await expect(
    menu.getByRole("menuitem", { name: t.caseUpper }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");

  await select(page, 10, 31);
  menu = await openTools(page);
  await expect(menu.locator(".tools-footer")).toContainText("4 words");
  await menu.getByRole("menuitem", { name: t.toolJoin }).click();
  await expect(body(page)).toHaveValue("keep this\nand join these lines");
  // The changed text stays selected so tools can be chained.
  menu = await openTools(page);
  await menu.getByRole("menuitem", { name: t.caseUpper }).click();
  await expect(body(page)).toHaveValue("keep this\nAND JOIN THESE LINES");
  menu = await openTools(page);
  await menu.getByRole("menuitem", { name: t.caseSentence }).click();
  await expect(body(page)).toHaveValue("keep this\nAnd join these lines");
  menu = await openTools(page);
  await menu.getByRole("menuitem", { name: t.toolWrapCue }).click();
  await expect(body(page)).toHaveValue("keep this\n[And join these lines]");
});

test("cue chips insert at the caret with spacing; autosave keeps the change", async ({
  page,
}) => {
  await openStudio(page);
  await setBody(page, "Hello world");
  await select(page, 5, 5);
  const menu = await openTools(page);
  await menu.getByRole("menuitem", { name: "[pause]" }).click();
  await expect(body(page)).toHaveValue("Hello [pause] world");
  await expect(page.locator(".editor-top [role=status]")).toHaveText(t.saved, {
    timeout: 5000,
  });
  await page.reload();
  await expect(body(page)).toHaveValue("Hello [pause] world");
});

test("find and replace: count, step, replace one and replace all", async ({
  page,
}) => {
  await openStudio(page);
  await setBody(page, "cat Cat cat dog");
  await body(page).focus();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+f" : "Control+f",
  );
  const bar = page.getByRole("search", { name: t.toolFind });
  await expect(bar).toBeVisible();
  const find = bar.getByRole("textbox", { name: t.findLabel });
  await expect(find).toBeFocused();
  await find.fill("cat");
  await expect(bar.locator(".find-count")).toHaveText("1 of 3");
  await find.press("Enter");
  await expect(bar.locator(".find-count")).toHaveText("2 of 3");
  await expect(find).toBeFocused();
  await bar.getByRole("checkbox", { name: t.matchCase }).check();
  await expect(bar.locator(".find-count")).toHaveText("1 of 2");
  await bar.getByRole("textbox", { name: t.replaceLabel }).fill("cow");
  await bar.getByRole("button", { name: t.replaceOne, exact: true }).click();
  await expect(body(page)).toHaveValue("cow Cat cat dog");
  await bar.getByRole("button", { name: t.replaceAll, exact: true }).click();
  await expect(body(page)).toHaveValue("cow Cat cow dog");
  await expect(bar.locator(".find-note")).toHaveText("Replaced: 1");
  await undo(page);
  await expect(body(page)).toHaveValue("cow Cat cat dog");
  await find.press("Escape");
  await expect(bar).toBeHidden();
  await expect(body(page)).toBeFocused();
});

test("find opens from the tools menu too", async ({ page }) => {
  await openStudio(page);
  const menu = await openTools(page);
  await menu.getByRole("menuitem", { name: new RegExp(t.toolFind) }).click();
  await expect(
    page.getByRole("search", { name: t.toolFind }).getByRole("textbox", {
      name: t.findLabel,
    }),
  ).toBeFocused();
});

test("settings show the version and the credit on separate lines", async ({
  page,
}) => {
  await openStudio(page);
  const settings = await openSettings(page, t);
  const version = settings.locator(".settings-version");
  await version.scrollIntoViewIfNeeded();
  await expect(version).toHaveText(`${t.version}${pkg.version}`);
  await expect(settings.locator(".settings-credit")).toHaveText(
    "Developed by MORPHINE",
  );
  const [a, b] = await Promise.all([
    version.boundingBox(),
    settings.locator(".settings-credit").boundingBox(),
  ]);
  expect(b!.y).toBeGreaterThanOrEqual(a!.y + a!.height - 1);
});

test("Reader dims [cues] without changing the paragraph text", async ({
  page,
}) => {
  await openStudio(page);
  await setBody(page, "Hello [smile] world");
  await page.getByRole("button", { name: t.read, exact: true }).first().click();
  await expect(page.locator(".reader")).toBeVisible();
  const cue = await page.evaluate(() => {
    const h = (
      CSS as unknown as { highlights?: Map<string, { size: number }> }
    ).highlights?.get("teleo-cue");
    return h ? h.size : -1;
  });
  expect(cue).toBe(1);
  await expect(page.locator("[data-paragraph]").first()).toHaveText(
    "Hello [smile] world",
  );
});
