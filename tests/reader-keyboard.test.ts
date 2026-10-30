import { expect, it } from "vitest";
import { readerShortcut } from "../apps/web/src/reader-keyboard";
const event = {
  code: "Space",
  repeat: false,
  isComposing: false,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
};
const scope = { reader: true, blocked: false };
it.each([
  ["Space", "togglePlay"],
  ["ArrowLeft", "lineBack"],
  ["ArrowRight", "lineForward"],
  ["ArrowUp", "speedUp"],
  ["ArrowDown", "speedDown"],
])("maps browser reading key %s", (code, action) => {
  expect(readerShortcut({ ...event, code }, scope)).toEqual({ action });
  expect(readerShortcut({ ...event, code, repeat: true }, scope)).toEqual({
    action: null,
  });
});
it.each(["metaKey", "ctrlKey", "altKey", "isComposing"])(
  "preserves %s guards, including prototype event properties",
  (flag) => {
    const inherited = Object.create({ ...event, [flag]: true });
    expect(readerShortcut(inherited, scope)).toBeNull();
  },
);
it("ignores editor, fields, dialogs and unrelated hardware keys", () => {
  expect(readerShortcut(event, { reader: false, blocked: false })).toBeNull();
  expect(readerShortcut(event, { reader: true, blocked: true })).toBeNull();
  expect(readerShortcut({ ...event, code: "PageDown" }, scope)).toBeNull();
});
