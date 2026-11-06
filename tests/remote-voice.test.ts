import { afterEach, describe, expect, it, vi } from "vitest";
import { validVoiceFrame } from "../packages/protocol/remote-voice";
import { VoiceFollow } from "../apps/web/src/voice-follow";
const session = crypto.randomUUID(),
  target = crypto.randomUUID();
const offer = {
  type: "voiceOffer",
  version: 1,
  session,
  target,
  language: "uk-UA",
};
const transcript = {
  type: "voiceTranscript",
  version: 1,
  session,
  sequence: 0,
  restart: true,
  text: "hello everyone",
};
afterEach(() => vi.unstubAllGlobals());
describe("remote voice boundaries", () => {
  it("validates bounded speech frames and rejects audio, wrong types, unknown fields and malformed grants", () => {
    for (const value of [
      offer,
      transcript,
      { type: "voiceStop", version: 1, session },
      { type: "voiceStatus", version: 1, session, status: "listening" },
      {
        type: "voiceStatus",
        version: 1,
        session,
        status: "error",
        error: "voicePermission",
      },
    ])
      expect(validVoiceFrame(value)).toBe(true);
    for (const value of [
      { ...offer, target: "bad" },
      { ...offer, language: "a".repeat(500) },
      { ...offer, version: 2 },
      { ...transcript, sequence: -1 },
      { ...transcript, sequence: 0.1 },
      { ...transcript, text: "x".repeat(601) },
      { ...transcript, text: " " },
      { ...transcript, audio: "base64" },
      { ...transcript, restart: 1 },
      {
        type: "voiceStatus",
        version: 1,
        session,
        status: "listening",
        error: "voicePermission",
      },
      {
        type: "voiceStatus",
        version: 1,
        session,
        status: "error",
        error: "unknown",
      },
    ])
      expect(validVoiceFrame(value)).toBe(false);
  });
  it("follows incoming words without starting a microphone, and ignores speech after Stop", () => {
    const constructor = vi.fn();
    vi.stubGlobal("window", { SpeechRecognition: constructor });
    const positions: number[] = [];
    const follower = new VoiceFollow(
      (p) => positions.push(p),
      () => {},
      { log: false },
    );
    follower.startRemote("Hello everyone and welcome to the show.", 0);
    follower.receiveTranscript("hello everyone and", true);
    expect(follower.position).toBeGreaterThan(0);
    expect(constructor).not.toHaveBeenCalled();
    follower.stop();
    const count = positions.length;
    follower.receiveTranscript("hello everyone and welcome to the show", false);
    expect(positions).toHaveLength(count);
    expect(follower.running).toBe(false);
  });
  it("captures phrases with session restarts without requiring script content on the phone", () => {
    let recognition: {
      onresult?: (e: unknown) => void;
      onstart?: () => void;
      onend?: () => void;
      start: () => void;
      abort: () => void;
    };
    class Recognizer {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      constructor() {
        recognition = this as unknown as typeof recognition;
      }
      start() {
        this.onstart?.();
      }
      abort() {}
    }
    vi.stubGlobal("window", { SpeechRecognition: Recognizer });
    const words = vi.fn();
    const capture = new VoiceFollow(
      () => {},
      () => {},
      { log: false },
    );
    capture.start("", "en-US", 0, words);
    const say = (text: string) =>
      recognition!.onresult?.({
        results: [Object.assign([{ transcript: text }], { isFinal: false })],
      });
    say("hello");
    say("hello everyone");
    expect(words.mock.calls).toEqual([
      ["hello", true],
      ["hello everyone", false],
    ]);
    capture.stop();
    expect(recognition!.onresult).toBeNull();
  });
});
