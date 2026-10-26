import { test, expect } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
const staging = process.env.TELEO_STAGING_URL || "http://127.0.0.1:8788";
test.beforeEach(async ({ page }) => {
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
    headers: { Origin: staging, "CF-Connecting-IP": crypto.randomUUID() },
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
    const context = await browser.newContext({ locale });
    const phone = await context.newPage();
    await phone.goto(invite);
    await page.getByRole("button", { name: t.allow, exact: true }).click();
    await expect(phone.locator("p[role=status]")).toHaveText(t.connected);
    await phone.getByRole("button", { name: t.play, exact: true }).click();
    await expect(phone.locator("output")).toContainText(t.play);
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
    await context.close();
  });
}
