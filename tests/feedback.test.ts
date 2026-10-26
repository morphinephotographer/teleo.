import { afterEach, expect, it, vi } from "vitest";
import {
  feedback,
  feedbackAvailable,
  setFeedback,
} from "../apps/web/src/feedback";
afterEach(() => vi.unstubAllGlobals());
it("unsupported browsers expose no vibration capability and never throw", () => {
  vi.stubGlobal("navigator", {});
  expect(feedbackAvailable()).toBe(false);
  expect(() => feedback()).not.toThrow();
});
it("a supported API is optional and a throwing API cannot block the action", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => values.get(k) || null,
    setItem: (k: string, v: string) => values.set(k, v),
  });
  const vibrate = vi.fn(() => true);
  vi.stubGlobal("navigator", { vibrate });
  feedback();
  expect(vibrate).toHaveBeenCalledWith(12);
  setFeedback(false);
  feedback();
  expect(vibrate).toHaveBeenCalledTimes(1);
  setFeedback(true);
  vibrate.mockImplementation(() => {
    throw Error("denied");
  });
  expect(() => feedback()).not.toThrow();
});
