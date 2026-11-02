import { test, expect, type Page } from "@playwright/test";
import { dictionaries } from "../../apps/web/src/i18n";
const t = dictionaries.en;

const paragraph = (n: number) =>
  `Абзац ${n}. Сьогодні ми говоримо про нові можливості, які допоможуть читати текст природно [пауза] та спокійно дивитися в камеру.`;
const text = Array.from({ length: 24 }, (_, i) => paragraph(i + 1)).join(
  "\n\n",
);
const spokenWords = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => paragraph(from + i))
    .join(" ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[.,]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

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
    // Controllable stand-in for the browser's speech recognition.
    type Handler = ((event: unknown) => void) | null;
    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: Handler = null;
      onerror: Handler = null;
      onend: Handler = null;
      onstart: Handler = null;
      start() {
        const w = window as unknown as Record<string, unknown>;
        w.__recognition = this;
        w.__lang = this.lang;
        w.__starts = ((w.__starts as number) || 0) + 1;
        // Like Chrome: a refused start reports an error and ends, never starts.
        const deny = w.__deny as string | undefined;
        if (deny)
          setTimeout(() => {
            this.onerror?.({ error: deny });
            this.onend?.({});
          }, 10);
        else setTimeout(() => this.onstart?.({}), 10);
      }
      stop() {
        setTimeout(() => this.onend?.({}), 10);
      }
      abort() {}
    }
    const w = window as unknown as Record<string, unknown>;
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
    w.__say = (transcript: string) => {
      const rec = w.__recognition as FakeRecognition | undefined;
      rec?.onresult?.({
        results: [Object.assign([{ transcript }], { isFinal: false })],
      });
    };
    w.__fail = (error: string) =>
      (w.__recognition as FakeRecognition | undefined)?.onerror?.({ error });
    w.__end = () =>
      (w.__recognition as FakeRecognition | undefined)?.onend?.({});
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

/** The recognizer keeps extending one transcript per session. */
async function say(page: Page, words: string[], prefix = "") {
  let transcript = prefix;
  for (const word of words) {
    transcript = transcript ? `${transcript} ${word}` : word;
    await page.evaluate(
      (s) => (window as never as { __say: (s: string) => void }).__say(s),
      transcript,
    );
    await page.waitForTimeout(25);
  }
  return transcript;
}

const scrollTop = (page: Page) =>
  page.locator(".reading-viewport").evaluate((v) => v.scrollTop);
const readText = (page: Page) =>
  page.evaluate(() => {
    const registry = (
      CSS as unknown as { highlights?: Map<string, Set<Range>> }
    ).highlights;
    const h = registry?.get("teleo-voice-read");
    return h ? [...h].map((r) => r.toString()).join("\n\n") : null;
  });

test("reader follows the voice, dims read text, jumps on tap and stops", async ({
  page,
}, info) => {
  test.setTimeout(60000);
  await openReader(page);
  const mic = page
    .locator(".reader-top")
    .getByRole("button", { name: t.voiceFollow, exact: true });
  await expect(mic).toBeVisible();
  await mic.click();
  await expect(page.locator(".voice-status")).toHaveClass(/listening/);
  expect(
    await page.evaluate(() => (window as never as { __lang: string }).__lang),
  ).toBe("uk-UA");

  const before = await scrollTop(page);
  await say(page, spokenWords(1, 4));
  await expect
    .poll(() => scrollTop(page), { timeout: 5000 })
    .toBeGreaterThan(before + 50);
  const read = await readText(page);
  expect(read).toContain("Абзац 4.");
  expect(read).not.toContain("Абзац 5.");
  // Settled: paragraph 5 sits at the guide line.
  await page.waitForTimeout(1500);
  const guide = await page.evaluate(() => {
    const v = document.querySelector(".reading-viewport")!;
    const r = v.getBoundingClientRect();
    const y = r.top + (v.clientHeight * 35) / 100;
    const p = [...document.querySelectorAll("[data-paragraph]")].find((p) => {
      const b = p.getBoundingClientRect();
      return b.top - 4 <= y && b.bottom + 4 >= y;
    });
    return p?.textContent?.slice(0, 9) || "";
  });
  expect(guide).toBe("Абзац 5. ");
  await page.screenshot({
    path: `test-results/voice-follow/${info.project.name}-listening.png`,
  });

  // A browser-ended session restarts and continues from the read position.
  await page.evaluate(() => (window as never as { __end: () => void }).__end());
  await expect
    .poll(() =>
      page.evaluate(() => (window as never as { __starts: number }).__starts),
    )
    .toBe(2);
  await expect(page.locator(".voice-status")).toHaveClass(/listening/);
  const session = await say(page, spokenWords(5, 5));
  await expect
    .poll(async () => (await readText(page)) || "")
    .toContain("Абзац 5.");

  // Manual wheel scrolling wins; once it settles, follow continues from the guide.
  const readBeforeWheel = ((await readText(page)) || "").length;
  const scrolledFrom = await scrollTop(page);
  const view = page.locator(".reading-viewport");
  const vbox = (await view.boundingBox())!;
  await page.mouse.move(vbox.x + vbox.width / 2, vbox.y + vbox.height / 2);
  const target = page.locator("[data-paragraph]").nth(9);
  const distance = await target.evaluate((p) => {
    const v = document.querySelector(".reading-viewport")!;
    const guide = v.getBoundingClientRect().top + (v.clientHeight * 35) / 100;
    return p.getBoundingClientRect().top - guide + 4;
  });
  for (let moved = 0; moved < distance; moved += 120)
    await page.mouse.wheel(0, Math.min(120, distance - moved));
  const scrolled = await scrollTop(page);
  await page.waitForTimeout(1800);
  // The view is not pulled back to the spoken position; read text now
  // reaches the scrolled-to place. (Layout may shift a little on phones.)
  expect(await scrollTop(page)).toBeGreaterThan(
    scrolledFrom + (scrolled - scrolledFrom) / 2,
  );
  await expect
    .poll(async () => ((await readText(page)) || "").length)
    .toBeGreaterThan(readBeforeWheel + 100);

  // Tap a visible word two lines below the guide: tracking continues from it.
  const readBeforeTap = (await readText(page)) || "";
  const point = await page.evaluate(() => {
    const v = document.querySelector(".reading-viewport")!;
    const r = v.getBoundingClientRect();
    const article = v.querySelector("article")!;
    const line = parseFloat(getComputedStyle(article).lineHeight);
    const p = article.querySelector("[data-paragraph]")!;
    return {
      x: p.getBoundingClientRect().left + 12,
      y: r.top + (v.clientHeight * 35) / 100 + line * 2.5,
    };
  });
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(400);
  const tappedText = (await readText(page)) || "";
  expect(tappedText).not.toBe(readBeforeTap);
  expect(text.startsWith(tappedText)).toBe(true);
  // Position = start of the next word after the read text.
  const tappedAt =
    tappedText.length + text.slice(tappedText.length).match(/^\s*/)![0].length;
  // Read the next five words aloud from there.
  const ahead = [...text.slice(tappedAt).matchAll(/\S+/g)]
    .filter((m) => !m[0].startsWith("[") && !m[0].endsWith("]"))
    .slice(0, 6);
  await say(
    page,
    ahead.slice(0, 5).map((m) => m[0].replace(/[.,]/g, "").toLowerCase()),
    session,
  );
  // Read text ends right before the sixth word (blank lines between
  // paragraphs are never highlighted, so compare without trailing space).
  await expect
    .poll(async () => ((await readText(page)) || "").trimEnd(), {
      timeout: 5000,
    })
    .toBe(text.slice(0, tappedAt + ahead[5].index!).trimEnd());

  // Turning it off clears the highlight and keeps the position.
  await page
    .locator(".reader-top")
    .getByRole("button", { name: t.voiceFollowStop, exact: true })
    .click();
  await expect(page.locator(".voice-status")).toHaveCount(0);
  expect(await readText(page)).toBeNull();
});

test("speaking another paragraph jumps there, forward and back", async ({
  page,
}) => {
  await openReader(page);
  await page
    .locator(".reader-top")
    .getByRole("button", { name: t.voiceFollow, exact: true })
    .click();
  await expect(page.locator(".voice-status")).toHaveClass(/listening/);
  const atGuide = () =>
    page.evaluate(() => {
      const v = document.querySelector(".reading-viewport")!;
      const y = v.getBoundingClientRect().top + (v.clientHeight * 35) / 100;
      const p = [...document.querySelectorAll("[data-paragraph]")].find((p) => {
        const b = p.getBoundingClientRect();
        return b.top - 4 <= y && b.bottom + 4 >= y;
      });
      return p?.textContent?.match(/Абзац (\d+)/)?.[1] || "";
    });
  let said = await say(page, spokenWords(1, 1));
  // Leave paragraph 2 unfinished and continue with paragraph 8.
  said = await say(page, spokenWords(2, 2).slice(0, 4), said);
  said = await say(page, spokenWords(8, 8).slice(0, 6), said);
  await expect.poll(atGuide, { timeout: 5000 }).toBe("8");
  await expect
    .poll(async () => (await readText(page)) || "")
    .toMatch(/Абзац 8\. Сьогодні ми говоримо про $/);
  // Go back and re-read paragraph 3.
  await say(page, spokenWords(3, 3).slice(0, 6), said);
  await expect.poll(atGuide, { timeout: 5000 }).toBe("3");
  await expect
    .poll(async () => (await readText(page)) || "")
    .toMatch(/Абзац 3\. Сьогодні ми говоримо про $/);
});

test("permission denial is explained and Play turns voice follow off", async ({
  page,
}) => {
  await openReader(page);
  const mic = page
    .locator(".reader-top")
    .getByRole("button", { name: t.voiceFollow, exact: true });
  const w = (key: string, value: unknown) =>
    page.evaluate(
      ([k, v]) => ((window as unknown as Record<string, unknown>)[k] = v),
      [key, value] as const,
    );
  // The browser refuses microphone access on the first start.
  await w("__deny", "not-allowed");
  await mic.click();
  await expect(page.getByRole("alert")).toContainText(t.voicePermission);
  await expect(page.locator(".voice-status")).toHaveCount(0);

  // Allowed now; later an automatic restart is refused (as on iPhone).
  await w("__deny", undefined);
  await mic.click();
  await expect(page.locator(".voice-status")).toHaveClass(/listening/);
  await w("__deny", "not-allowed");
  await page.evaluate(() => (window as never as { __end: () => void }).__end());
  await expect(page.getByRole("alert")).toContainText(t.voiceFailed);
  await expect(page.locator(".voice-status")).toHaveCount(0);

  // A short network loss does not stop listening.
  await w("__deny", undefined);
  await mic.click();
  await expect(page.locator(".voice-status")).toHaveClass(/listening/);
  await page.evaluate(() =>
    (window as never as { __fail: (e: string) => void }).__fail("network"),
  );
  await page.evaluate(() => (window as never as { __end: () => void }).__end());
  await expect(page.locator(".voice-status")).toHaveClass(/listening/);
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.keyboard.press("Space");
  await expect(page.locator(".voice-status")).toHaveCount(0);
});

test("keyboard line moves are not undone while listening", async ({ page }) => {
  await openReader(page);
  await page
    .locator(".reader-top")
    .getByRole("button", { name: t.voiceFollow, exact: true })
    .click();
  await expect(page.locator(".voice-status")).toHaveClass(/listening/);
  await say(page, spokenWords(1, 2));
  await page.waitForTimeout(1500);
  const settled = await scrollTop(page);
  await page.locator(".reading-viewport").focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  const moved = await scrollTop(page);
  expect(moved).toBeGreaterThan(settled + 100);
  // Not pulled back after the move settles.
  await page.waitForTimeout(2000);
  expect(Math.abs((await scrollTop(page)) - moved)).toBeLessThan(40);
});

test("the playback dock hides while listening and returns after", async ({
  page,
}) => {
  await openReader(page);
  const dock = page.locator(".reader-controls");
  await expect(dock).toBeVisible();
  const guideBefore = await page.locator(".guide").boundingBox();
  const mic = page
    .locator(".reader-top")
    .getByRole("button", { name: t.voiceFollow, exact: true });
  await mic.click();
  await expect(page.locator(".voice-status")).toHaveClass(/listening/);
  await expect(dock).toBeHidden();
  await expect(dock).toHaveAttribute("inert", "");
  // Hiding never moves the reading guide.
  expect(await page.locator(".guide").boundingBox()).toEqual(guideBefore);
  // Pointer activity does not bring it back while listening.
  await page.mouse.move(200, 300);
  await page.mouse.move(220, 320);
  await expect(dock).toBeHidden();
  await page
    .locator(".reader-top")
    .getByRole("button", { name: t.voiceFollowStop, exact: true })
    .click();
  await expect(dock).toBeVisible();
  await expect(dock).not.toHaveAttribute("inert");
});

test("unsupported browsers show no microphone button", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.webkitSpeechRecognition;
    delete w.SpeechRecognition;
  });
  await openReader(page);
  await expect(
    page.locator(".reader-top").getByRole("button", { name: t.voiceFollow }),
  ).toHaveCount(0);
});
