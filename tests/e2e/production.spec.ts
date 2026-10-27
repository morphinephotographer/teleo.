import https from "node:https";
import dns from "node:dns";
import type { TLSSocket } from "node:tls";
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
  browser,
  baseURL,
  request,
}) => {
  // Exercise the same normal browser network/TLS stack as the app. No DNS overrides.
  const context = await browser.newContext({
    serviceWorkers: "block",
    baseURL,
  });
  const page = await context.newPage();
  try {
    for (const route of [
      "/",
      "/studio",
      "/remote",
      "/help",
      "/privacy",
      "/sw.js",
    ]) {
      const response = (await page.goto(route))!;
      const headers = await response.allHeaders();
      expect(response.status()).toBe(200);
      expect(headers["x-robots-tag"]).toBeUndefined();
      expect(headers["content-security-policy"]).toContain(
        "connect-src 'self';",
      );
      expect(headers["content-security-policy"]).not.toMatch(
        /localhost|127\.0\.0\.1|api\.teleo/,
      );
      expect(headers["referrer-policy"]).toBe("no-referrer");
      if (production) {
        expect(headers["x-teleo-commit"]).toBe(
          process.env.TELEO_EXPECTED_COMMIT,
        );
        expect(headers["x-teleo-deployment"]).toMatch(/^[a-f0-9-]{36}$/);
        if (process.env.TELEO_EXPECTED_VERSION)
          expect(headers["x-teleo-deployment"]).toBe(
            process.env.TELEO_EXPECTED_VERSION,
          );
      }
    }
    // Raw transport is necessary: browsers protect the Origin header from forgery.
    // Use the configured DNS resolver's actual answers, with strict hostname/TLS validation.
    // This neither pins an IP nor changes DNS servers or the OS/browser DNS settings.
    async function probe(
      path: string,
      method: string,
      headers: Record<string, string>,
    ) {
      if (!production) {
        const response = await request.fetch(path, { method, headers });
        return {
          status: response.status(),
          origin: response.headers()["access-control-allow-origin"],
          secure: false,
        };
      }
      return new Promise<{
        status: number;
        origin: string | string[] | undefined;
        secure: boolean;
      }>((resolve, reject) => {
        const req = https.request(
          new URL(path, baseURL),
          {
            method,
            headers,
            rejectUnauthorized: true,
            lookup: (hostname, options, callback) =>
              dns.resolve4(hostname, (error, addresses) => {
                if (error) callback(error, "", 4);
                else
                  callback(
                    null,
                    options.all
                      ? addresses.map((address) => ({ address, family: 4 }))
                      : addresses[0],
                    4,
                  );
              }),
          },
          (response) => {
            const secure = (response.socket as TLSSocket).authorized;
            response.resume();
            response.on("end", () =>
              resolve({
                status: response.statusCode!,
                origin: response.headers["access-control-allow-origin"],
                secure,
              }),
            );
          },
        );
        req.setTimeout(15000, () =>
          req.destroy(new Error("HTTPS probe timeout")),
        );
        req.on("error", reject);
        req.end();
      });
    }
    const invalid = await probe("/api/rooms", "POST", {
      Origin: "https://evil.example",
      "X-Forwarded-Host": "evil.example",
    });
    const unknown = await probe("/api/unknown", "GET", { Origin: baseURL! });
    const allowed = await probe("/api/rooms", "OPTIONS", { Origin: baseURL! });
    expect(invalid.status).toBe(403);
    expect(unknown.status).toBe(404);
    expect(allowed.status).toBe(204);
    expect(allowed.origin).toBe(baseURL);
    if (production)
      expect([invalid.secure, unknown.secure, allowed.secure]).toEqual([
        true,
        true,
        true,
      ]);
    if (production) {
      const final = (await page.goto("https://www.teleo.cc/studio?lang=ru"))!;
      const redirect = await final.request().redirectedFrom()!.response();
      expect(redirect!.status()).toBe(308);
      expect(await redirect!.headerValue("location")).toBe(
        "https://teleo.cc/studio?lang=ru",
      );
      await expect(page).toHaveURL("https://teleo.cc/studio?lang=ru");
    }
  } finally {
    await context.close();
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

// Explicit fixture preference for legacy translated scenarios; v07.spec tests fresh autodetection.
test.beforeEach(async ({ page }, info) => {
  const locale = /^(en|uk|ru):/.exec(info.title)?.[1];
  if (locale)
    await page.addInitScript((value) => {
      if (!localStorage.getItem("teleo.locale"))
        localStorage.setItem("teleo.locale", value);
    }, locale);
});
