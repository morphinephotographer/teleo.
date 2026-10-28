import { formatSpeed, stepSpeed } from "../packages/protocol/speed";
import { expect, it } from "vitest";
import { Playback } from "../packages/protocol/domain";
it("speed steps are exact tenths, reversible and do not alter a paused reading state", () => {
  const p = new Playback();
  p.maximum = 1000;
  p.position = 320;
  p.countdown = 2;
  p.command({ action: "speedUp" });
  expect(p.speed).toBe(1.1);
  for (let n = 0; n < 9; n++) p.command({ action: "speedUp" });
  expect(p.speed).toBe(2);
  for (let n = 0; n < 10; n++) p.command({ action: "speedDown" });
  expect(p.speed).toBe(1);
  expect([p.position, p.playing, p.countdown]).toEqual([320, false, 2]);
});
it("legacy speeds step directionally without migrating on load", () => {
  const p = new Playback();
  p.speed = 0.75;
  expect(p.speed).toBe(0.75);
  p.command({ action: "speedUp" });
  expect(p.speed).toBe(0.8);
  p.speed = 0.85;
  p.command({ action: "speedDown" });
  expect(p.speed).toBe(0.8);
});
it("changing rate preserves the running clock and countdown rather than dropping a frame", () => {
  const p = new Playback();
  p.maximum = 1000;
  p.playing = true;
  p.countdown = 1;
  p.tick(0);
  p.tick(20);
  p.command({ action: "speedUp" });
  p.tick(40);
  expect(p.countdown).toBeCloseTo(0.96, 10);
  expect(p.playing).toBe(true);
});

it("formats canonical tenths and off-grid legacy values truthfully", () => {
  expect([0.9, 1, 1.1, 1.2, 2, 0.75, 1.25].map(formatSpeed)).toEqual([
    "0.9",
    "1.0",
    "1.1",
    "1.2",
    "2.0",
    "0.75",
    "1.25",
  ]);
});
it("does not cross non-tenth bounds or invent a boundary grid point", () => {
  expect(stepSpeed(0.55, -1, 0.55, 2.95)).toBe(0.55);
  expect(stepSpeed(0.55, 1, 0.55, 2.95)).toBe(0.6);
  expect(stepSpeed(2.9, 1, 0.55, 2.95)).toBe(2.9);
  expect(stepSpeed(2.95, -1, 0.55, 2.95)).toBe(2.9);
  const p = new Playback();
  for (let i = 0; i < 1000; i++) p.command({ action: "speedUp" });
  expect(p.speed).toBe(3);
  for (let i = 0; i < 1000; i++) p.command({ action: "speedDown" });
  expect(p.speed).toBe(0.5);
});
