import { test, expect } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
declare global {
  interface Window {
    quickSendDropAck?: boolean;
    quickSendFailSave?: boolean;
  }
}
for (const locale of ["en", "uk", "ru"] as const) {
  test(`${locale}: send, review, library, import and mobile sheets`, async ({
    page,
    browser,
  }, info) => {
    const t = dictionaries[locale];
    const original = "Original active script\n\nKeep this text.\n\n".repeat(80);
    await page.addInitScript((lang) => {
      sessionStorage.setItem("teleo.intro.seen.v1", "true");
      localStorage.setItem("teleo.demo.auto", "false");
      localStorage.setItem("teleo.locale", lang);
      const send = WebSocket.prototype.send;
      WebSocket.prototype.send = function (data) {
        if (
          window.quickSendDropAck &&
          typeof data === "string" &&
          JSON.parse(data).type === "quickSendAck"
        )
          return;
        send.call(this, data);
      };
      const add = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function (value, key) {
        if (window.quickSendFailSave) throw Error("Simulated write failure");
        return add.call(this, value, key);
      };
    }, locale);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.setExtraHTTPHeaders({ "CF-Connecting-IP": crypto.randomUUID() });
    await page.goto("/studio");
    await page
      .getByRole("button", { name: t.newScript, exact: true })
      .first()
      .click();
    const active = page.locator("textarea").first();
    await active.fill(original);
    await page
      .locator("header")
      .getByRole("button", { name: t.remoteConnection, exact: true })
      .click();
    const pairing = page.getByRole("dialog", {
      name: t.remoteConnection,
      exact: true,
    });
    const invitation = await pairing
      .getByRole("link", { name: t.invite, exact: true })
      .getAttribute("href");
    await pairing
      .getByRole("checkbox", { name: t.allowPreview, exact: true })
      .check();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      locale,
    });
    await context.addInitScript((lang) => {
      localStorage.setItem("teleo.locale", lang);
      sessionStorage.setItem("teleo.intro.seen.v1", "true");
      Object.defineProperty(navigator, "clipboard", {
        value: {
          readText: async () => {
            throw Error("denied");
          },
        },
      });
    }, locale);
    const phone = await context.newPage();
    const errors: string[] = [];
    phone.on("pageerror", (e) => errors.push(e.message));
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await phone.goto(invitation!);
      await pairing.getByRole("button", { name: t.allow, exact: true }).click();
      await expect(phone.locator(".remote-text")).toContainText(
        "Original active script",
      );
      const actions = phone.locator(".remote-bottom-actions button");
      expect(await actions.count()).toBe(2);
      const widths = await actions.evaluateAll((buttons) =>
        buttons.map((b) => b.getBoundingClientRect().width),
      );
      expect(widths[0]).toBeCloseTo(widths[1], 0);
      await phone.screenshot({
        path: `test-results/quick-send/${info.project.name}-${locale}-closed.png`,
      });
      await phone
        .getByRole("button", { name: t.quickSettings, exact: true })
        .click();
      await expect(phone.locator("#remote-quick")).toBeVisible();
      const closeStyle = await phone
        .locator("#remote-quick .icon-button")
        .evaluate((el) => {
          const style = getComputedStyle(el);
          return { border: style.borderTopWidth, radius: style.borderRadius };
        });
      expect(closeStyle).toEqual({ border: "0px", radius: "50%" });
      await phone
        .locator("#remote-quick")
        .getByRole("button", { name: t.close, exact: true })
        .click();
      await phone.getByRole("button", { name: t.play, exact: true }).click();
      await expect(
        page.getByRole("button", { name: t.pause, exact: true }).first(),
      ).toBeVisible();
      // Playback must advance on local animation frames, not just host packets.
      const movingFrames = await phone.locator(".remote-text").evaluate(
        (el) =>
          new Promise<number>((resolve) => {
            const start = performance.now();
            let previous = el.scrollTop,
              changes = 0;
            const frame = (now: number) => {
              if (el.scrollTop > previous) changes++;
              previous = el.scrollTop;
              if (now - start < 1600) requestAnimationFrame(frame);
              else resolve(changes);
            };
            requestAnimationFrame(frame);
          }),
      );
      expect(movingFrames).toBeGreaterThan(15);
      await phone
        .getByRole("button", { name: t.quickSendTitle, exact: true })
        .click();
      const sheet = phone.locator(".quick-send-sheet");
      const input = sheet.getByRole("textbox");
      const submit = sheet.getByRole("button", {
        name: t.quickSendSubmit,
        exact: true,
      });
      await expect(submit).toBeDisabled();
      await phone.screenshot({
        path: `test-results/quick-send/${info.project.name}-${locale}-empty.png`,
      });
      await sheet
        .getByRole("button", { name: t.quickSendPaste, exact: true })
        .click();
      await expect(sheet.getByRole("alert")).toHaveText(t.quickSendClipboard);
      await sheet.locator('input[type="file"]').setInputFiles({
        name: "broken.json",
        mimeType: "application/json",
        buffer: Buffer.from("{}"),
      });
      await expect(sheet.getByRole("alert")).toHaveText(t.invalidImport);
      const body = "Привіт 👋\n\nНова історія.\nТретій рядок.";
      await input.fill(body);
      await phone.screenshot({
        path: `test-results/quick-send/${info.project.name}-${locale}-filled.png`,
      });
      // Simulate the reduced visual space above an on-screen keyboard.
      await phone.setViewportSize({ width: 390, height: 440 });
      await submit.scrollIntoViewIfNeeded();
      expect(
        await sheet.evaluate(
          (el) => el.getBoundingClientRect().bottom <= innerHeight + 1,
        ),
      ).toBe(true);
      await phone.setViewportSize({ width: 390, height: 844 });
      await expect(submit).toBeInViewport();
      await submit.click();
      await expect(sheet.getByRole("status")).toHaveText(t.quickSendDelivered);
      await expect(active).toHaveValue(original);
      await phone.screenshot({
        path: `test-results/quick-send/${info.project.name}-${locale}-success.png`,
      });
      await expect(
        page.getByRole("button", { name: t.pause, exact: true }).first(),
      ).toBeVisible();
      await page
        .getByRole("button", { name: t.quickSendReview, exact: true })
        .click();
      await expect(page.locator(".quick-send-review pre")).toHaveText(body);
      await expect(active).toHaveValue(original);
      await page
        .getByRole("button", { name: t.quickSendReplace, exact: true })
        .click();
      await expect(active).toHaveValue(body);
      await sheet
        .getByRole("button", { name: t.quickSendContinue, exact: true })
        .click();
      await phone
        .getByRole("button", { name: t.quickSendTitle, exact: true })
        .click();
      await sheet.locator('input[type="file"]').setInputFiles({
        name: "phone.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("New library script\n\nSeparate 👋"),
      });
      await sheet
        .getByRole("radio", { name: t.quickSendLibrary, exact: false })
        .check();
      await submit.click();
      await expect(sheet.getByRole("status")).toHaveText(t.quickSendSaved);
      await expect(active).toHaveValue("New library script\n\nSeparate 👋");
      await expect(phone.locator(".remote-text")).toContainText(
        "New library script",
      );
      await expect(page.locator(".library")).toContainText(
        "New library script",
      );
      if (locale === "en") {
        await sheet
          .getByRole("button", { name: t.quickSendContinue, exact: true })
          .click();
        await phone
          .getByRole("button", { name: t.quickSendTitle, exact: true })
          .click();
        await input.fill("Retry without duplicates 👋");
        await page.evaluate(() => {
          window.quickSendDropAck = true;
        });
        await submit.click();
        await expect(sheet.getByRole("alert")).toHaveText(
          t.quickSendUncertain,
          { timeout: 15000 },
        );
        await expect(
          sheet.getByRole("heading", { name: t.quickSendSuccess }),
        ).toHaveCount(0);
        await page.evaluate(() => {
          window.quickSendDropAck = false;
        });
        await submit.click();
        await expect(sheet.getByRole("status")).toHaveText(t.quickSendSaved);
        const copies = await page.evaluate(async () => {
          const db = await new Promise<IDBDatabase>((resolve) => {
            const req = indexedDB.open("teleo");
            req.onsuccess = () => resolve(req.result);
          });
          return new Promise<number>((resolve) => {
            const req = db
              .transaction("scripts")
              .objectStore("scripts")
              .getAll();
            req.onsuccess = () => {
              resolve(
                req.result.filter(
                  (s: { body: string }) =>
                    s.body === "Retry without duplicates 👋",
                ).length,
              );
              db.close();
            };
          });
        });
        expect(copies).toBe(1);
        await sheet
          .getByRole("button", { name: t.quickSendContinue, exact: true })
          .click();
        await phone
          .getByRole("button", { name: t.quickSendTitle, exact: true })
          .click();
        await input.fill("Save after failure");
        await page.evaluate(() => {
          window.quickSendFailSave = true;
        });
        await submit.click();
        await expect(sheet.getByRole("alert")).toHaveText(t.quickSendFailed);
        await expect(page.locator(".library")).not.toContainText(
          "Save after failure",
        );
        await page.evaluate(() => {
          window.quickSendFailSave = false;
        });
        await submit.click();
        await expect(sheet.getByRole("status")).toHaveText(t.quickSendSaved);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
