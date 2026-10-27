import {
  snapshot,
  PREVIEW_CHUNK,
  PREVIEW_LIMIT,
  type PreviewPermission,
  type PreviewPosition,
} from "../../../packages/protocol/preview";
import type { Script } from "../../../packages/protocol/domain";
import type { RemoteLink, PlaybackState } from "./remote";
export class HostPreview {
  private compiled: Awaited<ReturnType<typeof snapshot>> = null;
  private compileTimer: ReturnType<typeof setTimeout> | undefined;
  private scriptId = "";
  private tooLarge = false;
  private generation = 0;
  private lastPosition = "";
  private epoch = 0;
  private allowed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private link: RemoteLink,
    private onError: () => void = () => {},
  ) {}
  async script(script: Script | null) {
    const generation = ++this.generation;
    this.cancel();
    clearTimeout(this.compileTimer);
    this.compiled = null;
    this.tooLarge = !!script && script.body.length > PREVIEW_LIMIT;
    if (!script) return;
    const delay = script.scriptId === this.scriptId ? 180 : 0;
    this.scriptId = script.scriptId;
    this.compileTimer = setTimeout(async () => {
      try {
        const compiled = await snapshot(script);
        if (generation !== this.generation) return;
        this.compiled = compiled;
        this.tooLarge = !compiled;
        if (this.allowed) this.publish();
      } catch {
        if (generation !== this.generation) return;
        this.compiled = null;
        this.disconnect();
        this.link.previewPermission(false);
        this.onError();
      }
    }, delay);
  }
  permission(m: PreviewPermission) {
    this.lastPosition = "";
    this.cancel();
    this.allowed = m.allowed;
    this.epoch = m.epoch;
    if (m.allowed) this.publish();
  }
  private cancel() {
    clearTimeout(this.timer);
  }
  publish() {
    this.cancel();
    const compiled = this.compiled,
      epoch = this.epoch;
    if (this.allowed && this.tooLarge) {
      this.link.send({
        type: "previewUnavailable",
        version: 1,
        epoch,
        reason: "tooLarge",
      });
      return;
    }
    if (!this.allowed || !compiled) return;
    const total = Math.max(1, Math.ceil(compiled.body.length / PREVIEW_CHUNK));
    let index = 0;
    const next = () => {
      if (!this.allowed || epoch !== this.epoch || compiled !== this.compiled)
        return;
      this.link.send({
        type: "previewContent",
        version: 1,
        epoch,
        script: compiled.script,
        index,
        total,
        text: compiled.body.slice(
          index * PREVIEW_CHUNK,
          (index + 1) * PREVIEW_CHUNK,
        ),
      });
      if (++index < total) this.timer = setTimeout(next, 150);
    };
    next();
  }
  position(state: PlaybackState, paragraph: number, offset: number) {
    const c = this.compiled;
    if (!this.allowed || !c) return;
    const signature = JSON.stringify([c.script, state, paragraph, offset]);
    if (signature === this.lastPosition) return;
    this.lastPosition = signature;
    this.link.send({
      type: "previewPosition",
      version: 1,
      epoch: this.epoch,
      script: { id: c.script.id, revision: c.script.revision },
      state,
      paragraph,
      offset,
      speedUnit: "multiplier",
      timestamp: Date.now(),
    } satisfies PreviewPosition);
  }
  disconnect() {
    this.allowed = false;
    this.cancel();
  }
  dispose() {
    this.disconnect();
    clearTimeout(this.compileTimer);
    this.generation++;
    this.compiled = null;
  }
}
