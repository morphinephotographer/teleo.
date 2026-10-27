import type { Script } from "./domain";
export const PREVIEW_VERSION = 1;
export const PREVIEW_CHUNK = 8192;
export const PREVIEW_LIMIT = PREVIEW_CHUNK * 256;
export function previewSupported(body: string) {
  if (body.length > PREVIEW_LIMIT) return false;
  const breaks = /\n\s*\n/g;
  let count = 1;
  while (breaks.exec(body)) if (++count > 5000) return false;
  return true;
}
export type PreviewScript = { id: string; revision: string; title: string };
export type PreviewPosition = {
  type: "previewPosition";
  version: 1;
  epoch: number;
  script: { id: string; revision: string };
  state: { playing: boolean; speed: number; position: number };
  speedUnit: "multiplier";
  offset: number;
  paragraph: number;
  timestamp: number;
};
export type PreviewContent = {
  type: "previewContent";
  version: 1;
  epoch: number;
  script: PreviewScript;
  index: number;
  total: number;
  text: string;
};
export type PreviewPermission = {
  type: "previewPermission";
  version: 1;
  allowed: boolean;
  epoch: number;
  sessionId: string;
};
export type PreviewUnavailable = {
  type: "previewUnavailable";
  version: 1;
  epoch: number;
  reason: "tooLarge";
};
export type PreviewEnvelope = (
  PreviewPosition | PreviewContent | PreviewUnavailable
) & {
  sessionId: string;
  sequence: number;
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object";
const exact = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).sort().join(",") === keys.sort().join(",");
const int = (v: unknown, max = Number.MAX_SAFE_INTEGER) =>
  Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= max;
export const previewScript = (s: unknown, title = false): s is PreviewScript =>
  record(s) &&
  exact(s, title ? ["id", "revision", "title"] : ["id", "revision"]) &&
  typeof s.id === "string" &&
  /^[a-f0-9-]{36}$/.test(s.id) &&
  typeof s.revision === "string" &&
  /^[a-f0-9]{64}$/.test(s.revision) &&
  (!title || (typeof s.title === "string" && s.title.length <= 256));
export function validPreviewPayload(
  m: unknown,
): m is PreviewPosition | PreviewContent | PreviewUnavailable {
  if (!record(m) || m.version !== 1 || !int(m.epoch)) return false;
  if (m.type === "previewUnavailable")
    return (
      exact(m, ["type", "version", "epoch", "reason"]) &&
      m.reason === "tooLarge"
    );
  if (m.type === "previewContent")
    return (
      exact(m, [
        "type",
        "version",
        "epoch",
        "script",
        "index",
        "total",
        "text",
      ]) &&
      previewScript(m.script, true) &&
      int(m.index, 255) &&
      int(m.total, 256) &&
      Number(m.total) > 0 &&
      Number(m.index) < Number(m.total) &&
      typeof m.text === "string" &&
      m.text.length <= PREVIEW_CHUNK
    );
  if (m.type === "previewPosition")
    return (
      exact(m, [
        "type",
        "version",
        "epoch",
        "script",
        "state",
        "speedUnit",
        "offset",
        "paragraph",
        "timestamp",
      ]) &&
      m.speedUnit === "multiplier" &&
      previewScript(m.script) &&
      record(m.state) &&
      exact(m.state, ["playing", "speed", "position"]) &&
      typeof m.state.playing === "boolean" &&
      typeof m.state.speed === "number" &&
      Number.isFinite(m.state.speed) &&
      m.state.speed >= 0.5 &&
      m.state.speed <= 3 &&
      typeof m.state.position === "number" &&
      Number.isFinite(m.state.position) &&
      m.state.position >= 0 &&
      int(m.offset, PREVIEW_LIMIT) &&
      int(m.paragraph, PREVIEW_LIMIT) &&
      typeof m.timestamp === "number" &&
      Number.isFinite(m.timestamp) &&
      m.timestamp > 0
    );
  return false;
}
export function paragraphs(body: string) {
  const result: { text: string; offset: number }[] = [];
  const breaks = /\n\s*\n/g;
  let start = 0;
  let match: RegExpExecArray | null;
  while ((match = breaks.exec(body))) {
    result.push({ text: body.slice(start, match.index), offset: start });
    start = match.index + match[0].length;
  }
  result.push({ text: body.slice(start), offset: start });
  return result;
}
export async function snapshot(script: Script) {
  if (!previewSupported(script.body)) return null;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      script.scriptId + "\0" + script.title + "\0" + script.body,
    ),
  );
  return {
    script: {
      id: script.scriptId,
      revision: Array.from(new Uint8Array(digest), (n) =>
        n.toString(16).padStart(2, "0"),
      ).join(""),
      title: script.title.slice(0, 256),
    },
    body: script.body,
  };
}
/** Phone-only memory. No script content is written to browser/relay storage. */
export class PreviewReceiver {
  unavailable = false;
  allowed = false;
  epoch = 0;
  sessionId = "";
  sequence = -1;
  script: PreviewScript | null = null;
  body = "";
  position: PreviewPosition | null = null;
  private incoming: {
    script: PreviewScript;
    chunks: string[];
    total: number;
    next: number;
  } | null = null;
  clear() {
    this.unavailable = false;
    this.script = null;
    this.body = "";
    this.position = null;
    this.incoming = null;
  }
  permission(m: PreviewPermission) {
    if (m.sessionId === this.sessionId && m.epoch < this.epoch) return false;
    if (m.sessionId !== this.sessionId) this.sequence = -1;
    if (m.sessionId !== this.sessionId || m.epoch !== this.epoch || !m.allowed)
      this.clear();
    this.allowed = m.allowed;
    this.epoch = m.epoch;
    this.sessionId = m.sessionId;
    return true;
  }
  receive(m: PreviewEnvelope) {
    if (
      !this.allowed ||
      m.epoch !== this.epoch ||
      m.sessionId !== this.sessionId ||
      m.sequence <= this.sequence
    )
      return false;
    const payload = { ...m } as Record<string, unknown>;
    delete payload.sequence;
    delete payload.sessionId;
    if (!validPreviewPayload(payload)) return false;
    this.sequence = m.sequence;
    if (m.type === "previewUnavailable") {
      this.clear();
      this.unavailable = true;
      return true;
    }
    if (m.type === "previewPosition") {
      if (
        this.script &&
        (this.script.id !== m.script.id ||
          this.script.revision !== m.script.revision)
      )
        this.clear();
      this.position = m;
      return true;
    }
    if (m.index === 0) {
      if (
        this.script?.revision !== m.script.revision ||
        this.script.id !== m.script.id
      )
        this.clear();
      this.incoming = { script: m.script, chunks: [], total: m.total, next: 0 };
    }
    const incoming = this.incoming;
    if (
      !incoming ||
      incoming.script.id !== m.script.id ||
      incoming.script.revision !== m.script.revision ||
      incoming.total !== m.total ||
      incoming.next !== m.index
    )
      return false;
    incoming.chunks.push(m.text);
    incoming.next++;
    if (incoming.next === m.total) {
      const body = incoming.chunks.join("");
      if (!previewSupported(body)) {
        this.clear();
        this.unavailable = true;
        return true;
      }
      this.script = m.script;
      this.body = body;
      this.incoming = null;
    }
    return true;
  }
}
