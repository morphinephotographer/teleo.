import { expect, it, vi } from "vitest";
import { SeekQueue, REMOTE_SEEK_INTERVAL } from "../apps/web/src/text-position";
import { validControlCommand } from "../packages/protocol/control";
it("coalesces drag samples at 120ms, retains the final exact value and cancels stale work", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  const send = vi.fn(),
    queue = new SeekQueue(send);
  try {
    queue.push(0.01);
    for (let i = 1; i <= 20; i++) queue.push(i / 100, 100 + i / 10);
    expect(send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(119);
    expect(send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenLastCalledWith(0.2, 102);
    queue.push(0.3456789);
    vi.advanceTimersByTime(120);
    expect(send).toHaveBeenLastCalledWith(0.3456789, undefined);
    queue.push(0.7);
    queue.cancel();
    vi.advanceTimersByTime(1000);
    expect(send).toHaveBeenCalledTimes(3);
  } finally {
    queue.cancel();
    vi.useRealTimers();
  }
});
it("uses the existing target-scoped seek command with a bounded optional character anchor", () => {
  const c = { action: "seek", target: crypto.randomUUID(), value: 0.12345 };
  expect(validControlCommand(c)).toBe(true);
  expect(validControlCommand({ ...c, anchor: 123.75 })).toBe(true);
  for (const anchor of [-1, NaN, Infinity, 8192 * 256 + 1, "123"])
    expect(validControlCommand({ ...c, anchor })).toBe(false);
  expect(validControlCommand({ ...c, anchor: 3, unknown: 1 })).toBe(false);
  expect(validControlCommand({ ...c, target: "wrong", anchor: 3 })).toBe(false);
});

it("keeps sustained phone seeks within the host's existing message budget", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  const sent: number[] = [];
  const queue = new SeekQueue(
    () => sent.push(performance.now()),
    REMOTE_SEEK_INTERVAL,
  );
  try {
    for (let i = 0; i < 200; i++) {
      queue.push(i / 200);
      vi.advanceTimersByTime(16);
    }
    for (const start of sent) {
      const count = sent.filter(
        (at) => at >= start && at < start + 1000,
      ).length;
      expect(count).toBeLessThanOrEqual(5);
      expect(count + 7 + 4 + 2 + 1).toBeLessThanOrEqual(20);
    }
  } finally {
    queue.cancel();
    vi.useRealTimers();
  }
});
