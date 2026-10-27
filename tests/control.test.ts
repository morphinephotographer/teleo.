import { describe, it, expect } from "vitest";
import {
  validControlCommand,
  validControlState,
  validPlaybackState,
  timeAt,
  clockTime,
} from "../packages/protocol/control";
const target = crypto.randomUUID();
const controls = {
  version: 1,
  target,
  maximum: 400,
  fontSize: 68,
  lineHeight: 1.5,
  textWidth: 1300,
  mirrorHorizontal: false,
  mirrorVertical: false,
  focusLine: true,
  countdownSeconds: 3,
};
describe("v0.6 approved controls", () => {
  it("keeps legacy commands and rejects missing, unexpected or out-of-range values", () => {
    expect(validControlCommand({ action: "play" })).toBe(true);
    for (const value of [0, 0.5, 1])
      expect(validControlCommand({ action: "seek", target, value })).toBe(true);
    for (const value of [-1, NaN, Infinity, 1.01])
      expect(validControlCommand({ action: "seek", target, value })).toBe(
        false,
      );
    expect(validControlCommand({ action: "seek", value: 0.5 })).toBe(false);
    expect(
      validControlCommand({
        action: "seek",
        target,
        value: 0.5,
        body: "private",
      }),
    ).toBe(false);
  });
  it("allowlists typography and secondary preferences with exact types and bounds", () => {
    for (const [key, value] of [
      ["fontSize", 68],
      ["lineHeight", 1.5],
      ["textWidth", 1300],
      ["countdownSeconds", 3],
      ["focusLine", false],
      ["mirrorHorizontal", true],
    ] as const)
      expect(
        validControlCommand({ action: "setPreference", target, key, value }),
      ).toBe(true);
    for (const [key, value] of [
      ["fontSize", 101],
      ["lineHeight", 0],
      ["textWidth", 100],
      ["countdownSeconds", 11],
      ["focusLine", 1],
      ["body", "private"],
      ["__proto__", 1],
    ])
      expect(
        validControlCommand({ action: "setPreference", target, key, value }),
      ).toBe(false);
  });
  it("transfers only numeric/boolean control metadata and preserves old state compatibility", () => {
    expect(validControlState(controls)).toBe(true);
    expect(validControlState({...controls,marks:[0,.2,1]})).toBe(true);
    expect(validControlState({...controls,marks:[NaN]})).toBe(false);
    expect(validControlState({...controls,marks:Array(13).fill(0)})).toBe(false);
    expect(JSON.stringify({type:"ack",id:crypto.randomUUID(),state:{playing:true,speed:3,position:1e8,controls:{...controls,marks:Array(12).fill(.1234)}}}).length).toBeLessThan(1024);
    expect(validControlState({ ...controls, title: "private" })).toBe(false);
    expect(validControlState({ ...controls, maximum: Infinity })).toBe(false);
    expect(validPlaybackState({ playing: false, speed: 1, position: 0 })).toBe(
      true,
    );
    expect(
      validPlaybackState({ playing: false, speed: 1, position: 0, controls }),
    ).toBe(true);
    expect(
      validPlaybackState({
        playing: false,
        speed: 1,
        position: 0,
        controls: { ...controls, version: 2 },
      }),
    ).toBe(false);
    expect(
      validPlaybackState({ playing: false, speed: 1, position: 0, extra: 1 }),
    ).toBe(false);
  });
  it("derives finite estimated time from actual scroll distance and existing 40px/s speed model", () => {
    expect(timeAt(80, 400, 2)).toEqual({ elapsed: 1, remaining: 4 });
    expect(timeAt(800, 400, 1)).toEqual({ elapsed: 10, remaining: 0 });
    for (const pair of [
      [0, 0, 1],
      [1, 100, NaN],
      [1, Infinity, 1],
    ])
      expect(timeAt(...(pair as [number, number, number]))).toEqual({
        elapsed: 0,
        remaining: 0,
      });
    expect(clockTime(88)).toBe("01:28");
    expect(clockTime(NaN)).toBe("00:00");
  });
});
