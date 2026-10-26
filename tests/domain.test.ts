import { describe, it, expect, beforeEach } from "vitest";
import fixture from "../contracts/script-v1.json";
import "fake-indexeddb/auto";
import {
  Playback,
  createScript,
  parseBundle,
  exportBundle,
  validCommand,
  keyboardSafe,
  standardKeys,
} from "../packages/protocol/domain";
import { dictionaries, detectLocale } from "../apps/web/src/i18n";
import { storage } from "../apps/web/src/storage";
describe("elapsed-time engine", () => {
  it("moves equally at 60 and 120 Hz", () => {
    const run = (hz: number) => {
      const p = new Playback();
      p.maximum = 1000;
      p.command({ action: "play" });
      for (let i = 0; i <= hz; i++) p.tick((i * 1000) / hz);
      return p.position;
    };
    expect(run(60)).toBeCloseTo(40);
    expect(run(120)).toBeCloseTo(40);
  });
  it("caps stalls and preserves pause/resume", () => {
    const p = new Playback();
    p.maximum = 1000;
    p.command({ action: "play" });
    p.tick(0);
    p.tick(10000);
    expect(p.position).toBe(2);
    p.command({ action: "pause" });
    p.tick(20000);
    expect(p.position).toBe(2);
    p.command({ action: "play" });
    p.tick(30000);
    expect(p.position).toBe(2);
  });
  it("ends cleanly, restarts and skips paragraphs", () => {
    const p = new Playback();
    p.maximum = 100;
    p.command({ action: "nextParagraph" }, [0, 50, 90]);
    expect(p.position).toBe(50);
    p.command({ action: "previousParagraph" }, [0, 50, 90]);
    expect(p.position).toBe(0);
    p.position = 99;
    p.command({ action: "play" });
    p.tick(0);
    p.tick(50);
    expect(p.position).toBe(100);
    expect(p.playing).toBe(false);
    p.command({ action: "restart" });
    expect(p.position).toBe(0);
  });
  it("clamps speed and validates all commands", () => {
    const p = new Playback();
    p.maximum = 100;
    for (let i = 0; i < 30; i++) p.command({ action: "speedUp" });
    expect(p.speed).toBe(3);
    for (let i = 0; i < 30; i++) p.command({ action: "speedDown" });
    expect(p.speed).toBe(0.5);
    expect(validCommand({ action: "setSpeed", value: NaN })).toBe(false);
    expect(validCommand({ action: "play", body: "secret" })).toBe(false);
    expect(validCommand({ action: "play", value: 1 })).toBe(false);
  });
  it("uses idempotent play/pause and bounded countdown", () => {
    const p = new Playback();
    p.maximum = 100;
    p.command({ action: "play" });
    p.command({ action: "play" });
    expect(p.playing).toBe(true);
    p.countdown = 0.05;
    p.tick(0);
    p.tick(50);
    expect(p.position).toBe(0);
    p.tick(100);
    expect(p.position).toBe(2);
    p.suspend();
    expect(p.playing).toBe(false);
  });
});
describe("portable storage", () => {
  let id = "";
  beforeEach(() => {
    id = crypto.randomUUID();
  });
  it("roundtrips Unicode, RTL, empty lines and empty scripts", () => {
    for (const body of ["", "🌍 Привіт\n\nمرحبا\n", "a".repeat(100000)]) {
      const s = createScript("Тест", body);
      expect(parseBundle(exportBundle([s]))).toEqual([s]);
    }
  });
  it("rejects invalid schema, limits and preference types", () => {
    expect(() => parseBundle('{"version":2,"scripts":[]}')).toThrow();
    const s = createScript("a");
    s.preferences.fontSize = NaN;
    expect(() => parseBundle(exportBundle([s]))).toThrow();
  });
  it("saves, revises, restores and retains tombstones", async () => {
    const s = { ...createScript("Original", "a\n\nb"), scriptId: id };
    await storage.save(s, true);
    s.body = "new";
    await storage.save(s, true);
    expect((await storage.list()).find((x) => x.scriptId === id)?.body).toBe(
      "new",
    );
    const rev = await storage.revisions(id);
    expect(rev[0].body).toBe("a\n\nb");
    await storage.save({ ...s, body: rev[0].body }, true);
    await storage.save({ ...s, deletedAt: new Date().toISOString() });
    expect((await storage.list()).some((x) => x.scriptId === id)).toBe(false);
  });
  it("bounds revisions and safely removes folders", async () => {
    const f = { folderId: crypto.randomUUID(), title: "Folder" };
    await storage.folder(f);
    const s = { ...createScript("a"), scriptId: id, folderId: f.folderId };
    for (let i = 0; i < 35; i++) {
      s.body = String(i);
      await storage.save(s, true);
    }
    expect((await storage.revisions(id)).length).toBe(30);
    await storage.removeFolder(f.folderId);
    expect(
      (await storage.list()).find((x) => x.scriptId === id)?.folderId,
    ).toBeUndefined();
  });
});
describe("keyboard adapter", () => {
  const event = {
    repeat: false,
    isComposing: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
  };
  it("excludes typing and non-reader contexts", () => {
    expect(keyboardSafe(event, true, true)).toBe(false);
    expect(keyboardSafe(event, false, false)).toBe(false);
  });
  for (const prop of [
    "repeat",
    "isComposing",
    "metaKey",
    "ctrlKey",
    "altKey",
  ] as const)
    it(`excludes ${prop}`, () =>
      expect(keyboardSafe({ ...event, [prop]: true }, false, true)).toBe(
        false,
      ));
  it("normalizes delivered HID codes", () => {
    expect(keyboardSafe(event, false, true)).toBe(true);
    expect(standardKeys.Space).toBe("togglePlay");
    expect(standardKeys.KeyM).toBe("mirror");
  });
});
describe("localization", () => {
  for (const locale of ["en", "uk", "ru"] as const)
    it(`${locale} has complete nonempty key parity`, () => {
      expect(Object.keys(dictionaries[locale]).sort()).toEqual(
        Object.keys(dictionaries.en).sort(),
      );
      expect(Object.values(dictionaries[locale]).every((x) => x.trim())).toBe(
        true,
      );
    });
  it("detects regional languages, overrides and fallback", () => {
    expect(detectLocale(["uk-UA", "en-US"])).toBe("uk");
    expect(detectLocale(["ru-RU"])).toBe("ru");
    expect(detectLocale(["fr-FR"])).toBe("en");
    expect(detectLocale(["uk"], "ru")).toBe("ru");
  });
});

it("reads canonical cross-platform fixture", () => {
  const scripts = parseBundle(JSON.stringify(fixture));
  expect(scripts[0].body).toBe(fixture.scripts[0].body);
  expect(scripts[0].preferences.speed).toBe(1.25);
});
