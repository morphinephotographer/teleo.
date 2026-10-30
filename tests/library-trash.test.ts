import { beforeEach, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { openDB } from "idb";
import { storage } from "../apps/web/src/storage";
import { createScript } from "../packages/protocol/domain";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

it("restores a soft-deleted document with its folder, preferences and revisions intact", async () => {
  const script = {
    ...createScript("Original", "Original words"),
    folderId: "folder",
  };
  await storage.save(script);
  const edited = {
    ...script,
    body: "Latest words",
    preferences: { ...script.preferences, speed: 1.7 },
  };
  await storage.save(edited, true);
  await storage.save({ ...edited, deletedAt: new Date().toISOString() });
  expect(await storage.list()).toEqual([]);
  const [deleted] = await storage.trash();
  await storage.save({ ...deleted, deletedAt: undefined });
  expect(await storage.list()).toEqual([{ ...edited, deletedAt: undefined }]);
  expect(await storage.trash()).toEqual([]);
  expect(await storage.revisions(script.scriptId)).toMatchObject([
    { body: "Original words" },
  ]);
});

it("permanent deletion removes only the chosen deleted document and its revisions", async () => {
  const chosen = createScript("Chosen", "Before");
  const keep = createScript("Keep", "Keep before");
  for (const s of [chosen, keep]) {
    await storage.save(s);
    await storage.save(
      { ...s, body: "After", deletedAt: new Date().toISOString() },
      true,
    );
  }
  await storage.purge(chosen.scriptId);
  expect(await storage.trash()).toMatchObject([{ scriptId: keep.scriptId }]);
  expect(await storage.revisions(chosen.scriptId)).toEqual([]);
  expect(await storage.revisions(keep.scriptId)).toHaveLength(1);
  await expect(storage.purge(chosen.scriptId)).rejects.toThrow("saveConflict");
});

it("refuses to purge active documents or stale trash entries restored in another tab", async () => {
  const script = createScript("Keep me", "Safe words");
  await storage.save(script);
  await expect(storage.purge(script.scriptId)).rejects.toThrow("saveConflict");
  await storage.save({ ...script, deletedAt: new Date().toISOString() });
  await storage.trash();
  const otherTab = await openDB("teleo", 2);
  await otherTab.put("scripts", script);
  await expect(storage.purge(script.scriptId)).rejects.toThrow("saveConflict");
  expect(await storage.list()).toEqual([script]);
  otherTab.close();
});
