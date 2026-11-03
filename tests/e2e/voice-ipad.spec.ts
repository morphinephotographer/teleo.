import { test, expect, type Page } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
const t = dictionaries.en;

/**
 * iPad Safari's recognizer, as observed: every session ends after a phrase or
 * a pause; a start too soon after the previous end fails at once with
 * "audio-capture"; a used recognizer object cannot be started again; and the
 * browser may refuse automatic restarts until the next tap.
 */
const text = Array.from(
  { length: 12 },
  (_, i) =>
    `Абзац ${i + 1}. Сьогодні ми говоримо про нові можливості які допоможуть читати текст природно.`,
).join("\n\n");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("teleo.intro.seen.v1", "true");
    localStorage.setItem("teleo.demo.auto", "false");
    Object.defineProperty(navigator, "userAgent", {
      get: () =>
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    });
    Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
    type Handler = ((event: unknown) => void) | null;
    const w = window as unknown as Record<string, unknown> & {
      __log: string[];
    };
    w.__log = [];
    let lastEnd = -1e9;
    let micBusy = false;
    class IPadRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: Handler = null;
      onerror: Handler = null;
      onend: Handler = null;
      onstart: Handler = null;
      used = false;
      start() {
        if (this.used)
          throw new DOMException("already started", "InvalidStateError");
        this.used = true;
        w.__starts = ((w.__starts as number) || 0) + 1;
        w.__recognition = this;
        const tooSoon = performance.now() - lastEnd < 400 || micBusy;
        const refuse = w.__refuse as boolean | undefined;
        w.__log.push(tooSoon ? "fail-busy" : refuse ? "refused" : "start");
        const die = w.__die as boolean | undefined;
        setTimeout(() => {
          if (die) return this.finish(); // ends at once, never listens
          if (refuse) {
            this.onerror?.({ error: "not-allowed" });
            return this.finish();
          }
          if (tooSoon) {
            this.onerror?.({ error: "audio-capture" });
            return this.finish();
          }
          micBusy = true;
          this.onstart?.({});
        }, 10);
      }
      finish() {
        micBusy = false;
        lastEnd = performance.now();
        this.onend?.({});
      }
      stop() {
        setTimeout(() => this.finish(), 10);
      }
      abort() {
        micBusy = false;
        lastEnd = performance.now();
      }
      /** Says a phrase; like iPad, the session ends right after it. */
      phrase(transcript: string) {
        this.onresult?.({
          results: [Object.assign([{ transcript }], { isFinal: true })],
        });
        setTimeout(() => this.finish(), 30);
      }
    }
    w.SpeechRecognition = undefined;
    w.webkitSpeechRecognition = IPadRecognition;
    w.__phrase = (s: string) =>
      (w.__recognition as IPadRecognition | undefined)?.phrase(s);
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
  await page.getByRole("textbox", { name: t.body, exact: true }).fill(text);
  await page.getByRole("textbox", { name: t.body, exact: true }).blur();
  await page.getByRole("button", { name: t.read, exact: true }).click();
  await expect(page.locator(".reader")).toBeVisible();
}

const starts = (page: Page) =>
  page.evaluate(() => (window as never as { __starts: number }).__starts || 0);
const log = (page: Page) =>
  page.evaluate(() => (window as never as { __log: string[] }).__log);

test("sessions that end after every phrase restart calmly and keep following", async ({
  page,
}) => {
  await openReader(page);
  await page
    .locator(".reader-top")
    .getByRole("button", { name: t.voiceFollow, exact: true })
    .click();
  await expect(page.locator(".voice-status")).toHaveClass(/listening/);
  const phrases = [
    "абзац 1 сьогодні ми говоримо про нові можливості",
    "які допоможуть читати текст природно абзац 2",
    "сьогодні ми говоримо про нові можливості",
  ];
  for (const phrase of phrases) {
    const before = await starts(page);
    await page.evaluate(
      (s) => (window as never as { __phrase: (s: string) => void }).__phrase(s),
      phrase,
    );
    // The next session opens once, after the microphone is free.
    await expect.poll(() => starts(page), { timeout: 3000 }).toBe(before + 1);
    await page.waitForTimeout(100);
  }
  expect((await log(page)).filter((l) => l !== "start")).toEqual([]);
  await expect(page.locator(".voice-status")).toHaveClass(/listening/);
  await expect(page.getByRole("alert")).toHaveCount(0);
  // Following moved on into paragraph 2.
  const read = await page.evaluate(() => {
    const h = (
      CSS as unknown as {
        highlights: Map<string, Iterable<Range>>;
      }
    ).highlights.get("teleo-voice-read");
    return h ? [...h].map((r) => r.toString()).join(" ") : "";
  });
  expect(read).toContain("Абзац 2.");
});

test("a recognizer that keeps dying pauses instead of flickering, and a tap continues", async ({
  page,
}) => {
  await openReader(page);
  await page
    .locator(".reader-top")
    .getByRole("button", { name: t.voiceFollow, exact: true })
    .click();
  await expect(page.locator(".voice-status")).toHaveClass(/listening/);
  // From now on the browser refuses to restart without a tap.
  await page.evaluate(() => {
    (window as never as { __refuse: boolean }).__refuse = true;
  });
  await page.evaluate(() =>
    (window as never as { __phrase: (s: string) => void }).__phrase(
      "абзац 1 сьогодні",
    ),
  );
  await expect(page.getByRole("alert")).toContainText(t.voicePaused);
  const after = await starts(page);
  await page.waitForTimeout(3000);
  expect(await starts(page)).toBe(after); // no more attempts while paused

  await page.evaluate(() => {
    (window as never as { __refuse: boolean }).__refuse = false;
  });
  await page
    .locator("[data-paragraph]")
    .nth(3)
    .click({ position: { x: 6, y: 8 } });
  await expect(page.locator(".voice-status")).toHaveClass(/listening/);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("sessions that end at once give up after a few calm attempts", async ({
  page,
}) => {
  await openReader(page);
  await page
    .locator(".reader-top")
    .getByRole("button", { name: t.voiceFollow, exact: true })
    .click();
  await expect(page.locator(".voice-status")).toHaveClass(/listening/);
  const before = await starts(page);
  // From now on every session ends the moment it opens.
  await page.evaluate(() => {
    (window as never as { __die: boolean }).__die = true;
    (
      window as never as { __recognition?: { finish: () => void } }
    ).__recognition?.finish();
  });
  await expect(page.getByRole("alert")).toContainText(t.voicePaused, {
    timeout: 15000,
  });
  const attempts = (await starts(page)) - before;
  expect(attempts).toBeGreaterThanOrEqual(3);
  expect(attempts).toBeLessThanOrEqual(6);
  await page.waitForTimeout(2500);
  expect((await starts(page)) - before).toBe(attempts);
});
