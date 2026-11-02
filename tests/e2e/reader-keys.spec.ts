import { test, expect, type Page } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
const t = dictionaries.en;

const text = Array.from(
  { length: 20 },
  (_, i) =>
    `Paragraph ${i + 1}. Your words, your pace. A calm, clear voice carries the story forward and every word stays in view.`,
).join("\n\n");

const errorsByPage = new WeakMap<Page, string[]>();
test.afterEach(async ({ page }) => {
  expect(errorsByPage.get(page)).toEqual([]);
});
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  errorsByPage.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
    localStorage.setItem("teleo.demo.auto", "false");
    // Simulated speech recognition for the voice-follow case.
    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: ((e: unknown) => void) | null = null;
      onstart: ((e: unknown) => void) | null = null;
      start() {
        setTimeout(() => this.onstart?.({}), 10);
      }
      stop() {}
      abort() {}
    }
    const w = window as unknown as Record<string, unknown>;
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
  });
});

async function openReader(page: Page) {
  await page.goto("/studio?lang=en");
  if (
    !(await page
      .getByRole("button", { name: t.newScript, exact: true })
      .first()
      .isVisible())
  )
    await page
      .locator("header")
      .getByRole("button", { name: t.library, exact: true })
      .click();
  await page
    .getByRole("button", { name: t.newScript, exact: true })
    .first()
    .click();
  const body = page.getByRole("textbox", { name: t.body, exact: true });
  await body.fill(text);
  // Keys typed in the editor stay text: Space must not start playback.
  await body.press("End");
  await body.press("Space");
  await expect(body).toHaveValue(text + " ");
  await body.blur();
  await page.getByRole("button", { name: t.read, exact: true }).click();
  await expect(page.locator(".reader")).toBeVisible();
  await expect(page.locator(".reader")).not.toHaveClass(/is-playing/);
}
const scrollTop = (page: Page) =>
  page.locator(".reading-viewport").evaluate((v) => v.scrollTop);
const speed = (page: Page) =>
  page
    .locator(".reader-controls")
    .getByText(/^\d+(\.\d+)?×$/)
    .first();

test("keyboard controls playback in Reader", async ({ page }) => {
  await openReader(page);
  const reader = page.locator(".reader");

  // Space: play, then pause; position advances while playing.
  const start = await scrollTop(page);
  await page.keyboard.press("Space");
  await expect(reader).toHaveClass(/is-playing/);
  await page.waitForTimeout(1200);
  await page.keyboard.press("Space");
  await expect(reader).not.toHaveClass(/is-playing/);
  const afterPlay = await scrollTop(page);
  expect(afterPlay).toBeGreaterThan(start + 10);

  // Up / Down: speed in 0.1x steps.
  await expect(speed(page)).toHaveText("1.0×");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(speed(page)).toHaveText("1.2×");
  await page.keyboard.press("ArrowDown");
  await expect(speed(page)).toHaveText("1.1×");

  // Right / Left: one rendered line forward and back.
  await page.keyboard.press("ArrowRight");
  const forward = await scrollTop(page);
  expect(forward).toBeGreaterThan(afterPlay + 20);
  await page.keyboard.press("ArrowLeft");
  expect(Math.abs((await scrollTop(page)) - afterPlay)).toBeLessThan(3);

  // Escape leaves Reader.
  await page.keyboard.press("Escape");
  await expect(reader).toHaveCount(0);
});

test("keyboard while following the voice", async ({ page }) => {
  await openReader(page);
  const reader = page.locator(".reader");
  await page
    .locator(".reader-top")
    .getByRole("button", { name: t.voiceFollow, exact: true })
    .click();
  await expect(page.locator(".voice-status")).toHaveClass(/listening/);

  // Arrows move by a line and voice follow keeps listening.
  const before = await scrollTop(page);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  expect(await scrollTop(page)).toBeGreaterThan(before + 40);
  await expect(page.locator(".voice-status")).toHaveClass(/listening/);

  // Space switches to steady playback and turns voice follow off.
  await page.keyboard.press("Space");
  await expect(reader).toHaveClass(/is-playing/);
  await expect(page.locator(".voice-status")).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(reader).not.toHaveClass(/is-playing/);
});
