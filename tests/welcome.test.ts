import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { openDB } from "idb";
import { storage } from "../apps/web/src/storage";
import { createScript } from "../packages/protocol/domain";
import { welcomeBodies, welcomeId } from "../apps/web/src/welcome";
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});
describe("Welcome onboarding storage", () => {
  for (const locale of ["en", "uk", "ru"] as const)
    it(`creates exactly Welcome in ${locale}`, async () => {
      const result = await storage.welcome(locale, { automatic: true });
      expect(result.selected).toMatchObject({
        scriptId: welcomeId,
        title: "Welcome",
        body: welcomeBodies[locale],
      });
      expect(
        (await storage.welcome("en", { automatic: true })).selected,
      ).toBeUndefined();
      expect(await storage.list()).toHaveLength(1);
    });
  it("serializes simultaneous first launches and restoration requests", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        storage.welcome("uk", { automatic: true }),
      ),
    );
    expect(results.filter((result) => result.selected)).toHaveLength(1);
    await Promise.all(
      Array.from({ length: 12 }, () =>
        storage.welcome("ru", { restore: true }),
      ),
    );
    expect(await storage.list()).toHaveLength(1);
  });
  it("does not overwrite a pre-existing script", async () => {
    const script = createScript("Welcome", "User-owned Welcome");
    await storage.save(script);
    expect(
      (await storage.welcome("en", { automatic: true })).selected,
    ).toBeUndefined();
    expect(await storage.list()).toEqual([script]);
  });
  it("treats a legacy empty database as a returning installation", async () => {
    const old = await openDB("teleo", 1, {
      upgrade(db) {
        db.createObjectStore("scripts", { keyPath: "scriptId" });
        db.createObjectStore("folders", { keyPath: "folderId" });
        db.createObjectStore("revisions", { keyPath: "revisionId" });
      },
    });
    old.close();
    const result = await storage.welcome("en", { automatic: true });
    expect(result.settings.handled).toBe(true);
    expect(result.scripts).toEqual([]);
  });
  it("reports a blocked legacy upgrade without deleting or hanging the library", async () => {
    const old = await openDB("teleo", 1, {
      upgrade(db) {
        db.createObjectStore("scripts", { keyPath: "scriptId" });
        db.createObjectStore("revisions", { keyPath: "revisionId" });
        db.createObjectStore("folders", { keyPath: "folderId" });
      },
    });
    const script = createScript("Legacy", "Keep this content");
    await old.put("scripts", script);
    await expect(storage.list()).rejects.toThrow("databaseBlocked");
    old.close();
    expect(await storage.list()).toEqual([script]);
    expect(
      (await storage.welcome("en", { automatic: true })).selected,
    ).toBeUndefined();
  });
  it("releases current connections for a later non-destructive schema upgrade", async () => {
    const first = (await storage.welcome("en", { automatic: true })).selected!;
    const next = await openDB("teleo", 3);
    expect(await next.get("scripts", first.scriptId)).toEqual(first);
    next.close();
  });
  it("does not seed histories, recovered drafts or deliberately disabled onboarding", async () => {
    await storage.autoWelcome(false);
    expect(
      (await storage.welcome("en", { automatic: true })).selected,
    ).toBeUndefined();
    await storage.autoWelcome(true);
    expect(
      (await storage.welcome("en", { automatic: true })).selected,
    ).toBeUndefined();
    expect(await storage.list()).toEqual([]);
    const result = await storage.welcome("ru", { restore: true });
    expect(result.selected?.body).toBe(welcomeBodies.ru);
  });
  for (const evidence of [{ returning: true }, { recovered: true }])
    it(`suppresses first-run creation with ${JSON.stringify(evidence)}`, async () => {
      expect(
        (await storage.welcome("en", { automatic: true, ...evidence }))
          .selected,
      ).toBeUndefined();
    });
  it("never recreates a deleted demo automatically; manual restore works with auto disabled", async () => {
    const first = (await storage.welcome("en", { automatic: true })).selected!;
    await storage.save({ ...first, deletedAt: new Date().toISOString() });
    expect(
      (await storage.welcome("ru", { automatic: true })).selected,
    ).toBeUndefined();
    expect(await storage.list()).toEqual([]);
    await storage.autoWelcome(false);
    expect(
      (await storage.welcome("ru", { automatic: true })).selected,
    ).toBeUndefined();
    const restored = (await storage.welcome("uk", { restore: true })).selected!;
    expect(restored.scriptId).not.toBe(first.scriptId);
    expect(restored.body).toBe(welcomeBodies.uk);
    expect(
      (await storage.welcome("ru", { restore: true })).selected?.scriptId,
    ).toBe(restored.scriptId);
  });
  it("preserves modified content and makes at most one fresh manually restored sample", async () => {
    const first = (await storage.welcome("en", { automatic: true })).selected!;
    const edited = {
      ...first,
      title: "My edit",
      body: "Keep my words",
      preferences: { ...first.preferences, speed: 2 },
    };
    await storage.save(edited, true);
    const restored = (await storage.welcome("ru", { restore: true })).selected!;
    expect(restored.body).toBe(welcomeBodies.ru);
    expect(
      (await storage.welcome("uk", { restore: true })).selected?.scriptId,
    ).toBe(restored.scriptId);
    expect(await storage.list()).toContainEqual(edited);
    expect(await storage.list()).toHaveLength(2);
  });
  it("does not treat formatting changes as permission to reset preferences", async () => {
    const first = (await storage.welcome("en", { automatic: true })).selected!;
    await storage.save({
      ...first,
      preferences: { ...first.preferences, fontSize: 60 },
    });
    expect(
      (await storage.welcome("ru", { restore: true })).selected?.preferences
        .fontSize,
    ).toBe(60);
  });
});
