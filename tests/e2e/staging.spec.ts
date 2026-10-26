import { test, expect } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
const staging = process.env.TELEO_STAGING_URL || "http://127.0.0.1:8788";
const local =
  new URL(staging).hostname === "127.0.0.1" ||
  new URL(staging).hostname === "localhost";
test.beforeEach(async ({ page }) => {
  if (local)
    await page.setExtraHTTPHeaders({ "CF-Connecting-IP": crypto.randomUUID() });
});
test("staging serves assets, security headers and strict same-origin API routing", async ({
  request,
}) => {
  for (const path of [
    "/",
    "/studio",
    "/remote",
    "/help",
    "/privacy",
    "/sw.js",
  ]) {
    const response = await request.get(staging + path);
    expect(response.status()).toBe(200);
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
    expect(response.headers()["content-security-policy"]).toContain(
      "connect-src 'self'",
    );
  }
  expect((await request.post(staging + "/api/rooms")).status()).toBe(403);
  expect(
    (
      await request.post(staging + "/api/rooms", {
        headers: {
          Origin: "https://evil.example",
          "X-Forwarded-Host": "evil.example",
        },
      })
    ).status(),
  ).toBe(403);
  const created = await request.post(staging + "/api/rooms", {
    headers: {
      Origin: staging,
      ...(local ? { "CF-Connecting-IP": crypto.randomUUID() } : {}),
    },
  });
  expect(created.status()).toBe(200);
  expect(created.headers()["access-control-allow-origin"]).toBe(staging);
  expect(
    (
      await request.get(staging + "/api/unknown", {
        headers: { Origin: staging },
      })
    ).status(),
  ).toBe(404);
});
for (const locale of ["en", "uk", "ru"] as const) {
  test(`${locale}: production assets and real phone relay share the staging origin`, async ({
    page,
    browser,
  }, info) => {
    const t = dictionaries[locale];
    await page.goto(staging + "/studio?lang=" + locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await page
      .getByRole("button", { name: t.newScript, exact: true })
      .first()
      .click();
    await page
      .getByRole("textbox", { name: t.body, exact: true })
      .fill("Staging QA 🌍\n\n".repeat(100));
    await page.getByRole("button", { name: t.read, exact: true }).click();
    await page
      .locator(".reader")
      .getByRole("button", { name: t.connect })
      .click();
    const link = page.getByRole("link", { name: t.invite });
    await expect(link).toBeVisible();
    const invite = (await link.getAttribute("href"))!;
    expect(new URL(invite).origin).toBe(staging);
    expect(new URL(invite).search).not.toContain("pair");
    const context = await browser.newContext({
      locale,
      viewport: info.project.use.viewport,
    });
    const phone = await context.newPage();
    await phone.addInitScript(() => {
      Object.defineProperty(navigator, "vibrate", {
        value: (duration: number) => {
          document.documentElement.dataset.haptic = String(duration);
          return true;
        },
      });
    });
    await phone.goto(invite);
    await page.getByRole("button", { name: t.allow, exact: true }).click();
    await expect(phone.locator("p[role=status]")).toHaveText(t.connected);
    await phone.getByRole("button", { name: t.play, exact: true }).click();
    await expect(phone.locator("output")).toContainText(t.play);
    await expect(phone.locator("html")).toHaveAttribute("data-haptic", "12");
    for (const size of [
      { width: 320, height: 568 },
      { width: 390, height: 664 },
      { width: 844, height: 390 },
    ]) {
      await phone.setViewportSize(size);
      expect(
        await phone.evaluate(
          () =>
            document.documentElement.scrollHeight <= innerHeight &&
            document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await phone
          .locator(".controller")
          .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
      ).toBe(true);
      await expect(
        phone.getByRole("button", { name: t.revoke, exact: true }),
      ).toBeInViewport();
    }
    await phone.setViewportSize(
      info.project.use.viewport || { width: 1280, height: 720 },
    );
    await phone.getByRole("button", { name: t.pause, exact: true }).click();
    await expect(
      page
        .locator(".reader")
        .getByRole("button", { name: t.play, exact: true }),
    ).toBeVisible();
    await phone.screenshot({
      path: `docs/screenshots/${info.project.name}-${locale}-staging-controller.png`,
      fullPage: true,
    });
    await phone.getByRole("button", { name: t.revoke, exact: true }).click();
    await expect(page.locator(".pair-panel p[role=status]")).toHaveText(
      t.disconnected,
    );
    const panel = page.locator(".pair-panel");
    await expect(
      panel.getByRole("button", { name: t.revoke, exact: true }),
    ).toHaveCount(0);
    await expect(
      panel.getByRole("button", { name: t.reconnect, exact: true }),
    ).toBeVisible();
    if (locale === "ru") {
      await panel.screenshot({
        path: `docs/screenshots/${info.project.name}-reconnect-after-revoke.png`,
      });
      await panel
        .getByRole("button", { name: t.reconnect, exact: true })
        .click();
      const newLink = page.getByRole("link", { name: t.invite });
      await expect(newLink).toBeVisible();
      const nextInvite = (await newLink.getAttribute("href"))!;
      expect(nextInvite).not.toBe(invite);
      await expect(phone.locator("p[role=status]")).toHaveText(t.disconnected);
      // A new invitation must still obtain explicit host approval.
      await phone.goto(nextInvite);
      await expect(
        panel.getByRole("button", { name: t.allow, exact: true }),
      ).toBeVisible();
      await expect(
        phone.getByRole("button", { name: t.play, exact: true }),
      ).toHaveCount(0);
      await panel.getByRole("button", { name: t.allow, exact: true }).click();
      await expect(phone.locator("p[role=status]")).toHaveText(t.connected);
      await phone.getByRole("button", { name: t.pause, exact: true }).click();
      await expect(phone.locator("output")).toContainText(t.pause);
      await panel.getByRole("button", { name: t.revoke, exact: true }).click();
    }
    await context.close();
  });
}

test("empty library stays beside its sidebar at medium window width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 970, height: 900 });
  await page.goto(staging + "/studio?lang=ru");
  const sidebar = await page.locator(".library").boundingBox();
  const empty = await page.locator(".empty").boundingBox();
  expect(sidebar).not.toBeNull();
  expect(empty).not.toBeNull();
  expect(empty!.x).toBeGreaterThanOrEqual(sidebar!.x + sidebar!.width - 1);
  expect(empty!.y).toBeLessThan(sidebar!.y + 20);
  await page.screenshot({
    path: `docs/screenshots/${test.info().project.name}-staging-medium-library.png`,
    fullPage: true,
  });
});
