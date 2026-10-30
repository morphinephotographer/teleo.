import { openDB } from "idb";
import { parseBundle } from "../../../packages/protocol/domain";
import { localGet, localSet, type Locale } from "./i18n";
import {
  createWelcome,
  welcomeBodies,
  pristineWelcome,
  welcomeId,
  type WelcomeSettings,
} from "./welcome";
import type {
  Script,
  Revision,
  Folder,
} from "../../../packages/protocol/domain";
// Per-tab snapshots, updated only after an explicit read or a committed local write.
// Compare inside the write transaction: timestamps alone are not unique revisions.
const loaded = new Map<string, Script>();
const remember = (s: Script) =>
  loaded.set(s.scriptId, { ...s, preferences: { ...s.preferences } });
function same(a: Script, b: Script, dates = true) {
  return (
    a.title === b.title &&
    a.body === b.body &&
    a.folderId === b.folderId &&
    a.deletedAt === b.deletedAt &&
    a.createdAt === b.createdAt &&
    (!dates || a.updatedAt === b.updatedAt) &&
    // IndexedDB clones extension objects too; object identity is not a revision.
    JSON.stringify(a.preferences) === JSON.stringify(b.preferences)
  );
}
const database = () => {
  let abandoned = false;
  return new Promise<Awaited<ReturnType<typeof openDB>>>((resolve, reject) => {
    void openDB("teleo", 2, {
      blocked() {
        abandoned = true;
        reject(Error("databaseBlocked"));
      },
      upgrade(db, previous) {
        if (previous < 1) {
          db.createObjectStore("scripts", { keyPath: "scriptId" });
          db.createObjectStore("revisions", { keyPath: "revisionId" });
          db.createObjectStore("folders", { keyPath: "folderId" });
        }
        if (previous < 2)
          db.createObjectStore("onboarding").put(
            {
              handled: previous > 0,
              autoCreate: localGet("teleo.demo.auto") !== "false",
              records: [],
            } satisfies WelcomeSettings,
            "welcome",
          );
      },
      blocking(_current, _next, event) {
        (event.target as IDBDatabase).close();
      },
    }).then((db) => {
      if (abandoned) db.close();
      else resolve(db);
    }, reject);
  });
};
export const storage = {
  async welcome(
    locale: Locale,
    options: {
      automatic?: boolean;
      returning?: boolean;
      recovered?: boolean;
      restore?: boolean;
      localize?: Script[];
    } = {},
  ) {
    const db = await database();
    // A shared read/write transaction serializes initialization, normal writes and other tabs.
    const tx = db.transaction(
      ["scripts", "revisions", "folders", "onboarding"],
      "readwrite",
    );
    const scripts: Script[] = await tx.objectStore("scripts").getAll();
    const settings: WelcomeSettings = await tx
      .objectStore("onboarding")
      .get("welcome");
    const preference = localGet("teleo.demo.auto");
    if (preference === "true" || preference === "false")
      settings.autoCreate = preference === "true";
    let selected: Script | undefined;
    if (options.restore) selected = pristineWelcome(scripts, settings);
    const first = options.automatic && !settings.handled;
    let create = false;
    if (first) {
      settings.handled = true;
      create =
        settings.autoCreate &&
        !options.returning &&
        !options.recovered &&
        scripts.length === 0 &&
        (await tx.objectStore("folders").count()) === 0 &&
        (await tx.objectStore("revisions").count()) === 0;
    }
    if ((options.restore && !selected) || create) {
      selected = createWelcome(
        locale,
        create ? welcomeId : crypto.randomUUID(),
      );
      await tx.objectStore("scripts").add(selected);
      scripts.push(selected);
      settings.records.push({
        id: selected.scriptId,
        title: selected.title,
        body: selected.body,
        locale,
      });
    }
    // Translate only a tracked, unchanged demo and only the caller's exact saved snapshot.
    const localized: { before: Script; after: Script }[] = [];
    const candidates =
      options.localize || (options.restore && selected ? [selected] : []);
    for (const before of candidates) {
      const index = scripts.findIndex(
        (script) => script.scriptId === before.scriptId,
      );
      const saved = scripts[index];
      const record = settings.records.find(
        (record) => record.id === before.scriptId,
      );
      if (
        !saved ||
        saved.deletedAt ||
        !record ||
        record.locale === locale ||
        !same(saved, before) ||
        saved.body !== record.body ||
        saved.title !== record.title
      )
        continue;
      const after = {
        ...saved,
        body: welcomeBodies[locale],
        updatedAt: new Date().toISOString(),
      };
      await tx.objectStore("scripts").put(after);
      scripts[index] = after;
      record.body = after.body;
      record.locale = locale;
      localized.push({ before: saved, after });
      if (selected?.scriptId === after.scriptId) selected = after;
    }
    if (options.restore) settings.handled = true;
    await tx.objectStore("onboarding").put(settings, "welcome");
    await tx.done;
    if (selected) remember(selected);
    for (const change of localized) remember(change.after);
    return {
      scripts: scripts.filter((script) => !script.deletedAt),
      settings,
      selected,
      localized,
    };
  },
  async autoWelcome(enabled: boolean) {
    // Persist the latest choice before awaiting; older completions must not overwrite it.
    localSet("teleo.demo.auto", String(enabled));
    const db = await database();
    const tx = db.transaction("onboarding", "readwrite");
    const settings: WelcomeSettings = await tx.store.get("welcome");
    settings.autoCreate = enabled;
    await tx.store.put(settings, "welcome");
    await tx.done;
    return settings;
  },
  async receiveScript(script: Script) {
    const db = await database();
    const tx = db.transaction(["scripts", "onboarding"], "readwrite");
    // A failed request also rejects tx.done. Observe that rejection even if the
    // request throws first; the caller still receives the original failure.
    void tx.done.catch(() => {});
    const scripts = tx.objectStore("scripts");
    const receipts = tx.objectStore("onboarding");
    const old: Script | undefined = await scripts.get(script.scriptId);
    const receipt = await receipts.get("quick-send:" + script.scriptId);
    // The receipt and script commit atomically. A transfer cannot claim an existing script.
    if (old && !receipt) {
      await tx.done;
      throw Error("saveConflict");
    }
    if (!receipt) {
      await scripts.add(script);
      await receipts.put(true, "quick-send:" + script.scriptId);
    }
    await tx.done;
    if (!receipt) remember(script);
    return old || script;
  },
  async list(): Promise<Script[]> {
    const scripts: Script[] = await (await database()).getAll("scripts");
    for (const script of scripts) remember(script);
    return scripts.filter((s) => !s.deletedAt);
  },
  async trash(): Promise<Script[]> {
    const scripts: Script[] = await (await database()).getAll("scripts");
    const deleted = scripts.filter((s) => !!s.deletedAt);
    deleted.forEach(remember);
    return deleted;
  },
  async purge(id: string) {
    const db = await database();
    const tx = db.transaction(["scripts", "revisions"], "readwrite");
    const script: Script | undefined = await tx.objectStore("scripts").get(id);
    const baseline = loaded.get(id);
    // Never purge a restored or concurrently changed document from a stale trash view.
    if (!script?.deletedAt || !baseline || !same(script, baseline)) {
      await tx.done;
      throw Error("saveConflict");
    }
    await tx.objectStore("scripts").delete(id);
    for (const revision of await tx.objectStore("revisions").getAll()) {
      if (revision.scriptId === id)
        await tx.objectStore("revisions").delete(revision.revisionId);
    }
    await tx.done;
    loaded.delete(id);
  },
  async save(script: Script, checkpoint = false) {
    const db = await database();
    const tx = db.transaction(["scripts", "revisions"], "readwrite");
    const old: Script | undefined = await tx
      .objectStore("scripts")
      .get(script.scriptId);
    const baseline = loaded.get(script.scriptId);
    if (old && (!baseline || !same(old, baseline))) {
      // No writes yet: the transaction can finish normally without an unhandled abort.
      await tx.done;
      throw Error("saveConflict");
    }
    if (
      checkpoint &&
      old &&
      (old.title !== script.title || old.body !== script.body)
    ) {
      await tx.objectStore("revisions").put({
        revisionId: crypto.randomUUID(),
        scriptId: old.scriptId,
        title: old.title,
        body: old.body,
        timestamp: new Date().toISOString(),
        source: "web",
      } satisfies Revision);
      const all: Revision[] = await tx.objectStore("revisions").getAll();
      const revisions = all
        .filter((r) => r.scriptId === script.scriptId)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      let budget = 0;
      for (const [i, r] of revisions.entries()) {
        budget += r.body.length * 2;
        if (i >= 30 || budget > 5_000_000)
          await tx.objectStore("revisions").delete(r.revisionId);
      }
    }
    await tx.objectStore("scripts").put(script);
    await tx.done;
    remember(script);
  },
  async recover(input: unknown, label: string): Promise<Script> {
    // Validate before touching IndexedDB. Keep the raw recovery entry if validation fails.
    const raw = input as Script;
    if (!raw || typeof raw.body !== "string" || raw.body.length > 10_000_000)
      throw Error("invalidImport");
    // Local TXT drafts can exceed the portable JSON per-body limit. Validate the
    // contract metadata/preferences without truncating or rejecting their text.
    const draft = parseBundle(
      JSON.stringify({ version: 1, scripts: [{ ...raw, body: "" }] }),
    )[0];
    draft.body = raw.body;
    if (raw.folderId !== undefined && typeof raw.folderId !== "string")
      throw Error("invalidImport");
    if (
      raw.deletedAt !== undefined &&
      !Number.isFinite(Date.parse(raw.deletedAt))
    )
      throw Error("invalidImport");
    draft.folderId = raw.folderId;
    draft.deletedAt = raw.deletedAt;
    // Stable UUID makes recovery idempotent even if the tab closes after commit but before cleanup.
    const hash = new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          JSON.stringify({ ...draft, updatedAt: undefined }),
        ),
      ),
    );
    hash[6] = (hash[6] & 15) | 128;
    hash[8] = (hash[8] & 63) | 128;
    const hex = Array.from(hash.slice(0, 16), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const copyId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    const db = await database();
    const tx = db.transaction("scripts", "readwrite");
    const old: Script | undefined = await tx.store.get(draft.scriptId);
    let result: Script;
    if (old && same(old, draft, false)) result = old;
    else if (!old) {
      result = draft;
      await tx.store.add(result);
    } else {
      result = await tx.store.get(copyId);
      if (!result) {
        result = {
          ...draft,
          scriptId: copyId,
          title: `${draft.title} (${label})`,
          deletedAt: undefined,
        };
        await tx.store.add(result);
      }
    }
    await tx.done;
    remember(result);
    return result;
  },
  async revisions(id: string): Promise<Revision[]> {
    return (await (await database()).getAll("revisions"))
      .filter((r) => r.scriptId === id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  },
  async folders(): Promise<Folder[]> {
    return (await database()).getAll("folders");
  },
  async folder(folder: Folder) {
    await (await database()).put("folders", folder);
  },
  async removeFolder(id: string) {
    const db = await database();
    const tx = db.transaction(["scripts", "folders"], "readwrite");
    const observed: Script[] = [];
    for (const s of await tx.objectStore("scripts").getAll()) {
      if (s.folderId === id) {
        const next = { ...s, folderId: undefined };
        await tx.objectStore("scripts").put(next);
        const baseline = loaded.get(s.scriptId);
        if (baseline && same(s, baseline)) observed.push(next);
      }
    }
    await tx.objectStore("folders").delete(id);
    await tx.done;
    observed.forEach(remember);
  },
};
