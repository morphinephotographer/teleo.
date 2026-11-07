import { test, expect, chromium, webkit, type Page } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
async function ready(page: Page, locale: string) {
  await page.addInitScript((lang) => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
    localStorage.setItem("teleo.tour.v140", "done");
    localStorage.setItem("teleo.demo.auto", "false");
    localStorage.setItem("teleo.locale", lang);
  }, locale);
}
for (const locale of ["en", "uk", "ru"] as const)
  test(`${locale}: Safari remote to Windows Chrome profile explains disabled Send and delivers valid text`, async ({
    baseURL,
  }, info) => {
    const t = dictionaries[locale];
    const chrome = await chromium.launch(),
      safari = await webkit.launch();
    const hostContext = await chrome.newContext({
      baseURL,
      viewport: { width: 1440, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
      extraHTTPHeaders: process.env.TELEO_QUICK_SEND_URL
        ? {}
        : { "CF-Connecting-IP": crypto.randomUUID() },
    });
    const phoneContext = await safari.newContext({
      baseURL,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    try {
      const host = await hostContext.newPage(),
        phone = await phoneContext.newPage();
      await ready(host, locale);
      await ready(phone, locale);
      await phone.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: { readText: async () => "a".repeat(8001) },
        });
      });
      await host.goto("/studio");
      await host
        .getByRole("button", { name: t.newScript, exact: true })
        .first()
        .click();
      await host
        .getByRole("textbox", { name: t.body, exact: true })
        .fill("Keep this existing script.");
      await host
        .locator("header")
        .getByRole("button", { name: t.remoteConnection, exact: true })
        .click();
      const pairing = host.getByRole("dialog", {
        name: t.remoteConnection,
        exact: true,
      });
      const invitation = await pairing
        .getByRole("link", { name: t.invite, exact: true })
        .getAttribute("href");
      await phone.goto(invitation!);
      await pairing.getByRole("button", { name: t.allow, exact: true }).click();
      await expect(
        phone.getByRole("button", { name: t.play, exact: true }),
      ).toBeEnabled();
      await phone
        .getByRole("button", { name: t.quickSendTitle, exact: true })
        .click();
      const sheet = phone.locator(".quick-send-sheet"),
        input = sheet.getByRole("textbox"),
        submit = sheet.getByRole("button", {
          name: t.quickSendSubmit,
          exact: true,
        });
      const editor = sheet.locator(".quick-send-editor");
      const count = editor.locator("#quick-send-count");
      await expect(count).toBeVisible();
      const field = (await editor.boundingBox())!;
      const counter = (await count.boundingBox())!;
      expect(counter.y + counter.height).toBeLessThan(field.y + field.height);
      await expect(submit).toBeDisabled();
      await expect(sheet.locator("#quick-send-reason")).toHaveText(
        t.quickSendEmpty,
      );
      await sheet
        .getByRole("button", { name: t.quickSendPaste, exact: true })
        .click();
      await expect(input).toHaveValue("a".repeat(8001));
      await expect(submit).toBeDisabled();
      await expect(input).toHaveAttribute("aria-invalid", "true");
      await expect(sheet.locator("#quick-send-reason")).toContainText(
        t.quickSendTooLong.split("{limit}")[0],
      );
      await phone.screenshot({ path: info.outputPath("too-long.png") });
      const body = "Phone to computer 👋\n\nParagraph two.\nEnd.";
      await input.fill(body);
      await expect(submit).toBeEnabled();
      await expect(input).not.toHaveAttribute("aria-invalid");
      await submit.click();
      await expect(sheet.getByRole("status")).toHaveText(t.quickSendDelivered);
      await expect(
        host.getByRole("textbox", { name: t.body, exact: true }),
      ).toHaveValue("Keep this existing script.");
      await host
        .getByRole("button", { name: t.quickSendReview, exact: true })
        .click();
      await expect(host.locator(".quick-send-review pre")).toHaveText(body);
      await host
        .getByRole("button", { name: t.quickSendReplace, exact: true })
        .click();
      await expect(
        host.getByRole("textbox", { name: t.body, exact: true }),
      ).toHaveValue(body);
    } finally {
      await hostContext.close();
      await phoneContext.close();
      await chrome.close();
      await safari.close();
    }
  });
test("disconnected remote explains pairing requirement even with text", async ({
  page,
}) => {
  await ready(page, "en");
  await page.goto("/remote");
  await page
    .getByRole("button", { name: dictionaries.en.quickSendTitle, exact: true })
    .click();
  const sheet = page.locator(".quick-send-sheet");
  await sheet.getByRole("textbox").fill("A valid short script");
  await expect(
    sheet.getByRole("button", {
      name: dictionaries.en.quickSendSubmit,
      exact: true,
    }),
  ).toBeDisabled();
  await expect(sheet.locator("#quick-send-reason")).toHaveText(
    dictionaries.en.quickSendPairRequired,
  );
});

test("denied clipboard access explains manual paste and focuses the editor", async ({
  page,
}) => {
  await ready(page, "en");
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: async () => {
          throw Error("denied");
        },
      },
    });
  });
  await page.goto("/remote");
  await page
    .getByRole("button", { name: dictionaries.en.quickSendTitle, exact: true })
    .click();
  const sheet = page.locator(".quick-send-sheet");
  await sheet
    .getByRole("button", { name: dictionaries.en.quickSendPaste, exact: true })
    .click();
  await expect(sheet.getByRole("alert")).toHaveText(
    dictionaries.en.quickSendClipboard,
  );
  await expect(sheet.getByRole("textbox")).toBeFocused();
});
