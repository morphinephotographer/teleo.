import { openDB } from "idb";
import { localGet, localSet, type Locale } from "./i18n";
import {
  createWelcome,
  pristineWelcome,
  welcomeId,
  type WelcomeSettings,
} from "./welcome";
import type {
  Script,
  Revision,
  Folder,
} from "../../../packages/protocol/domain";
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
    if (options.restore) settings.handled = true;
    await tx.objectStore("onboarding").put(settings, "welcome");
    await tx.done;
    return {
      scripts: scripts.filter((script) => !script.deletedAt),
      settings,
      selected,
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
  async list(): Promise<Script[]> {
    return (await (await database()).getAll("scripts")).filter(
      (s) => !s.deletedAt,
    );
  },
  async save(script: Script, checkpoint = false) {
    const db = await database();
    const tx = db.transaction(["scripts", "revisions"], "readwrite");
    const old: Script | undefined = await tx
      .objectStore("scripts")
      .get(script.scriptId);
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
    for (const s of await tx.objectStore("scripts").getAll()) {
      if (s.folderId === id)
        await tx.objectStore("scripts").put({ ...s, folderId: undefined });
    }
    await tx.objectStore("folders").delete(id);
    await tx.done;
  },
};
