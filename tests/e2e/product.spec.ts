import { prepareReader } from "./helpers";
import { openSettings, closeSettings, managePhone } from "./helpers";
import { chooseSelect } from "./helpers";
import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
  });
});
import { dictionaries } from "../../apps/web/src/i18n";
// Each test is an independent local client. Cloudflare replaces this header in production.
test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "CF-Connecting-IP": crypto.randomUUID() });
});
for (const locale of ["en", "uk", "ru"] as const) {
  const t = dictionaries[locale];
  test(`${locale}: all routes, mobile overflow and metadata`, async ({
    page,
  }, info) => {
    for (const route of ["/", "/studio", "/remote", "/help", "/privacy"]) {
      await page.goto(`${route}?lang=${locale}`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("header")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `docs/screenshots/${info.project.name}-${locale}-${route.slice(1) || "home"}.png`,
        fullPage: true,
      });
    }
  });
  test(`${locale}: editor persists, language switch preserves text, remote safety`, async ({
    page,
  }) => {
    await page.goto(`/studio?lang=${locale}`);
    await page
      .getByRole("button", { name: t.newScript, exact: true })
      .first()
      .click();
    const body = "Привіт 🌍\n\nمرحبا\n" + "A paragraph of text. ".repeat(150);
    await page
      .getByRole("textbox", { name: t.title, exact: true })
      .fill("Unicode title");
    await page.getByRole("textbox", { name: t.body, exact: true }).fill(body);
    await page.keyboard.press("Space");
    await page.screenshot({
      path: `docs/screenshots/${test.info().project.name}-${locale}-editor.png`,
      fullPage: true,
    });
    await expect(
      page.getByRole("textbox", { name: t.body, exact: true }),
    ).toHaveValue(body + " ");
    await chooseSelect(
      page.getByRole("combobox", { name: t.language, exact: true }),
      "en",
    );
    await expect(
      page.getByRole("textbox", { name: "Your words", exact: true }),
    ).toHaveValue(body + " ");
    await page.getByRole("textbox", { name: "Your words", exact: true }).blur();
    await expect(
      page.getByRole("status").filter({ hasText: "Saved on this device" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: "Your words", exact: true }),
    ).toHaveValue(body + " ");
    await page.getByRole("button", { name: "Read", exact: true }).click();
    await prepareReader(page, dictionaries.en);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Pause", exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(200);
    const before = await page
      .getByRole("slider", { name: "Reading position" })
      .inputValue();
    expect(Number(before)).toBeGreaterThan(0);
    await chooseSelect(
      page.locator("header").getByRole("combobox", { name: "Language" }),
      "ru",
    );
    await expect(
      page
        .locator(".reader")
        .getByRole("button", { name: "Пауза", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Выйти из чтения" }).click();
  });
}
test("first visit regional detection and manual override", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "uk-UA" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "uk");
  await chooseSelect(page.getByRole("combobox", { name: "Мова" }), "ru");
  await page.goto("/help");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await context.close();
});
test("storage-disabled language remains usable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw Error("disabled");
      },
    });
  });
  await page.goto("/");
  await chooseSelect(page.getByRole("combobox", { name: "Language" }), "uk");
  await expect(page.locator("html")).toHaveAttribute("lang", "uk");
});
for (const locale of ["en", "uk", "ru"] as const) {
  const t = dictionaries[locale];
  test(`${locale}: real relay, independent phone, approval, ACK and revoke`, async ({
    page,
    browser,
  }) => {
    await page.goto(`/studio?lang=${locale}`);
    await page
      .getByRole("button", { name: t.newScript, exact: true })
      .first()
      .click();
    await page
      .getByRole("textbox", { name: t.body, exact: true })
      .fill("Paragraph\n\n".repeat(100));
    await page.getByRole("button", { name: t.read, exact: true }).click();
    await prepareReader(page, t);
    await page
      .locator(".reader")
      .getByRole("button", { name: t.connect })
      .click();
    const invite = page.getByRole("link", { name: t.invite });
    await expect(invite).toBeVisible();
    const url = (await invite.getAttribute("href"))!;
    expect(new URL(url).search).not.toContain("pair");
    const ctx = await browser.newContext({ locale });
    const phone = await ctx.newPage();
    await phone.goto(url + "");
    await expect(page.getByText(t.pairApproval)).toBeVisible();
    await page.getByRole("button", { name: t.allow, exact: true }).click();
    await expect(phone.locator(".remote-connection")).toHaveText(t.connected);
    await phone.getByRole("button", { name: t.play, exact: true }).click();
    await expect(
      page
        .locator(".reader")
        .getByRole("button", { name: t.pause, exact: true }),
    ).toBeVisible();
    await expect(
      phone.getByRole("button", { name: t.pause, exact: true }),
    ).toBeVisible();
    await managePhone(page, t);
    await page.getByRole("button", { name: t.revoke, exact: true }).click();
    await expect(phone.locator(".remote-connection")).toContainText(
      t.disconnected,
    );
    await expect(
      page
        .locator(".reader")
        .getByRole("button", { name: t.pause, exact: true }),
    ).toBeVisible();
    await ctx.close();
  });
}
test("library CRUD, import/export and version restore", async ({ page }) => {
  await page.goto("/studio?lang=en");
  await page
    .getByRole("button", { name: "New script", exact: true })
    .first()
    .click();
  await page.getByRole("textbox", { name: "Script title" }).fill("First");
  await page
    .getByRole("textbox", { name: "Your words", exact: true })
    .fill("Original\n\n🌍");
  await page.getByRole("textbox", { name: "Your words", exact: true }).blur();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved on this device" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Your words", exact: true })
    .fill("Changed");
  await page.getByRole("button", { name: "Version history" }).click();
  await expect(page.locator(".revision")).not.toHaveCount(0);
  await page
    .locator(".revision")
    .first()
    .getByRole("button", { name: "Restore" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Your words", exact: true }),
  ).toHaveValue("Original\n\n🌍");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export .txt", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("First.txt");
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page.locator(".script-list button")).toHaveCount(2);
  await page.getByRole("button", { name: "Move to trash" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(page.locator(".script-list button")).toHaveCount(1);
  await page.locator("input[type=file]").setInputFiles({
    name: "Unicode.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Імпорт\n\nمرحبا 🌍\n"),
  });
  await expect(
    page.getByRole("textbox", { name: "Your words", exact: true }),
  ).toHaveValue("Імпорт\n\nمرحبا 🌍\n");
  await page.reload();
  await expect(page.locator(".script-list button")).toHaveCount(2);
});
test("physical remote two-button learning, conflict and reader dispatch", async ({
  page,
}) => {
  await page.goto("/studio?lang=en");
  await page
    .getByRole("button", { name: "New script", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Your words", exact: true })
    .fill("Text\n\n".repeat(100));
  await openSettings(page, dictionaries.en);
  await page.getByText("Physical remote", { exact: true }).click();
  await chooseSelect(
    page.getByRole("combobox", { name: "Profile", exact: true }),
    "twoButton",
  );
  await page.getByRole("button", { name: "Learn button A" }).click();
  await page.keyboard.press("a");
  await expect(page.getByText("KeyA → Play / Pause")).toBeVisible();
  await page.getByRole("button", { name: "Learn button B" }).click();
  await page.keyboard.press("a");
  await expect(page.getByRole("alert")).toContainText(
    "This key already has an action",
  );
  await page.keyboard.press("b");
  await closeSettings(page, dictionaries.en);
  await page.getByRole("button", { name: "Read", exact: true }).click();
  await page.keyboard.press("a");
  await expect(
    page.locator(".reader").getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("b");
  await expect(page.locator(".reader-controls .speed-group output")).toHaveText(
    "1.25×", // Button B cycles the preserved preset list; it is not a speed step.
  );
  await page.keyboard.press("a");
  await expect(
    page.locator(".reader").getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
});

// Explicit fixture preference for legacy translated scenarios; v07.spec tests fresh autodetection.
test.beforeEach(async ({ page }, info) => {
  const locale = /^(en|uk|ru):/.exec(info.title)?.[1];
  if (locale)
    await page.addInitScript((value) => {
      if (!localStorage.getItem("teleo.locale"))
        localStorage.setItem("teleo.locale", value);
    }, locale);
});

// Legacy scenarios start with their intended empty workspace; onboarding has its own fresh-install suite.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("teleo.demo.auto"))
      localStorage.setItem("teleo.demo.auto", "false");
  });
});
