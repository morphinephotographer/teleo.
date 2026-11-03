import { describe, expect, it } from "vitest";
import { joinResults, voiceOptions } from "../apps/web/src/voice-follow";

const list = (...phrases: string[]) =>
  phrases.map((transcript) =>
    Object.assign([{ transcript }], { isFinal: false }),
  );

describe("speech result handling", () => {
  it("keeps Chrome-style separate phrases", () => {
    expect(joinResults(list("add a test", " for mulch"))).toBe(
      "add a test for mulch",
    );
  });
  it("drops Safari's overlapping and repeated phrases", () => {
    expect(joinResults(list("привіт", "привіт світ"))).toBe("привіт світ");
    expect(joinResults(list("один два", "один два"))).toBe("один два");
    expect(joinResults(list("Один два три", "один два"))).toBe("Один два три");
  });
  it("ignores empty results", () => {
    expect(joinResults(list("", "  ", "слово"))).toBe("слово");
  });
});

describe("field-test switches", () => {
  it("reads mode, delay, reuse and language from the address", () => {
    expect(
      voiceOptions(
        "?voicelog=1&voicemode=continuous&voicedelay=900&voicereuse=0&voicelang=device",
      ),
    ).toEqual({
      log: true,
      mode: "continuous",
      delay: 900,
      reuse: false,
      lang: "device",
    });
  });
  it("ignores missing or invalid values", () => {
    expect(voiceOptions("?voicemode=fast&voicedelay=-3")).toEqual({
      log: false,
      mode: undefined,
      delay: undefined,
      reuse: undefined,
      lang: undefined,
    });
  });
});
