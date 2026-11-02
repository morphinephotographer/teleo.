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

test("mouse wheel and trackpad scroll the text without shaking", async ({
  page,
  isMobile,
  browserName,
}) => {
  test.skip(isMobile && browserName === "webkit", "No wheel in mobile WebKit");
  await openReader(page);
  const view = page.locator(".reading-viewport");
  // The wheel acts where the pointer is: keep it over the text.
  const overText = async () => {
    const box = (await view.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  };
  // Trackpad-like small steps: every step moves forward, nothing is undone.
  const scrollDown = async (phase = "") => {
    await overText();
    const seen = [await scrollTop(page)];
    for (let i = 0; i < 20; i++) {
      await page.mouse.wheel(0, 12);
      seen.push(await scrollTop(page));
    }
    for (let i = 1; i < seen.length; i++)
      expect(seen[i], phase).toBeGreaterThanOrEqual(seen[i - 1] - 1);
    expect(seen.at(-1)!, phase).toBeGreaterThan(seen[0] + 150);
    return seen.at(-1)!;
  };
  const scrollUp = async () => {
    await overText();
    const seen = [await scrollTop(page)];
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, -12);
      seen.push(await scrollTop(page));
    }
    for (let i = 1; i < seen.length; i++)
      expect(seen[i]).toBeLessThanOrEqual(seen[i - 1] + 1);
    expect(seen.at(-1)!).toBeLessThan(seen[0] - 60);
  };

  // Paused.
  let reached = await scrollDown("paused");
  await page.waitForTimeout(500);
  expect(Math.abs((await scrollTop(page)) - reached)).toBeLessThanOrEqual(13);
  await scrollUp();

  // Playing: the wheel pauses where the text was scrolled to.
  await page.keyboard.press("Space");
  await expect(page.locator(".reader")).toHaveClass(/is-playing/);
  await page.waitForTimeout(600);
  reached = await scrollDown("playing");
  await expect(page.locator(".reader")).not.toHaveClass(/is-playing/);
  await page.waitForTimeout(500);
  expect(Math.abs((await scrollTop(page)) - reached)).toBeLessThanOrEqual(13);

  // Following the voice: manual scrolling is not pulled back.
  await page
    .locator(".reader-top")
    .getByRole("button", { name: t.voiceFollow, exact: true })
    .click();
  await expect(page.locator(".voice-status")).toHaveClass(/listening/);
  reached = await scrollDown("voice");
  await page.waitForTimeout(1600);
  expect(Math.abs((await scrollTop(page)) - reached)).toBeLessThan(40);
  await scrollUp();
});
