import { expect, it } from "vitest";
import { RemoteTextFollow } from "../apps/web/src/remote-text-follow";
const sample = (
  offset: number,
  timestamp: number,
  playing = false,
  position = offset,
) => ({ offset, timestamp, state: { playing, position } });
it("interpolates a seek over individual frames and settles exactly without overshoot", () => {
  const follow = new RemoteTextFollow();
  follow.receive(sample(100, 1), 0);
  follow.step(16);
  follow.receive(sample(500, 2), 20, false);
  const frames = Array.from({ length: 40 }, (_, i) =>
    follow.step(36 + i * 16)!,
  );
  expect(frames[0].offset).toBeGreaterThan(100);
  expect(frames[0].offset).toBeLessThan(500);
  expect(
    frames.every(
      (f, i) => f.offset <= 500 && (!i || f.offset >= frames[i - 1].offset),
    ),
  ).toBe(true);
  expect(frames.at(-1)).toEqual({ offset: 500, active: false });
  follow.receive(sample(200, 3), 700, false);
  const reversed = Array.from({ length: 40 }, (_, i) =>
    follow.step(716 + i * 16)!,
  );
  expect(
    reversed.every(
      (f, i) => f.offset >= 200 && (!i || f.offset <= reversed[i - 1].offset),
    ),
  ).toBe(true);
  expect(reversed.at(-1)).toEqual({ offset: 200, active: false });
});
it("bounds playback prediction, rejects stale samples and stops on the authoritative pause", () => {
  const follow = new RemoteTextFollow();
  follow.receive(sample(100, 1000, true), 0);
  follow.receive(sample(125, 1250, true), 250);
  const moving = Array.from({ length: 80 }, (_, i) =>
    follow.step(266 + i * 16)!,
  );
  expect(moving[8].offset).toBeGreaterThan(125);
  expect(moving.at(-1)).toEqual({ offset: 150, active: false });
  follow.receive(sample(9000, 1200, true), 1600);
  expect(follow.step(1616)!.offset).toBe(150);
  follow.receive(sample(130, 1500, false), 1700);
  for (let n = 1; n <= 40; n++) follow.step(1700 + n * 16);
  expect(follow.step(2400)).toEqual({ offset: 130, active: false });
  follow.reset();
  expect(follow.step(2500)).toBeNull();
});
