import { expect, test, type Browser, type Page } from "@playwright/test";
import { dictionaries, type Locale } from "../../apps/web/src/i18n";

/**
 * 1.4 top bar on every class of screen: nothing overlaps or leaves the screen,
 * the controls share one height, the title is centred where it is one row, the
 * library is pinned on iPad landscape, and the tour spotlights the real controls.
 */
type Screen = {
  name: string;
  width: number;
  height: number;
  touch: boolean;
  /** One row with the title centred (everything wider than a phone in portrait). */
  row: boolean;
  /** Library always shown, no toggle. */
  pinned?: boolean;
};
const screens: Screen[] = [
  {
    name: "iPad Pro landscape",
    width: 1366,
    height: 1024,
    touch: true,
    row: true,
    pinned: true,
  },
  {
    name: "iPad Pro portrait",
    width: 1024,
    height: 1366,
    touch: true,
    row: true,
  },
  {
    name: "iPad Air landscape",
    width: 1180,
    height: 820,
    touch: true,
    row: true,
    pinned: true,
  },
  {
    name: "iPad mini landscape",
    width: 1133,
    height: 744,
    touch: true,
    row: true,
    pinned: true,
  },
  {
    name: "iPad mini portrait",
    width: 744,
    height: 1133,
    touch: true,
    row: true,
  },
  { name: "desktop", width: 1280, height: 800, touch: false, row: true },
  {
    name: "wide desktop",
    width: 1600,
    height: 1000,
    touch: false,
    row: true,
    pinned: true,
  },
  { name: "iPhone landscape", width: 844, height: 390, touch: true, row: true },
  {
    name: "iPhone SE landscape",
    width: 667,
    height: 375,
    touch: true,
    row: true,
  },
  { name: "iPhone portrait", width: 390, height: 844, touch: true, row: false },
  {
    name: "small phone portrait",
    width: 360,
    height: 640,
    touch: true,
    row: false,
  },
];

async function open(
  browser: Browser,
  s: Screen,
  locale: Locale = "ru",
  tour = false,
) {
  const context = await browser.newContext({
    viewport: { width: s.width, height: s.height },
    hasTouch: s.touch,
    isMobile: s.touch && s.width < 900,
  });
  const page = await context.newPage();
  await page.addInitScript(
    ([lang, tour]) => {
      sessionStorage.setItem("teleo.intro.seen.v1", "true");
      localStorage.setItem("teleo.locale", lang as string);
      if (tour && !localStorage.getItem("teleo.tour.v140"))
        localStorage.setItem("teleo.tour.v140", "force");
    },
    [locale, tour] as const,
  );
  await page.goto(`/studio?lang=${locale}`);
  await expect(page.locator(".editor textarea")).toBeVisible();
  return { page, close: () => context.close() };
}

type Rect = { x: number; y: number; width: number; height: number };
const rect = (page: Page, selector: string) =>
  page.locator(selector).first().boundingBox() as Promise<Rect>;
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width - 0.5 &&
  b.x < a.x + a.width - 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  b.y < a.y + a.height - 0.5;

const controls = [
  ".topbar-library",
  "header .brand",
  "header .script-selector .picker-trigger",
  "header .tour-remote",
  "header .top-settings > .picker-trigger",
  "header .topbar-read",
];

async function checkBar(page: Page, s: Screen) {
  const boxes: [string, Rect][] = [];
  for (const sel of controls) {
    const el = page.locator(sel).first();
    if (sel === ".topbar-library" && s.pinned) {
      await expect(el).toBeHidden();
      continue;
    }
    await expect(el, sel).toBeVisible();
    const box = (await el.boundingBox())!;
    expect(box.x, sel).toBeGreaterThanOrEqual(0);
    expect(box.y, sel).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, sel).toBeLessThanOrEqual(s.width + 0.5);
    if (sel !== "header .brand") expect(Math.round(box.height), sel).toBe(44);
    boxes.push([sel, box]);
  }
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      expect(
        overlaps(boxes[i][1], boxes[j][1]),
        `${boxes[i][0]} overlaps ${boxes[j][0]}`,
      ).toBe(false);
  const header = (await rect(page, "header"))!;
  const editor = (await rect(page, ".editor"))!;
  expect(editor.y).toBeGreaterThanOrEqual(header.y + header.height - 0.5);
  const title = boxes.find(([sel]) => sel.includes("script-selector"))![1];
  const read = boxes.find(([sel]) => sel.includes("topbar-read"))![1];
  if (s.row) {
    // One row: everything shares a centre line and the title sits mid-screen.
    for (const [sel, box] of boxes)
      expect(
        Math.abs(box.y + box.height / 2 - (read.y + read.height / 2)),
        sel,
      ).toBeLessThan(3);
    expect(Math.abs(title.x + title.width / 2 - s.width / 2)).toBeLessThan(2);
    await expect(page.locator(".editor-meta")).toBeHidden();
    await expect(page.locator("header .topbar-meta")).toBeVisible();
  } else {
    // Portrait phone: the script picker and Read share the second row.
    expect(Math.abs(title.y - read.y)).toBeLessThan(1);
    const brand = boxes.find(([sel]) => sel.includes("brand"))![1];
    expect(title.y).toBeGreaterThan(brand.y + brand.height - 1);
    await expect(page.locator(".editor-meta")).toBeVisible();
    await expect(page.locator("header .topbar-meta")).toBeHidden();
  }
}

for (const s of screens)
  test(`top bar fits: ${s.name}`, async ({ browser }) => {
    test.setTimeout(60_000);
    for (const locale of ["ru", "uk", "en"] as const) {
      const { page, close } = await open(browser, s, locale);
      await checkBar(page, s);
      await close();
    }
    // A very long title is cut, never pushed into the other controls.
    const { page, close } = await open(browser, s);
    await page
      .getByRole("textbox", { name: dictionaries.ru.title, exact: true })
      .fill(
        "Очень длинное название сценария для проверки верхней панели teleo",
      );
    await checkBar(page, s);
    if (s.pinned) {
      await expect(page.locator(".library")).toBeVisible();
      await expect(
        page.locator(".library-heading > .icon-button"),
      ).toBeHidden();
    }
    await close();
  });

test("Read becomes Editor while reading on iPad", async ({ browser }) => {
  const t = dictionaries.ru;
  const { page, close } = await open(browser, screens[0]);
  await page.getByRole("button", { name: t.read, exact: true }).click();
  await expect(page.locator(".reader")).toBeVisible();
  await page.getByRole("button", { name: t.editor, exact: true }).click();
  await expect(page.locator(".reader")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: t.read, exact: true }),
  ).toBeVisible();
  await close();
});

test("phone landscape keeps script actions in the ⋯ menu", async ({
  browser,
}) => {
  const t = dictionaries.ru;
  const { page, close } = await open(browser, screens[7]);
  await expect(page.locator(".editor > .document-actions")).toBeHidden();
  await page.locator(".editor-tools-trigger").click();
  const menu = page.getByRole("menu", { name: t.textTools });
  for (const key of [
    "duplicate",
    "export",
    "exportJSON",
    "versions",
    "delete",
  ] as const)
    await expect(
      menu.getByRole("menuitem", { name: t[key], exact: true }),
    ).toBeAttached();
  await menu.getByRole("menuitem", { name: t.duplicate, exact: true }).click();
  await expect(
    page.locator("header .script-selector .picker-trigger"),
  ).toContainText("Welcome");
  await close();
  // Elsewhere the row stays under the text and the menu has no copy of it.
  const other = await open(browser, screens[0]);
  await expect(other.page.locator(".editor > .document-actions")).toBeVisible();
  await other.page.locator(".editor-tools-trigger").click();
  await expect(other.page.locator(".tools-document")).toBeHidden();
  await other.close();
});

const tourSteps = [
  ["tourEditorTitle", ".editor textarea"],
  ["tourToolsTitle", ".editor-tools-trigger"],
  ["tourPhoneTitle", "header .tour-remote"],
  ["tourReadTitle", "header .topbar-read"],
] as const;
for (const s of screens)
  test(`tour points at the new controls: ${s.name}`, async ({ browser }) => {
    test.setTimeout(60_000);
    const t = dictionaries.ru;
    const { page, close } = await open(browser, s, "ru", true);
    for (const [title, target] of tourSteps) {
      await expect(page.getByRole("dialog", { name: t[title] })).toBeVisible({
        timeout: 20_000,
      });
      // The spotlight settles around the control with a small margin.
      await expect
        .poll(
          async () => {
            const spot = (await rect(page, ".tour-spotlight"))!;
            const goal = (await rect(page, target))!;
            return (
              goal.x >= spot.x - 0.5 &&
              goal.y >= spot.y - 0.5 &&
              goal.x + goal.width <= spot.x + spot.width + 0.5 &&
              goal.y + goal.height <= spot.y + spot.height + 0.5 &&
              spot.width - goal.width < 16 &&
              spot.height - goal.height < 16
            );
          },
          { message: `${title} spotlight` },
        )
        .toBe(true);
      await page.waitForTimeout(300);
      const goal = (await rect(page, target))!;
      // The card never hides a small control it explains.
      const card = (await rect(page, ".tour-card"))!;
      if (goal.height < 120) expect(overlaps(card, goal), title).toBe(false);
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(s.width + 0.5);
      expect(card.y + card.height).toBeLessThanOrEqual(s.height + 0.5);
      await page.getByRole("button", { name: t.tourNext, exact: true }).click();
    }
    await expect(
      page.getByRole("dialog", { name: t.tourVoiceTitle }),
    ).toBeVisible();
    await page.getByRole("button", { name: t.tourFinish, exact: true }).click();
    await expect(page.locator(".tour")).toHaveCount(0);
    await close();
  });
