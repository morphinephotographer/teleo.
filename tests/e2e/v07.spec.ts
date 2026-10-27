import { test, expect, type Page } from "@playwright/test";
import { spawnSync } from "node:child_process";
import QRCode from "qrcode";
import { fileURLToPath } from "node:url";
import { dictionaries } from "../../apps/web/src/i18n";
import { chooseSelect, managePhone } from "./helpers";
// Offline/SW persistence is covered separately. Block SW here so intentional
// network failures reach Playwright routing consistently, including WebKit HTTPS.
test.use({ serviceWorkers: "block" });
const target = process.env.TELEO_V07_URL;
if (target) test.use({ baseURL: target });
const local = !target || new URL(target).hostname === "127.0.0.1";
const t = dictionaries.en;
const capture = target
  ? new URL(target).hostname === "teleo.cc"
    ? "v07-production"
    : "v07-staging"
  : "v07";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("teleo.intro.seen.v1", "true"),
  );
  if (local)
    await page.setExtraHTTPHeaders({ "CF-Connecting-IP": crypto.randomUUID() });
});
async function language(page: Page, languages: string[]) {
  await page.addInitScript((values) => {
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      get: () => values,
    });
    Object.defineProperty(navigator, "language", {
      configurable: true,
      get: () => values[0],
    });
  }, languages);
}
for (const [languages, expected, label] of [
  [["uk-UA"], "uk", "UA"],
  [["ru-RU"], "ru", "RU"],
  [["en-GB"], "en", "EN"],
  [["fr-FR", "RU-ua"], "ru", "RU"],
  [["de-DE", "fr-FR"], "en", "EN"],
] as const)
  test(`autodetection ${languages.join(",")} → ${label}`, async ({ page }) => {
    await language(page, [...languages]);
    await page.goto("/studio?lang=en");
    await expect(page.locator("html")).toHaveAttribute("lang", expected);
    await expect(
      page.locator("header .language-control .picker-trigger"),
    ).toHaveText(label);
    expect(
      await page.evaluate(() => localStorage.getItem("teleo.locale")),
    ).toBeNull();
  });
test("manual override persists across routes, reload and languagechange; script unchanged", async ({
  page,
}) => {
  await language(page, ["uk-UA"]);
  await page.goto("/studio?lang=ru");
  await chooseSelect(
    page.getByRole("combobox", { name: dictionaries.uk.language, exact: true }),
    "ru",
  );
  await page
    .getByRole("button", { name: dictionaries.ru.newScript, exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: dictionaries.ru.body, exact: true })
    .fill("Мой текст 🌍 / My script");
  await page
    .getByRole("textbox", { name: dictionaries.ru.body, exact: true })
    .blur();
  await expect(
    page.getByRole("status").filter({ hasText: dictionaries.ru.saved }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: dictionaries.ru.body, exact: true }),
  ).toHaveValue("Мой текст 🌍 / My script");
  await page.evaluate(() => window.dispatchEvent(new Event("languagechange")));
  await page.goto("/help?lang=en");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.locator(".language-control .picker-trigger")).toHaveText(
    "RU",
  );
});
test("languagechange without override follows device; stored invalid values ignored", async ({
  page,
}) => {
  await language(page, ["fr-FR"]);
  await page.addInitScript(() =>
    localStorage.setItem("teleo.locale", "constructor"),
  );
  await page.goto("/studio");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      get: () => ["uk-UA"],
    });
    window.dispatchEvent(new Event("languagechange"));
  });
  await expect(page.locator("html")).toHaveAttribute("lang", "uk");
});
test("locale menu keyboard, outside dismissal and no-popover fallback", async ({
  page,
}) => {
  await language(page, ["en-US"]);
  await page.goto("/studio");
  let control = page.locator("header .language-control .picker-trigger");
  await control.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option", { selected: true })).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(control).toHaveText("RU");
  await expect(control).toBeFocused();
  await control.click();
  await page.keyboard.press("Escape");
  await expect(control).toHaveAttribute("aria-expanded", "false");
  await control.click();
  await page.mouse.click(10, 180);
  await expect(control).toHaveAttribute("aria-expanded", "false");
  await page.addInitScript(() =>
    Object.defineProperty(HTMLElement.prototype, "showPopover", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.reload();
  control = page.locator("header .language-control .picker-trigger");
  await chooseSelect(control, "uk");
  await expect(control).toHaveText("UA");
  await expect(control).toBeFocused();
});
test("inert wordmark and circular locale: visual viewport matrix", async ({
  page,
}, info) => {
  await language(page, ["en-US"]);
  await page.goto("/studio");
  const mark = page.locator("header .wordmark");
  expect(
    await mark.evaluate((el) => ({
      tag: el.tagName,
      href: el.getAttribute("href"),
      tab: el.getAttribute("tabindex"),
      role: el.getAttribute("role"),
    })),
  ).toEqual({ tag: "SPAN", href: null, tab: null, role: null });
  const original = page.url();
  const history = await page.evaluate(() => window.history.length);
  const requests: string[] = [];
  page.on("request", (req) => requests.push(new URL(req.url()).pathname));
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [834, 1112],
    [390, 844],
    [375, 667],
  ]) {
    await page.setViewportSize({ width, height });
    const circle = page.locator("header .language-control .picker-trigger");
    await expect(page.locator(".language-control")).toHaveCount(1);
    await expect(circle).toBeInViewport();
    const box = (await circle.boundingBox())!;
    expect(box.width).toBe(44);
    expect(box.height).toBe(44);
    const label = (await circle.locator("span").boundingBox())!;
    expect(
      Math.abs(label.x + label.width / 2 - box.x - box.width / 2),
    ).toBeLessThan(1);
    await expect(circle).toHaveCSS("border-radius", "50%");
    await expect(circle.locator("svg,.picker-chevron")).toHaveCount(0);
    const m = (await mark.boundingBox())!;
    await page.mouse.click(m.x + m.width / 2, m.y + m.height / 2);
    expect(page.url()).toBe(original);
    expect(await page.evaluate(() => window.history.length)).toBe(history);
    expect(await mark.evaluate((el) => document.activeElement === el)).toBe(
      false,
    );
    await expect(mark).toHaveCSS("text-decoration-line", "none");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      animations: "disabled",
      path: `docs/screenshots/${capture}-${info.project.name}-header-${width}x${height}.png`,
    });
    await circle.focus();
    await page.keyboard.press("ArrowDown");
    const popup = page.getByRole("listbox", { name: t.language, exact: true });
    await expect(popup.getByRole("option")).toHaveCount(3);
    const menu = (await popup.boundingBox())!;
    expect(menu.x).toBeGreaterThanOrEqual(0);
    expect(menu.x + menu.width).toBeLessThanOrEqual(width);
    await page.screenshot({
      animations: "disabled",
      path: `docs/screenshots/${capture}-${info.project.name}-menu-${width}x${height}.png`,
    });
    await page.keyboard.press("Escape");
    await expect(circle).toBeFocused();
    await page.screenshot({
      animations: "disabled",
      path: `docs/screenshots/${capture}-${info.project.name}-focus-${width}x${height}.png`,
    });
  }
  expect(requests.filter((path) => path !== "/sw.js")).toEqual([]);
  for (const route of ["/help", "/privacy"]) {
    await page.goto(route);
    const control = page.locator("header .language-control .picker-trigger");
    const box = (await control.boundingBox())!;
    expect(box.x + box.width).toBeGreaterThan(page.viewportSize()!.width - 24);
    await expect(page.locator(".language-control")).toHaveCount(1);
    await page.screenshot({
      path: `docs/screenshots/${capture}-${info.project.name}-${route.slice(1)}.png`,
      animations: "disabled",
    });
  }
});
function decode(png: string, url: string) {
  const result = spawnSync(
    "swift",
    [
      "-module-cache-path",
      "/private/tmp/teleo-v061-swift-cache",
      fileURLToPath(new URL("./decode-qr.swift", import.meta.url)),
    ],
    { input: JSON.stringify({ png, url }), encoding: "utf8", timeout: 30000 },
  );
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe("decoded");
}
test("branded QR decodes at native and rendered sizes; confirmed pairing, device locales and revoke", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(90000);
  await language(page, ["en-GB"]);
  await page.goto("/studio");
  await page
    .getByRole("button", { name: t.newScript, exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: t.body, exact: true })
    .fill("Untranslated script.\n\n".repeat(100));
  await page
    .locator("header")
    .getByRole("button", { name: t.remoteConnection, exact: true })
    .click();
  const pair = page.locator(".pairing-sheet");
  const img = pair.locator("img");
  await expect(img).toBeVisible();
  await expect(
    pair.getByRole("button", { name: t.revoke, exact: true }),
  ).toHaveCount(0);
  await expect(pair.locator(".phone-illustration")).toHaveCount(0);
  const invite = (await pair
    .getByRole("link", { name: t.invite, exact: true })
    .getAttribute("href"))!;
  expect(new URL(invite).origin).toBe(new URL(page.url()).origin);
  const modules = QRCode.create(invite, { errorCorrectionLevel: "H" }).modules
    .size;
  expect(
    await img.evaluate((node: HTMLImageElement, size) => {
      const canvas = document.createElement("canvas");
      canvas.width = node.naturalWidth;
      canvas.height = node.naturalHeight;
      const context = canvas.getContext("2d")!;
      context.drawImage(node, 0, 0);
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      const margin = (4 * canvas.width) / (size + 8);
      for (let y = 0; y < canvas.height; y++)
        for (let x = 0; x < canvas.width; x++) {
          if (
            x >= margin &&
            y >= margin &&
            x < canvas.width - margin &&
            y < canvas.height - margin
          )
            continue;
          const offset = (y * canvas.width + x) * 4;
          if (
            pixels[offset] !== 255 ||
            pixels[offset + 1] !== 255 ||
            pixels[offset + 2] !== 255 ||
            pixels[offset + 3] !== 255
          )
            return false;
        }
      return true;
    }, modules),
  ).toBe(true);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as unknown as { copiedInvitation: string }).copiedInvitation =
            value;
        },
      },
    }),
  );
  await pair.getByRole("button", { name: t.copy, exact: true }).click();
  expect(
    await page.evaluate(
      (url) =>
        (window as unknown as { copiedInvitation: string }).copiedInvitation ===
        url,
      invite,
    ),
  ).toBe(true);

  if (process.platform === "darwin")
    decode((await img.getAttribute("src"))!.split(",")[1], invite);
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [834, 1112],
    [390, 844],
    [375, 667],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(img).toBeInViewport();
    await expect(
      pair.getByRole("button", { name: t.copy, exact: true }),
    ).toBeInViewport();
    if (process.platform === "darwin")
      decode((await img.screenshot()).toString("base64"), invite);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      animations: "disabled",
      path: `docs/screenshots/${capture}-${info.project.name}-qr-${width}x${height}.png`,
    });
  }
  await pair.getByRole("button", { name: t.close, exact: true }).click();
  const context = await browser.newContext({
    locale: "uk-UA",
    viewport: { width: 390, height: 844 },
  });
  const phone = await context.newPage();
  try {
    await phone.goto(invite);
    await expect(phone.locator("html")).toHaveAttribute("lang", "uk");
    await page
      .locator("header")
      .getByRole("button", { name: t.remoteConnection, exact: true })
      .click();
    await expect(pair.getByRole("status")).toHaveText(t.pairApproval);
    await expect(pair).toBeVisible();
    await pair.getByRole("button", { name: t.allow, exact: true }).click();
    await expect(phone.locator(".remote-connection")).toHaveText(
      dictionaries.uk.connected,
    );
    await expect(pair).not.toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    const connection = await managePhone(page, t);
    await connection
      .getByRole("checkbox", { name: t.allowPreview, exact: true })
      .check();
    await connection
      .getByRole("button", { name: t.close, exact: true })
      .click();
    await expect(phone.locator(".remote-text")).toContainText(
      "Untranslated script.",
    );
    await expect(phone.locator(".language-control")).toHaveCount(1);
    await phone.screenshot({
      path: `docs/screenshots/${capture}-${info.project.name}-remote.png`,
    });
    await chooseSelect(
      phone.locator(".language-control .picker-trigger"),
      "ru",
    );
    await expect(phone.locator("html")).toHaveAttribute("lang", "ru");
    await expect(phone.locator(".remote-connection")).toHaveText(
      dictionaries.ru.connected,
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await phone
      .getByRole("button", { name: dictionaries.ru.play, exact: true })
      .click();
    await expect(
      page
        .locator(".reader-controls")
        .getByRole("button", { name: t.pause, exact: true }),
    ).toBeVisible();
    const playingURL = page.url();
    const playingHistory = await page.evaluate(() => history.length);
    const viewport = page.locator(".reading-viewport");
    const position = await viewport.evaluate((el) => el.scrollTop);
    const wordmark = (await page.locator("header .wordmark").boundingBox())!;
    await page.mouse.click(
      wordmark.x + wordmark.width / 2,
      wordmark.y + wordmark.height / 2,
    );
    expect(page.url()).toBe(playingURL);
    expect(await page.evaluate(() => history.length)).toBe(playingHistory);
    await expect
      .poll(() => viewport.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(position);
    await phone
      .getByRole("button", { name: dictionaries.ru.pause, exact: true })
      .click();
    await phone
      .getByRole("button", {
        name: dictionaries.ru.advancedSettings,
        exact: true,
      })
      .click();
    await expect(phone.locator(".language-control")).toHaveCount(1);
    await phone.screenshot({
      path: `docs/screenshots/${capture}-${info.project.name}-remote-settings.png`,
    });
    const settings = await managePhone(page, t);
    await settings.getByRole("button", { name: t.revoke, exact: true }).click();
    await expect(phone.locator(".remote-connection")).toHaveText(
      dictionaries.ru.disconnected,
    );
    await phone.reload();
    await expect(phone.locator("html")).toHaveAttribute("lang", "ru");
    await expect(phone.locator(".language-control .picker-trigger")).toHaveText(
      "RU",
    );
  } finally {
    await context.close();
  }
});
test("QR expiry and server error expose compact recovery", async ({
  page,
  browser,
}) => {
  await language(page, ["en-US"]);
  await page.goto("/studio");
  await page
    .getByRole("button", { name: t.newScript, exact: true })
    .first()
    .click();
  const trigger = page
    .locator("header")
    .getByRole("button", { name: t.remoteConnection, exact: true });
  await page.clock.install();
  await trigger.click();
  const pair = page.locator(".pairing-sheet");
  await expect(pair.locator("img")).toBeVisible();
  const pendingContext = await browser.newContext({ locale: "en-US" });
  const pendingPhone = await pendingContext.newPage();
  await pendingPhone.goto(
    (await pair
      .getByRole("link", { name: t.invite, exact: true })
      .getAttribute("href"))!,
  );
  await expect(pair.getByRole("status")).toHaveText(t.pairApproval);
  await page.clock.fastForward(120001);
  await expect(pair.getByRole("status")).toHaveText(t.expired);
  await expect(pair.locator("img,a")).toHaveCount(0);
  await expect(
    pair.getByRole("button", { name: t.allow, exact: true }),
  ).toHaveCount(0);
  await pendingContext.close();
  await pair.getByRole("button", { name: t.reconnect, exact: true }).click();
  await expect(pair.locator("img")).toBeVisible();
  await pair.getByRole("button", { name: t.close, exact: true }).click();
  await page.reload();
  await page.route("**/api/rooms", (route) => route.abort());
  await trigger.click();
  await expect(pair.getByRole("status")).toHaveText(t.serverUnreachable);
  await expect(pair.locator("img,a")).toHaveCount(0);
  await page.unroute("**/api/rooms");
  await pair.getByRole("button", { name: t.reconnect, exact: true }).click();
  await expect(pair.locator("img")).toBeVisible();
});

// Legacy scenarios start with their intended empty workspace; onboarding has its own fresh-install suite.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("teleo.demo.auto"))
      localStorage.setItem("teleo.demo.auto", "false");
  });
});
