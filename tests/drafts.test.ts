import { expect, it, vi } from "vitest";
import { DraftWriter } from "../apps/web/src/drafts";
import { createScript } from "../packages/protocol/domain";
function deferred() {
  let resolve!: () => void, reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
it("completion of an older write keeps the newer recovery draft and Saving state", async () => {
  const first = deferred();
  const save = vi
    .fn()
    .mockImplementationOnce(() => first.promise)
    .mockResolvedValue(undefined);
  const recovery = vi.fn(),
    status = vi.fn();
  const writer = new DraftWriter(save, recovery, status);
  const old = createScript("draft", "old");
  const fresh = { ...old, body: "newer words" };
  writer.enqueue(old);
  const oldWrite = writer.flush();
  await Promise.resolve();
  writer.enqueue(fresh);
  first.resolve();
  await oldWrite;
  expect(recovery).not.toHaveBeenCalledWith(old.scriptId, null);
  expect(status).toHaveBeenLastCalledWith("saving");
  await writer.flush();
  expect(save).toHaveBeenLastCalledWith(fresh);
  expect(recovery).toHaveBeenLastCalledWith(old.scriptId, null);
  expect(status).toHaveBeenLastCalledWith("saved");
});
it("an older completion cannot acknowledge a newer already queued write", async () => {
  const first = deferred(),
    second = deferred();
  const save = vi
    .fn()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const recovery = vi.fn(),
    status = vi.fn();
  const writer = new DraftWriter(save, recovery, status);
  const old = createScript("draft");
  writer.enqueue(old);
  const a = writer.flush();
  await Promise.resolve();
  writer.enqueue({ ...old, preferences: { ...old.preferences, speed: 2 } });
  const b = writer.flush();
  first.resolve();
  await a;
  expect(status).toHaveBeenLastCalledWith("saving");
  expect(recovery).not.toHaveBeenCalledWith(old.scriptId, null);
  second.resolve();
  await b;
  expect(status).toHaveBeenLastCalledWith("saved");
});
it("failed stale writes cannot overwrite a newer queued snapshot", async () => {
  const first = deferred();
  const save = vi
    .fn()
    .mockReturnValueOnce(first.promise)
    .mockResolvedValue(undefined);
  const writer = new DraftWriter(save, vi.fn(), vi.fn());
  const old = createScript("draft");
  const fresh = { ...old, body: "recover me" };
  writer.enqueue(old);
  const a = writer.flush();
  await Promise.resolve();
  writer.enqueue(fresh);
  first.reject(Error("disk unavailable"));
  await a;
  await writer.flush();
  await writer.flush();
  expect(save.mock.calls.map((c) => c[0].body)).toEqual(["", "recover me"]);
});
it("a latest failed draft stays recoverable and can be retried", async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(Error("disk unavailable"))
    .mockResolvedValue(undefined);
  const recovery = vi.fn(),
    status = vi.fn();
  const writer = new DraftWriter(save, recovery, status);
  const script = createScript("draft", "keep");
  writer.enqueue(script);
  await writer.flush();
  expect(status).toHaveBeenLastCalledWith("saveError");
  expect(recovery).not.toHaveBeenCalledWith(script.scriptId, null);
  await writer.flush();
  expect(status).toHaveBeenLastCalledWith("saved");
  expect(save).toHaveBeenCalledTimes(2);
});

it("destructive operations require successful durable writes, while recovery stays retryable", async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(Error("quota"))
    .mockResolvedValue(undefined);
  const recovery = vi.fn();
  const writer = new DraftWriter(save, recovery, vi.fn());
  const script = createScript("safe", "unsaved edits");
  writer.enqueue(script);
  await expect(writer.requireSaved()).rejects.toThrow("saveError");
  expect(recovery).not.toHaveBeenCalledWith(script.scriptId, null);
  await expect(writer.requireSaved()).resolves.toBeUndefined();
  expect(recovery).toHaveBeenLastCalledWith(script.scriptId, null);
});
