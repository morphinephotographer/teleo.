import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { chooseSelect } from "./helpers";
import { dictionaries } from "../../apps/web/src/i18n";
type SpeechResultEvent = {
  results: (Array<{ transcript: string }> & { isFinal: boolean })[];
};
type SpeechTestWindow = Window & {
  micStarts?: number;
  micAborts?: number;
  denyMic?: boolean;
  recognition?: {
    onresult?: ((event: SpeechResultEvent) => void) | null;
    onend?: (() => void) | null;
    onerror?: ((event: { error: string }) => void) | null;
  };
  say: (text: string) => void;
};
const text = Array.from(
  { length: 30 },
  (_, i) =>
    `Chapter ${i + 1}. Hello everyone and welcome to our presentation. Today we are exploring the quiet garden beside the river and discovering a different story about every flower along the path.`,
).join("\n\n");
async function setup(context: BrowserContext, supported = true) {
  await context.addInitScript(
    ({ supported }) => {
      sessionStorage.setItem("teleo.intro.seen.v1", "true");
      localStorage.setItem("teleo.demo.auto", "false");
      localStorage.setItem("teleo.tour.v140", "done");
      localStorage.setItem("teleo.locale", "en");
      const w = window as unknown as SpeechTestWindow;
      class Recognition {
        onstart?: () => void;
        onresult?: (event: SpeechResultEvent) => void;
        onend?: () => void;
        onerror?: (event: { error: string }) => void;
        start() {
          w.micStarts = (w.micStarts || 0) + 1;
          w.recognition = this;
          setTimeout(
            () =>
              w.denyMic
                ? this.onerror?.({ error: "not-allowed" })
                : this.onstart?.(),
            5,
          );
        }
        abort() {
          w.micAborts = (w.micAborts || 0) + 1;
        }
        stop() {
          this.onend?.();
        }
      }
      Object.defineProperty(window, "SpeechRecognition", {
        configurable: true,
        value: supported ? Recognition : undefined,
      });
      Object.defineProperty(window, "webkitSpeechRecognition", {
        configurable: true,
        value: undefined,
      });
      w.say = (transcript: string) =>
        w.recognition?.onresult?.({
          results: [Object.assign([{ transcript }], { isFinal: false })],
        });
    },
    { supported },
  );
}
async function paired(browser: Browser, hostSupported = true, preview = false) {
  const hostContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  if (!process.env.TELEO_VOICE_URL)
    await hostContext.setExtraHTTPHeaders({
      "CF-Connecting-IP": crypto.randomUUID(),
    });
  await setup(hostContext, hostSupported);
  await setup(phoneContext);
  const host = await hostContext.newPage(),
    phone = await phoneContext.newPage();
  await host.goto("/studio");
  await host
    .getByRole("button", { name: "New script", exact: true })
    .first()
    .click();
  await host
    .getByRole("textbox", { name: "Your words", exact: true })
    .fill(text);
  await host
    .locator("header")
    .getByRole("button", { name: "Phone connection", exact: true })
    .click();
  const dialog = host.getByRole("dialog", {
    name: "Phone connection",
    exact: true,
  });
  const invitation = await dialog
    .getByRole("link", { name: "Invitation link", exact: true })
    .getAttribute("href");
  await phone.goto(invitation!);
  await expect(dialog).not.toBeVisible();
  await expect(phone.locator(".remote-connection")).toHaveClass(/online/);
  await expect(phone.locator(".remote-text")).toContainText("Chapter 30");
  if (preview) {
    const t = dictionaries.en;
    await phone
      .getByRole("button", { name: t.voicePhoneSetup, exact: true })
      .click();
    const help = phone.getByRole("dialog", { name: t.voicePhone });
    await expect(help).toContainText(t.voicePhoneHelp);
    await help.getByRole("button", { name: t.back, exact: true }).click();
  }
  await host
    .locator("header")
    .getByRole("button", { name: "Read", exact: true })
    .click();
  await expect(host.locator(".reader")).not.toHaveClass(/is-listening/);
  await expect(
    phone.getByRole("button", { name: "Use iPhone microphone", exact: true }),
  ).toBeEnabled();
  await expect(phone.locator(".remote-mic")).toHaveText(
    dictionaries.en.voicePhoneTap,
  );
  return {
    host,
    phone,
    close: async () => {
      await phoneContext.close();
      await hostContext.close();
    },
  };
}
async function start(phone: Page) {
  await phone
    .getByRole("button", { name: "Use iPhone microphone", exact: true })
    .click();
  await expect(phone.locator(".remote-microphone")).toContainText("Listening");
}
test("phone speech moves the host, requires a tap and stops when switched to local", async ({
  browser,
}, info) => {
  const { host, phone, close } = await paired(browser);
  try {
    expect(
      await phone.evaluate(() =>
        Number((window as unknown as SpeechTestWindow).micStarts || 0),
      ),
    ).toBe(0);
    expect(
      await host.evaluate(() =>
        Number((window as unknown as SpeechTestWindow).micStarts || 0),
      ),
    ).toBe(0);
    await start(phone);
    const before = await host
      .locator(".reading-viewport")
      .evaluate((el) => el.scrollTop);
    const words = text.split(/\s+/).slice(0, 160);
    let transcript = "";
    for (let n = 0; n < words.length; n += 4) {
      transcript = words.slice(0, n + 4).join(" ");
      await phone.evaluate(
        (value) => (window as unknown as SpeechTestWindow).say(value),
        transcript,
      );
      await phone.waitForTimeout(80);
    }
    await expect
      .poll(() =>
        host.locator(".reading-viewport").evaluate((el) => el.scrollTop),
      )
      .toBeGreaterThan(before + 40);
    await phone.screenshot({ path: info.outputPath("phone-listening.png") });
    await host.screenshot({ path: info.outputPath("reader-phone-source.png") });
    await chooseSelect(
      host.getByRole("combobox", { name: "Microphone source", exact: true }),
      "local",
    );
    await expect(
      phone.getByRole("button", { name: "Use iPhone microphone", exact: true }),
    ).toHaveCount(0);
    await expect(host.locator(".reader")).not.toHaveClass(/is-listening/);
    expect(
      await phone.evaluate(() =>
        Number((window as unknown as SpeechTestWindow).micAborts),
      ),
    ).toBeGreaterThan(0);
  } finally {
    await close();
  }
});
test("host without speech API can use phone; permission denial does not enable local capture", async ({
  browser,
}) => {
  const { host, phone, close } = await paired(browser, false);
  try {
    await phone.evaluate(() => {
      (window as unknown as SpeechTestWindow).denyMic = true;
    });
    await phone
      .getByRole("button", { name: "Use iPhone microphone", exact: true })
      .click();
    await expect(host.locator(".reader")).not.toHaveClass(/is-listening/);
    await expect(
      host.getByRole("alert").filter({ hasText: "denied" }),
    ).toBeVisible();
    await expect(phone.locator(".remote-mic-hint")).toHaveText(
      dictionaries.en.voicePermission,
    );
    expect(
      await host.evaluate(() =>
        Number((window as unknown as SpeechTestWindow).micStarts || 0),
      ),
    ).toBe(0);
  } finally {
    await close();
  }
});
test("hiding phone stops capture and late transcripts cannot restart the host", async ({
  browser,
}) => {
  const { host, phone, close } = await paired(browser);
  try {
    await start(phone);
    await phone.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(host.locator(".reader")).not.toHaveClass(/is-listening/);
    await expect(
      phone.getByRole("button", { name: "Use iPhone microphone", exact: true }),
    ).toHaveCount(0);
    await phone.evaluate(() =>
      (window as unknown as SpeechTestWindow).say(
        "hello everyone and welcome to our presentation",
      ),
    );
    await expect(host.locator(".reader")).not.toHaveClass(/is-listening/);
  } finally {
    await close();
  }
});
test("peer disconnect stops host voice; manual Play still works", async ({
  browser,
}) => {
  const { host, phone, close } = await paired(browser);
  try {
    await start(phone);
    await phone.close();
    await expect(host.locator(".reader")).not.toHaveClass(/is-listening/, {
      timeout: 15000,
    });
    await host
      .locator(".reader-controls")
      .getByRole("button", { name: "Play", exact: true })
      .click();
    await expect(host.locator(".reader")).toHaveClass(/is-playing/);
  } finally {
    await close();
  }
});

test("stop and new consent cancel queued speech and restart capture cleanly", async ({
  browser,
}) => {
  const { host, phone, close } = await paired(browser);
  try {
    await start(phone);
    await phone.evaluate(() => {
      (window as unknown as SpeechTestWindow).say("hello everyone and welcome");
    });
    await phone
      .getByRole("button", { name: "Stop iPhone microphone", exact: true })
      .click();
    await expect(host.locator(".reader")).not.toHaveClass(/is-listening/);
    await expect(
      phone.getByRole("button", { name: "Use iPhone microphone", exact: true }),
    ).toHaveCount(0);
    await host.locator(".reader-voice").click();
    await start(phone);
    const words = text.split(/\s+/).slice(0, 120);
    const before = await host
      .locator(".reading-viewport")
      .evaluate((el) => el.scrollTop);
    for (let n = 4; n < words.length; n += 4) {
      await phone.evaluate(
        (v) => (window as unknown as SpeechTestWindow).say(v),
        words.slice(0, n).join(" "),
      );
      await phone.waitForTimeout(80);
    }
    await expect
      .poll(() =>
        host.locator(".reading-viewport").evaluate((el) => el.scrollTop),
      )
      .toBeGreaterThan(before + 20);
  } finally {
    await close();
  }
});
test("missing phone heartbeats stop following without activating the laptop microphone", async ({
  browser,
}) => {
  const { host, phone, close } = await paired(browser);
  try {
    await start(phone);
    await phone.evaluate(() => {
      const send = WebSocket.prototype.send;
      WebSocket.prototype.send = function (data) {
        if (
          typeof data === "string" &&
          ["voiceStatus", "voiceTranscript"].includes(JSON.parse(data).type)
        )
          return;
        send.call(this, data);
      };
    });
    await expect(host.locator(".reader")).not.toHaveClass(/is-listening/, {
      timeout: 12000,
    });
    expect(
      await host.evaluate(() =>
        Number((window as unknown as SpeechTestWindow).micStarts || 0),
      ),
    ).toBe(0);
  } finally {
    await close();
  }
});

test("remote seeking and elastic overscroll keep the phone microphone connected", async ({
  browser,
}) => {
  const { host, phone, close } = await paired(browser, true, true);
  try {
    await start(phone);
    const view = host.locator(".reading-viewport");
    const timeline = phone.locator(".remote-timeline input");
    const reached = () => view.evaluate((el) => el.scrollTop);
    await timeline.fill("700");
    await expect.poll(reached).toBeGreaterThan(100);
    await timeline.fill("0");
    await expect.poll(reached).toBeLessThan(2);

    // Playwright does not generate iOS rubber-band scrolling. Feed the
    // negative scrollTop that Safari exposes during an elastic overscroll.
    await view.evaluate((el) => {
      Object.defineProperty(el, "scrollTop", {
        configurable: true,
        get: () => -12,
        set: () => {},
      });
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    try {
      const preview = phone.locator(".remote-text");
      await preview.evaluate((el) => {
        el.dispatchEvent(new Event("touchstart", { bubbles: true }));
        el.scrollTop += 180;
      });
      // Observe several host state updates while the elastic offset is present.
      await phone.waitForTimeout(1100);
      await expect(phone.locator(".remote-connection")).toHaveClass(/online/);
      await expect(phone.locator(".remote-mic")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    } finally {
      await view.evaluate((el) => {
        Reflect.deleteProperty(el, "scrollTop");
      });
    }

    await timeline.fill("500");
    await expect.poll(reached).toBeGreaterThan(100);
    await expect(host.locator(".reader")).toHaveClass(/is-listening/);

    await phone.setViewportSize({ width: 375, height: 667 });
    await expect(phone.locator(".remote-header .remote-mic")).toBeVisible();
    await phone.locator(".remote-quick-trigger").click();
    const quick = phone.locator(".remote-quick-menu");
    const panel = (await quick.boundingBox())!;
    const alignment = (await quick.locator(".quick-alignment").boundingBox())!;
    expect(alignment.y + alignment.height).toBeLessThanOrEqual(
      panel.y + panel.height,
    );
    await phone.screenshot({ path: test.info().outputPath("remote-text.png") });
  } finally {
    await close();
  }
});

test("computer scrolling keeps the phone microphone connected", async ({
  browser,
}) => {
  const { host, phone, close } = await paired(browser, true, true);
  try {
    await start(phone);
    const view = host.locator(".reading-viewport");
    const connection = phone.locator(".remote-connection");
    const microphone = phone.locator(".remote-mic");
    const position = () => view.evaluate((el) => el.scrollTop);
    const assertListening = async () => {
      await expect(connection).toHaveClass(/online/);
      await expect(microphone).toHaveAttribute("aria-pressed", "true");
      await expect(host.locator(".reader")).toHaveClass(/is-listening/);
    };

    await view.hover();
    await host.mouse.wheel(0, 680);
    await expect.poll(position).toBeGreaterThan(100);
    await assertListening();

    const maximum = await view.evaluate(
      (el) => el.scrollHeight - el.clientHeight,
    );
    for (const [wheel, expected] of [
      [maximum * 2, maximum],
      [-maximum * 2, 0],
    ]) {
      await host.mouse.wheel(0, wheel);
      await expect.poll(position).toBeCloseTo(expected, 0);
      // Wait for the phone to receive the new computer position over the relay.
      await expect(phone.locator(".remote-timeline input")).toHaveValue(
        expected ? "1000" : "0",
      );
      await assertListening();
    }

    // A fresh command still reaches the computer after scrolling both edges.
    await phone.locator(".remote-timeline input").fill("500");
    await expect.poll(position).toBeGreaterThan(100);
    await assertListening();
  } finally {
    await close();
  }
});

test("phone recognition restarts after a seek and can resume if Safari requires a tap", async ({
  browser,
}) => {
  const { host, phone, close } = await paired(browser);
  try {
    await start(phone);
    const timeline = phone.locator(".remote-timeline input");
    await timeline.fill("500");
    await expect
      .poll(() =>
        host.locator(".reading-viewport").evaluate((el) => el.scrollTop),
      )
      .toBeGreaterThan(100);
    await phone.evaluate(() =>
      (window as unknown as SpeechTestWindow).recognition?.onend?.(),
    );
    await expect
      .poll(() =>
        phone.evaluate(() => (window as unknown as SpeechTestWindow).micStarts),
      )
      .toBe(2);
    await expect(phone.locator(".remote-mic")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await phone.evaluate(() =>
      (window as unknown as SpeechTestWindow).recognition?.onerror?.({
        error: "not-allowed",
      }),
    );
    const hint = dictionaries.en.voicePhonePaused;
    await expect(
      host.getByRole("alert").filter({ hasText: hint }),
    ).toBeVisible();
    await expect(phone.getByText(hint, { exact: true })).toBeVisible();
    const resume = phone.getByRole("button", {
      name: "Use iPhone microphone",
      exact: true,
    });
    await expect(resume).toBeEnabled();
    await resume.click();
    await expect
      .poll(() =>
        phone.evaluate(() => (window as unknown as SpeechTestWindow).micStarts),
      )
      .toBe(3);
    await expect(phone.locator(".remote-connection")).toHaveClass(/online/);
    await expect(host.locator(".reader")).toHaveClass(/is-listening/);
    await expect(
      host.getByRole("alert").filter({ hasText: hint }),
    ).toBeHidden();
  } finally {
    await close();
  }
});

test("phone voice survives text controls, preview changes and display settings", async ({
  browser,
}) => {
  const { host, phone, close } = await paired(browser, true, true);
  const t = dictionaries.en;
  try {
    await start(phone);
    const assertActive = async () => {
      await expect(phone.locator(".remote-connection")).toHaveClass(/online/);
      await expect(phone.locator(".remote-mic")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(host.locator(".reader")).toHaveClass(/is-listening/);
      expect(
        await phone.evaluate(
          () => (window as unknown as SpeechTestWindow).micStarts,
        ),
      ).toBe(1);
    };
    const article = host.locator(".reading-viewport article");
    await phone.locator(".remote-quick-trigger").click();
    const quick = phone.locator(".remote-quick-menu");
    for (const [label, value, property, css] of [
      [t.fontSize, "52", "font-size", "52px"],
      [t.lineHeight, "1.9", "line-height", "98.8px"],
      [t.textWidth, "620", "max-width", "620px"],
    ]) {
      await quick.getByRole("slider", { name: label, exact: true }).fill(value);
      if (property === "line-height") {
        await expect
          .poll(() => article.evaluate((el) => el.style.lineHeight))
          .toBe(value);
      } else {
        await expect(article).toHaveCSS(property, css);
      }
      await assertActive();
    }
    await quick
      .getByRole("button", { name: t.alignRight, exact: true })
      .click();
    await expect(article).toHaveCSS("text-align", "right");
    await quick.getByRole("button", { name: t.close, exact: true }).click();
    await phone.getByRole("button", { name: t.advancedSettings }).click();
    const advanced = phone.locator(".remote-settings-page");
    for (const name of [
      t.mirrorHorizontal,
      t.mirrorVertical,
      t.focusLine,
      t.focus,
      t.showText,
    ]) {
      const control = advanced.getByRole("checkbox", { name, exact: true });
      const wasChecked = await control.isChecked();
      await control.click();
      await expect(control).toBeChecked({ checked: !wasChecked });
      await assertActive();
      await control.click();
      await expect(control).toBeChecked({ checked: wasChecked });
    }
    await advanced.getByRole("button", { name: t.back, exact: true }).click();
    const view = host.locator(".reading-viewport");
    const before = await view.evaluate((el) => el.scrollTop);
    const words = text.split(/\s+/).slice(0, 140);
    await phone.evaluate(
      (value) => (window as unknown as SpeechTestWindow).say(value),
      words.join(" "),
    );
    await expect
      .poll(() => view.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(before + 40);
    await assertActive();
  } finally {
    await close();
  }
});

async function sendNewScript(phone: Page, body: string) {
  const t = dictionaries.en;
  await phone
    .getByRole("button", { name: t.quickSendTitle, exact: true })
    .click();
  const sheet = phone.locator(".quick-send-sheet");
  await sheet.getByRole("textbox").fill(body);
  await sheet.getByRole("radio", { name: t.quickSendLibrary }).check();
  await sheet.getByRole("button", { name: t.quickSendSubmit }).click();
  await sheet.getByRole("button", { name: t.quickSendContinue }).click();
}

test("a new script received while reading keeps the same phone microphone and follows its words", async ({
  browser,
}) => {
  const { host, phone, close } = await paired(browser);
  const t = dictionaries.en;
  try {
    await start(phone);
    const newBody = Array.from(
      { length: 28 },
      (_, i) =>
        `Voyage ${i + 1}. The midnight expedition crossed an ancient mountain trail. Our guide described the silver constellations and the hidden valley beyond the summit.`,
    ).join("\n\n");
    await sendNewScript(phone, newBody);
    const view = host.locator(".reading-viewport");
    await expect(view).toContainText("Voyage 28");
    await expect(phone.locator(".remote-mic")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(host.locator(".reader")).toHaveClass(/is-listening/);
    expect(
      await phone.evaluate(
        () => (window as unknown as SpeechTestWindow).micStarts,
      ),
    ).toBe(1);
    // Let the matcher discard buffered speech immediately following the change.
    await phone.waitForTimeout(350);
    const words = newBody.split(/\s+/);
    for (const count of [32, 70, 110]) {
      await phone.evaluate(
        (value) => (window as unknown as SpeechTestWindow).say(value),
        words.slice(0, count).join(" "),
      );
      await phone.waitForTimeout(280);
    }
    await expect
      .poll(() => view.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(40);
    const picker = host
      .locator("header")
      .getByRole("combobox", { name: t.currentScript, exact: true });
    await picker.click();
    const list = host.locator(
      `[id="${await picker.getAttribute("aria-controls")}"]`,
    );
    await list.getByRole("option", { name: t.untitled }).click();
    await expect(view).toContainText("Chapter 30");
    await expect(phone.locator(".remote-mic")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(host.locator(".reader")).toHaveClass(/is-listening/);
  } finally {
    await close();
  }
});

test("a script in another language waits for a new microphone tap without losing pairing", async ({
  browser,
}) => {
  const { host, phone, close } = await paired(browser);
  try {
    await start(phone);
    const body =
      "Сьогодні ми розповідаємо історію про мандрівку українськими горами. ".repeat(
        48,
      );
    await sendNewScript(phone, body);
    await expect(host.locator(".reading-viewport")).toContainText(
      "українськими горами",
    );
    await expect(phone.locator(".remote-connection")).toHaveClass(/online/);
    await expect(phone.locator(".remote-mic")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      await phone.evaluate(
        () => (window as unknown as SpeechTestWindow).micStarts,
      ),
    ).toBe(1);
    await start(phone);
    await expect(host.locator(".voice-status")).toContainText("Listening");
    expect(
      await phone.evaluate(
        () => (window as unknown as SpeechTestWindow).micStarts,
      ),
    ).toBe(2);
  } finally {
    await close();
  }
});
