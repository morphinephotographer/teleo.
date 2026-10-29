import { test, expect } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
import { openSettings } from "./helpers";

for (const locale of ["en", "uk", "ru"] as const) {
  test(`${locale}: QR preview preference, privacy revocation, persistence and live controls`, async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(60000);
    const t = dictionaries[locale],
      secret = "Private opening words. ",
      revised = "New private revision. ";
    await page.addInitScript((value) => {
      sessionStorage.setItem("teleo.intro.seen.v1", "true");
      localStorage.setItem("teleo.demo.auto", "false");
      localStorage.setItem("teleo.locale", value);
    }, locale);
    const local =
      !process.env.TELEO_R400_URL ||
      new URL(process.env.TELEO_R400_URL).hostname === "127.0.0.1";
    if (local)
      await page.setExtraHTTPHeaders({
        "CF-Connecting-IP": crypto.randomUUID(),
      });
    const contentSent: string[] = [],
      previewReceived: string[] = [],
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("websocket", (ws) =>
      ws.on("framesent", (frame) => {
        const text = String(frame.payload);
        if (/"type":"preview(Content|Position)"/.test(text))
          contentSent.push(text);
      }),
    );
    let rooms = 0;
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith("/api/rooms")) rooms++;
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/studio");
    await page
      .getByRole("button", { name: t.newScript, exact: true })
      .first()
      .click();
    await page
      .getByRole("textbox", { name: t.body, exact: true })
      .fill((secret + "Your pace.\n\n").repeat(80));
    const settings = await openSettings(page, t);
    await expect(
      settings.getByRole("checkbox", { name: t.allowPreview, exact: true }),
    ).toHaveCount(0);
    await page
      .locator("header")
      .getByRole("button", { name: t.remoteConnection, exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: t.remoteConnection,
      exact: true,
    });
    const consent = dialog.getByRole("checkbox", {
      name: t.allowPreview,
      exact: true,
    });
    await expect(consent).not.toBeChecked();
    const invitation = await dialog
      .getByRole("link", { name: t.invite, exact: true })
      .getAttribute("href");
    for (const [width, height] of [
      [1440, 900],
      [834, 1112],
      [390, 844],
      [375, 667],
    ]) {
      await page.setViewportSize({ width, height });
      const qr = dialog.locator(".qr-surface img");
      await expect(qr).toBeVisible();
      await expect(consent).toBeVisible();
      await expect
        .poll(() =>
          dialog.evaluate((el) => {
            const q = el
              .querySelector(".qr-surface img")!
              .getBoundingClientRect();
            const c = el
              .querySelector(".preview-consent input")!
              .getBoundingClientRect();
            return q.bottom < c.top && q.top >= 0 && c.bottom <= innerHeight;
          }),
        )
        .toBe(true);
      await page.screenshot({
        path: `docs/screenshots/context-${info.project.name}-${locale}-qr-${width}x${height}.png`,
      });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
      locale,
    });
    const phone = await context.newPage();
    phone.on("pageerror", (e) => errors.push(e.message));
    phone.on("websocket", (ws) =>
      ws.on("framereceived", (frame) => {
        const text = String(frame.payload);
        if (/"type":"preview(Content|Position)"/.test(text))
          previewReceived.push(text);
      }),
    );
    try {
      await phone.goto(invitation!);
      await consent.check(); // saved choice is permitted before authorization, content is not
      expect(contentSent).toEqual([]);
      expect(previewReceived).toEqual([]);
      await dialog.getByRole("button", { name: t.allow, exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await expect(phone.locator(".remote-text")).toContainText(secret.trim());
      expect(contentSent.length).toBeGreaterThan(0);
      await page
        .locator("header")
        .getByRole("button", { name: t.remoteConnection, exact: true })
        .click();
      expect(rooms).toBe(1);
      await expect(dialog.locator(".qr-surface")).toHaveCount(0);
      await expect(consent).toBeChecked();
      await expect(consent).toBeEnabled();
      await consent.uncheck();
      await expect(
        phone.getByRole("heading", { name: t.previewPrivate, exact: true }),
      ).toBeVisible();
      expect(await phone.locator("body").innerText()).not.toContain(
        secret.trim(),
      );
      await expect(consent).toBeEnabled();
      const revokedSent = contentSent.length,
        revokedReceived = previewReceived.length;
      await dialog.getByRole("button", { name: t.close, exact: true }).click();
      await page
        .getByRole("textbox", { name: t.body, exact: true })
        .fill((revised + "Your pace.\n\n").repeat(80));
      await page.waitForTimeout(700);
      expect(contentSent.length).toBe(revokedSent);
      expect(previewReceived.length).toBe(revokedReceived);
      await phone.getByRole("button", { name: t.play, exact: true }).click();
      await expect(
        page
          .locator(".reader-top")
          .getByRole("button", { name: t.pause, exact: true }),
      ).toBeVisible();
      await phone.getByRole("button", { name: t.pause, exact: true }).click();
      await phone.getByRole("button", { name: t.speedUp, exact: true }).click();
      await expect(phone.locator(".remote-speed")).toHaveText("1.1×");
      await phone
        .getByRole("button", { name: t.nextParagraph, exact: true })
        .click();
      await expect
        .poll(async () =>
          Number(
            await phone
              .getByRole("slider", { name: t.position, exact: true })
              .inputValue(),
          ),
        )
        .toBeGreaterThan(0);
      expect(contentSent.length).toBe(revokedSent);
      await phone.screenshot({
        path: `docs/screenshots/context-${info.project.name}-${locale}-revoked.png`,
      });
      await page
        .locator("header")
        .getByRole("button", { name: t.remoteConnection, exact: true })
        .click();
      await consent.check();
      await expect(phone.locator(".remote-text")).toContainText(revised.trim());
      expect(rooms).toBe(1);
      await page.reload();
      await page
        .locator("header")
        .getByRole("button", { name: t.remoteConnection, exact: true })
        .click();
      await expect(consent).toBeChecked();
      await consent.uncheck();
      await page.reload();
      await page
        .locator("header")
        .getByRole("button", { name: t.remoteConnection, exact: true })
        .click();
      await expect(consent).not.toBeChecked();
      expect(
        await phone.evaluate(() => JSON.stringify(localStorage)),
      ).not.toContain(revised.trim());
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
