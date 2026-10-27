import { beforeEach, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { openDB } from "idb";
import { storage } from "../apps/web/src/storage";
import { createScript, Playback } from "../packages/protocol/domain";
import { HostPreview } from "../apps/web/src/host-preview";
import type { RemoteLink } from "../apps/web/src/remote";
import { DraftWriter } from "../apps/web/src/drafts";
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});
for (const deleted of [false, true])
  it(`rejects stale tab writes, including deleted=${deleted}`, async () => {
    const original = createScript("shared", "original");
    await storage.save(original);
    await storage.list();
    const other = {
      ...original,
      body: "newer in another tab",
      ...(deleted ? { deletedAt: new Date().toISOString() } : {}),
    };
    const db = await openDB("teleo", 2);
    await db.put("scripts", other);
    await expect(
      storage.save({ ...original, body: "stale tab" }, true),
    ).rejects.toThrow("saveConflict");
    expect(await db.get("scripts", original.scriptId)).toEqual(other);
    db.close();
  });
it("clamps paused playback after the available layout shrinks", () => {
  const engine = new Playback();
  engine.maximum = 900;
  engine.position = 850;
  engine.maximum = 100;
  expect(engine.tick(0)).toBe(100);
  engine.maximum = 0;
  expect(engine.tick(100)).toBe(0);
});
it("retains recovery and reports concurrent-write conflicts distinctly", async () => {
  const status = vi.fn(),
    recovery = vi.fn();
  const writer = new DraftWriter(
    vi.fn().mockRejectedValue(Error("saveConflict")),
    recovery,
    status,
  );
  const script = createScript("conflict", "keep draft");
  writer.enqueue(script);
  await writer.flush();
  expect(status).toHaveBeenLastCalledWith("saveConflict");
  expect(recovery).not.toHaveBeenCalledWith(script.scriptId, null);
  await expect(writer.requireSaved()).rejects.toThrow();
});

it("recovers conflicting drafts as idempotent copies, preserving original edits and tombstones", async () => {
  const original = createScript("shared", "original");
  await storage.save(original);
  const draft = { ...original, body: "unsaved draft" };
  const first = await storage.recover(draft, "Recovered draft");
  expect(first.scriptId).not.toBe(original.scriptId);
  expect(first.body).toBe(draft.body);
  expect((await storage.recover(draft, "Other locale")).scriptId).toBe(
    first.scriptId,
  );
  expect(await storage.list()).toHaveLength(2);
  await storage.save({ ...original, deletedAt: new Date().toISOString() });
  const recovered = await storage.recover(
    { ...draft, body: "different draft" },
    "Recovered draft",
  );
  expect(recovered.scriptId).not.toBe(original.scriptId);
  const db = await openDB("teleo", 2);
  expect((await db.get("scripts", original.scriptId)).deletedAt).toBeTruthy();
  db.close();
});
it("recovery validates data, preserves matching scripts and restores genuinely unsaved new scripts", async () => {
  await expect(
    storage.recover({ body: "malformed" }, "Recovered"),
  ).rejects.toThrow();
  const original = createScript("new", "draft");
  expect(await storage.recover(original, "Recovered")).toEqual(original);
  expect(
    await storage.recover(
      { ...original, updatedAt: new Date(Date.now() + 1000).toISOString() },
      "Recovered",
    ),
  ).toEqual(original);
  expect(await storage.list()).toHaveLength(1);
});

it("preview compilation failure revokes permission rather than keeping stale private text", async () => {
  vi.useFakeTimers();
  const digest = vi
    .spyOn(crypto.subtle, "digest")
    .mockRejectedValue(Error("digest unavailable"));
  const link = { send: vi.fn(), previewPermission: vi.fn() };
  const error = vi.fn();
  const preview = new HostPreview(link as unknown as RemoteLink, error);
  try {
    await preview.script(createScript("private", "sensitive"));
    await vi.runAllTimersAsync();
    expect(link.previewPermission).toHaveBeenCalledWith(false);
    expect(error).toHaveBeenCalledOnce();
    expect(link.send).not.toHaveBeenCalled();
  } finally {
    preview.dispose();
    digest.mockRestore();
    vi.useRealTimers();
  }
});

it("recovers large local TXT drafts without applying the smaller portable JSON import body cap", async () => {
  const script = createScript("Large TXT draft", "x".repeat(2_000_001));
  const recovered = await storage.recover(script, "Recovered draft");
  expect(recovered.body).toBe(script.body);
  expect((await storage.list())[0].body.length).toBe(2_000_001);
});

it("does not mistake preserved extension preferences for a concurrent edit after IndexedDB clones them", async () => {
  const script = createScript("Imported preferences", "original");
  const preferences = {
    ...script.preferences,
    vendorExtension: { enabled: true },
  };
  await storage.save({ ...script, preferences });
  await storage.save({ ...script, preferences, body: "edited" }, true);
  expect((await storage.list())[0].body).toBe("edited");
});
