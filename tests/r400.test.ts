import { describe, it, expect, vi } from "vitest";
import { r400Shortcut, bindReaderKeyboard } from "../apps/web/src/r400";
import { createReaderFullscreen } from "../apps/web/src/reader-fullscreen";
import { Playback } from "../packages/protocol/domain";
const event = {
  code: "Period",
  key: ".",
  repeat: false,
  isComposing: false,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
};
const scope = { enabled: true, reader: true, blocked: false };
describe("R400 scoped keyboard preset", () => {
  it.each([
    ["Period", "togglePlay"],
    ["PageUp", "previousParagraph"],
    ["PageDown", "nextParagraph"],
    ["F5", "enterFullscreen"],
  ] as const)("%s maps to %s", (code, action) =>
    expect(r400Shortcut({ ...event, code }, scope)).toEqual({ action }),
  );
  it.each([".", "ю"])("uses code independently of layout %s", (key) =>
    expect(r400Shortcut({ ...event, key }, scope)).toEqual({
      action: "togglePlay",
    }),
  );
  it.each(["Escape", "KeyL", "ArrowUp", "Space"])(
    "does not invent an R400 action for %s",
    (code) => expect(r400Shortcut({ ...event, code }, scope)).toBeNull(),
  );
  it.each(["metaKey", "ctrlKey", "altKey", "isComposing"] as const)(
    "ignores %s",
    (flag) =>
      expect(r400Shortcut({ ...event, [flag]: true }, scope)).toBeNull(),
  );
  it.each([
    { ...scope, reader: false },
    { ...scope, enabled: false },
    { ...scope, blocked: true },
  ])("ignores inactive/editable/modal scope %j", (s) =>
    expect(r400Shortcut(event, s)).toBeNull(),
  );
  it("captures repeats without dispatching or allowing native PageDown/F5 fallback", () => {
    const p = new Playback();
    p.maximum = 1000;
    p.position = 100;
    p.playing = true;
    p.speed = 1.25;
    for (let i = 0; i < 36; i++) {
      const result = r400Shortcut(
        { ...event, code: "PageDown", repeat: i > 0 },
        scope,
      );
      expect(result).not.toBeNull();
      if (result?.action === "nextParagraph")
        p.command({ action: result.action }, [0, 200, 400, 600]);
    }
    expect([p.position, p.speed, p.playing]).toEqual([200, 1.25, true]);
    expect(r400Shortcut({ ...event, code: "F5", repeat: true }, scope)).toEqual(
      { action: null },
    );
  });
  it("toggles the shared engine exactly once without seeking or changing speed/countdown", () => {
    const p = new Playback();
    p.maximum = 1000;
    p.position = 420;
    p.speed = 1.25;
    p.countdown = 2;
    for (const repeat of [false, true, true]) {
      const a = r400Shortcut({ ...event, repeat }, scope)?.action;
      if (a === "togglePlay") p.command({ action: a });
    }
    expect([p.playing, p.position, p.speed, p.countdown]).toEqual([
      true,
      420,
      1.25,
      2,
    ]);
  });
  it("binds one live listener, reads the latest handler, and cleans up across mounts", () => {
    const target = new EventTarget(),
      a = vi.fn(),
      b = vi.fn();
    let current = a;
    const stop = bindReaderKeyboard(target, (e) => current(e));
    target.dispatchEvent(new Event("keydown"));
    current = b;
    target.dispatchEvent(new Event("keydown"));
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    stop();
    target.dispatchEvent(new Event("keydown"));
    expect(b).toHaveBeenCalledTimes(1);
    const stop2 = bindReaderKeyboard(target, b);
    target.dispatchEvent(new Event("keydown"));
    expect(b).toHaveBeenCalledTimes(2);
    stop2();
  });
});
class FullDoc extends EventTarget {
  fullscreenElement: Element | null = null;
  fullscreenEnabled = true;
  exitFullscreen = vi.fn(async () => {
    this.fullscreenElement = null;
    this.dispatchEvent(new Event("fullscreenchange"));
  });
}
const rootElement = {} as Element;
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
describe("authoritative Reader DOM fullscreen lifecycle", () => {
  it("requests synchronously once, follows actual entry/exit without receiving Escape, and never re-enters", async () => {
    const doc = new FullDoc(),
      change = vi.fn(),
      failure = vi.fn();
    let resolve!: () => void;
    const requestFullscreen = vi.fn(
      () => new Promise<void>((r) => (resolve = r)),
    );
    const controller = createReaderFullscreen(doc, change, failure);
    controller.enter({ requestFullscreen });
    controller.enter({ requestFullscreen });
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(change).not.toHaveBeenCalled();
    doc.fullscreenElement = rootElement;
    doc.dispatchEvent(new Event("fullscreenchange"));
    resolve();
    await flush();
    expect(change).toHaveBeenLastCalledWith(true);
    controller.enter({ requestFullscreen });
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    doc.fullscreenElement = null;
    doc.dispatchEvent(new Event("fullscreenchange"));
    expect(change).toHaveBeenLastCalledWith(false);
    doc.dispatchEvent(new Event("blur"));
    doc.dispatchEvent(new Event("focus"));
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(failure).not.toHaveBeenCalled();
    controller.dispose();
  });
  it("handles unsupported entry and promise rejection without retrying or fabricating fullscreen", async () => {
    const doc = new FullDoc(),
      change = vi.fn(),
      failure = vi.fn(),
      requestFullscreen = vi.fn(() => Promise.reject(Error("denied")));
    const c = createReaderFullscreen(doc, change, failure);
    doc.fullscreenEnabled = false;
    c.enter({ requestFullscreen });
    expect(requestFullscreen).not.toHaveBeenCalled();
    expect(failure).toHaveBeenLastCalledWith("enter");
    expect(change).toHaveBeenLastCalledWith(false);
    doc.fullscreenEnabled = true;
    c.enter({ requestFullscreen });
    await flush();
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(failure).toHaveBeenCalledTimes(2);
    c.dispose();
  });
  it("handles synchronous exceptions and fullscreenerror only once per request", async () => {
    const doc = new FullDoc(),
      failure = vi.fn(),
      c = createReaderFullscreen(doc, vi.fn(), failure);
    c.enter({
      requestFullscreen: () => {
        throw Error("blocked");
      },
    });
    expect(failure).toHaveBeenCalledTimes(1);
    let reject!: (error: Error) => void;
    c.enter({
      requestFullscreen: () => new Promise<void>((_, r) => (reject = r)),
    });
    doc.dispatchEvent(new Event("fullscreenerror"));
    reject(Error("same failure"));
    await flush();
    expect(failure).toHaveBeenCalledTimes(2);
    c.dispose();
  });
  it("follows manual API exit and reports rejected exit without changing actual fullscreen", async () => {
    const doc = new FullDoc(),
      change = vi.fn(),
      failure = vi.fn(),
      c = createReaderFullscreen(doc, change, failure);
    doc.fullscreenElement = rootElement;
    c.exit();
    await flush();
    expect(change).toHaveBeenLastCalledWith(false);
    doc.fullscreenElement = rootElement;
    doc.exitFullscreen.mockImplementationOnce(() =>
      Promise.reject(Error("denied")),
    );
    c.exit();
    await flush();
    expect(change).toHaveBeenLastCalledWith(true);
    expect(failure).toHaveBeenLastCalledWith("exit");
    c.dispose();
  });
  it("cleanup removes listeners and ignores a late request result", async () => {
    const doc = new FullDoc(),
      change = vi.fn(),
      failure = vi.fn(),
      c = createReaderFullscreen(doc, change, failure);
    let resolve!: () => void;
    c.enter({
      requestFullscreen: () => new Promise<void>((r) => (resolve = r)),
    });
    c.dispose();
    doc.fullscreenElement = rootElement;
    doc.dispatchEvent(new Event("fullscreenchange"));
    resolve();
    await flush();
    expect(change).not.toHaveBeenCalled();
    expect(failure).not.toHaveBeenCalled();
  });
});
