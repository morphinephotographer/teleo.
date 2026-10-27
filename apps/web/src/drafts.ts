import type { Script } from "../../../packages/protocol/domain";

/** Serial writes must not acknowledge or erase recovery for a newer draft. */
export class DraftWriter {
  private pending = new Map<string, Script>();
  private dirty = new Map<string, Script>();
  private writes = Promise.resolve();
  constructor(
    private save: (script: Script) => Promise<void>,
    private recovery: (id: string, script: Script | null) => void,
    private status: (
      value: "saving" | "saved" | "saveError" | "saveConflict",
    ) => void,
  ) {}
  enqueue(script: Script) {
    this.pending.set(script.scriptId, script);
    this.dirty.set(script.scriptId, script);
    this.recovery(script.scriptId, script);
    this.status("saving");
  }
  /** Autosave keeps retryable failures in memory; destructive mutations must stop on them. */
  async requireSaved() {
    await this.flush();
    if (this.dirty.size) throw Error("saveError");
  }
  flush() {
    const batch = [...this.pending.values()];
    this.pending.clear();
    if (!batch.length) return this.writes;
    this.writes = this.writes.then(async () => {
      let failed = false;
      let conflict = false;
      for (const script of batch) {
        try {
          await this.save(script);
          if (this.dirty.get(script.scriptId) === script) {
            this.dirty.delete(script.scriptId);
            this.recovery(script.scriptId, null);
          }
        } catch (error) {
          conflict ||=
            error instanceof Error && error.message === "saveConflict";
          // Never replace a later pending revision with a stale failed snapshot.
          if (this.dirty.get(script.scriptId) === script)
            this.pending.set(script.scriptId, script);
          failed = true;
        }
      }
      this.status(
        this.dirty.size
          ? conflict
            ? "saveConflict"
            : failed
              ? "saveError"
              : "saving"
          : "saved",
      );
    });
    return this.writes;
  }
}
