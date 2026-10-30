import { test, expect } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";

for (const locale of ["en", "ru", "uk"] as const) {
  test(`${locale}: white glossy is the static install default and Settings has no install control`, async ({
    page,
    browserName,
  }) => {
    await page.addInitScript((locale) => {
      sessionStorage.setItem("teleo.intro.seen.v1", "true");
      localStorage.setItem("teleo.demo.auto", "false");
      localStorage.setItem("teleo.locale", locale);
      localStorage.setItem("teleo.macIcon", "black_matte");
    }, locale);
    await page.goto("/studio");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    const html = await page.evaluate(async () =>
      (await fetch("/studio")).text(),
    );
    expect(html).toContain('href="/manifest.webmanifest"');
    expect(html).toContain('href="/mac-icons/teleo_white_glossy-1024.png"');
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute("href", "/manifest.webmanifest");
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      "href",
      "/mac-icons/teleo_white_glossy-1024.png",
    );
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
      "href",
      "/mac-icons/teleo_white_glossy-32.png",
    );
    const metadata = await page.evaluate(async () => {
      const link = document.querySelector<HTMLLinkElement>(
        'link[rel="manifest"]',
      )!;
      const response = await fetch(link.href);
      return { status: response.status, manifest: await response.json() };
    });
    expect(metadata.status).toBe(200);
    expect(metadata.manifest).toMatchObject({
      id: "/studio",
      start_url: "/studio",
      scope: "/",
      display: "standalone",
    });
    for (const icon of metadata.manifest.icons) {
      expect(icon.src).toMatch(/^\/mac-icons\/teleo_white_glossy-\d+\.png$/);
      const dimensions = await page.evaluate(async (src: string) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        return `${image.naturalWidth}x${image.naturalHeight}`;
      }, icon.src);
      expect(dimensions).toBe(icon.sizes);
    }
    for (const [width, height] of [
      [1440, 900],
      [375, 667],
      [320, 568],
      [844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      const trigger = page.locator(
        ".app-shell > header > .top-settings > button",
      );
      await trigger.click();
      const settings = page.locator(".top-settings > [popover]:popover-open");
      for (const surface of [settings, settings.locator(".settings")])
        expect(
          await surface.evaluate(
            (el) => el.scrollHeight <= el.clientHeight + 1,
          ),
        ).toBe(true);
      await expect(
        settings.getByRole("button", { name: /Install|Установить|Встановити/ }),
      ).toHaveCount(0);
      await expect(settings.locator(".mac-install-entry")).toHaveCount(0);
      await settings
        .getByRole("button", {
          name: dictionaries[locale].interfaceTheme,
          exact: true,
        })
        .click();
      await expect(manifestLink).toHaveAttribute(
        "href",
        "/manifest.webmanifest",
      );
      await page.keyboard.press("Escape");
    }
    if (browserName === "chromium") {
      const cdp = await page.context().newCDPSession(page);
      const browserManifest = await cdp.send("Page.getAppManifest");
      expect(browserManifest.errors).toEqual([]);
      expect(JSON.parse(browserManifest.data!)).toEqual(metadata.manifest);
      await cdp.detach();
    }
    await page.reload();
    await expect(manifestLink).toHaveAttribute("href", "/manifest.webmanifest");
    expect(
      await page.evaluate(() => localStorage.getItem("teleo.macIcon")),
    ).toBe("black_matte");
    await expect(page.locator(".mac-install-sheet")).toHaveCount(0);
  });
}
