import { test, expect } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
import { chooseSelect } from "./helpers";
const production = process.env.TELEO_PRODUCTION_URL;
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("teleo.intro.seen.v1", "true"),
  );
});
test("production routes, security headers, Origin and release identity", async ({
  request,
  baseURL,
}) => {
  for (const route of [
    "/",
    "/studio",
    "/remote",
    "/help",
    "/privacy",
    "/sw.js",
  ]) {
    const r = await request.get(route);
    expect(r.status()).toBe(200);
    expect(r.headers()["x-robots-tag"]).toBeUndefined();
    expect(r.headers()["content-security-policy"]).toContain(
      "connect-src 'self';",
    );
    expect(r.headers()["content-security-policy"]).not.toMatch(
      /localhost|127\.0\.0\.1|api\.teleo/,
    );
    expect(r.headers()["referrer-policy"]).toBe("no-referrer");
    if (production) {
      expect(r.headers()["x-teleo-commit"]).toBe(
        process.env.TELEO_EXPECTED_COMMIT,
      );
      expect(r.headers()["x-teleo-deployment"]).toMatch(/^[a-f0-9-]{36}$/);
    }
  }
  const invalid = await request.post("/api/rooms", {
    headers: { Origin: "https://evil.example", "X-Forwarded-Host": "teleo.cc" },
  });
  expect(invalid.status()).toBe(403);
  expect(
    (
      await request.get("/api/unknown", { headers: { Origin: baseURL! } })
    ).status(),
  ).toBe(404);
  const allowed = await request.fetch("/api/rooms", {
    method: "OPTIONS",
    headers: { Origin: baseURL! },
  });
  expect(allowed.status()).toBe(204);
  expect(allowed.headers()["access-control-allow-origin"]).toBe(baseURL);
  if (production) {
    const redirect = await request.get("https://www.teleo.cc/studio?lang=ru", {
      maxRedirects: 0,
    });
    expect(redirect.status()).toBe(308);
    expect(redirect.headers().location).toBe("https://teleo.cc/studio?lang=ru");
  }
});
for (const locale of ["en", "uk", "ru"] as const) {
  test(`${locale}: production editor persistence, layout and live playback`, async ({
    page,
  }, info) => {
    const t = dictionaries[locale];
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const route of ["/", "/studio", "/remote", "/help", "/privacy"]) {
      await page.goto(`${route}?lang=${locale}`);
      await expect(page.locator("header")).toBeVisible();
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
    }
    await page.goto(`/studio?lang=${locale}`);
    await page
      .getByRole("button", { name: t.newScript, exact: true })
      .first()
      .click();
    const text =
      "Your words. Your pace. A production verification paragraph.\n\n".repeat(
        80,
      );
    await page
      .getByRole("textbox", { name: t.title, exact: true })
      .fill("Production QA");
    await page.getByRole("textbox", { name: t.body, exact: true }).fill(text);
    await page.getByRole("textbox", { name: t.body, exact: true }).blur();
    await expect(
      page.getByRole("status").filter({ hasText: t.saved }),
    ).toBeVisible();
    await chooseSelect(
      page
        .locator("header")
        .getByRole("combobox", { name: t.language, exact: true }),
      "en",
    );
    await chooseSelect(
      page
        .locator("header")
        .getByRole("combobox", { name: dictionaries.en.language, exact: true }),
      locale,
    );
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(
      page.getByRole("textbox", { name: t.body, exact: true }),
    ).toHaveValue(text);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/screenshots/production-${info.project.name}-${locale}-studio.png`,
      animations: "disabled",
    });
    await page.getByRole("button", { name: t.read, exact: true }).click();
    const dock = page.locator(".reader-controls");
    await dock.getByRole("button", { name: t.play, exact: true }).click();
    await expect
      .poll(() =>
        page.locator(".reading-viewport").evaluate((el) => el.scrollTop),
      )
      .toBeGreaterThan(0);
    await dock.getByRole("button", { name: t.pause, exact: true }).click();
    await dock
      .getByRole("slider", { name: t.fontSize, exact: true })
      .fill("52");
    await dock
      .getByRole("slider", { name: t.lineHeight, exact: true })
      .fill("1.5");
    await dock
      .getByRole("slider", { name: t.textWidth, exact: true })
      .fill("900");
    await dock.getByRole("button", { name: t.alignRight, exact: true }).click();
    await expect(page.locator(".reader article")).toHaveCSS(
      "font-size",
      "52px",
    );
    await expect(page.locator(".reader article")).toHaveCSS(
      "text-align",
      "right",
    );
    await dock
      .getByRole("button", { name: t.mirrorHorizontal, exact: true })
      .click();
    await expect(page.locator(".reader article")).toHaveCSS(
      "transform",
      "matrix(-1, 0, 0, 1, 0, 0)",
    );
    await page.screenshot({
      path: `docs/screenshots/production-${info.project.name}-${locale}-reader.png`,
      animations: "disabled",
    });
    expect(errors).toEqual([]);
  });
}
