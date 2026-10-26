import { openDB } from "idb";
import type {
  Script,
  Revision,
  Folder,
} from "../../../packages/protocol/domain";
const database = () =>
  openDB("teleo", 1, {
    upgrade(db) {
      db.createObjectStore("scripts", { keyPath: "scriptId" });
      db.createObjectStore("revisions", { keyPath: "revisionId" });
      db.createObjectStore("folders", { keyPath: "folderId" });
    },
  });
export const storage = {
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
