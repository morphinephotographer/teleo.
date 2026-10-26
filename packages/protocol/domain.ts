export const actions = [
  "play",
  "pause",
  "togglePlay",
  "restart",
  "speedUp",
  "speedDown",
  "setSpeed",
  "previousParagraph",
  "nextParagraph",
  "scrollBack",
  "scrollForward",
] as const;
export type Action = (typeof actions)[number];
export type Command = { action: Action; value?: number };
export type Preferences = {
  speed: number;
  fontSize: number;
  lineHeight: number;
  textWidth: number;
  alignment: "left" | "center" | "right";
  mirrorHorizontal: boolean;
  mirrorVertical: boolean;
  focusLine: boolean;
  countdownSeconds: number;
  appearance: "dark" | "light";
};
export const defaults: Preferences = {
  speed: 1,
  fontSize: 40,
  lineHeight: 1.6,
  textWidth: 760,
  alignment: "left",
  mirrorHorizontal: false,
  mirrorVertical: false,
  focusLine: true,
  countdownSeconds: 0,
  appearance: "dark",
};
export type Script = {
  scriptId: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  folderId?: string;
  deletedAt?: string;
  preferences: Preferences;
};
export type Revision = {
  revisionId: string;
  scriptId: string;
  timestamp: string;
  title: string;
  body: string;
  source: string;
};
export type Folder = { folderId: string; title: string };
export function createScript(title: string, body = ""): Script {
  const now = new Date().toISOString();
  return {
    scriptId: crypto.randomUUID(),
    title,
    body,
    createdAt: now,
    updatedAt: now,
    preferences: { ...defaults },
  };
}
export function validCommand(x: unknown): x is Command {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    Object.keys(o).every((k) => ["action", "value"].includes(k)) &&
    actions.includes(o.action as Action) &&
    (o.action === "setSpeed"
      ? typeof o.value === "number" &&
        Number.isFinite(o.value) &&
        o.value >= 0.5 &&
        o.value <= 3
      : o.value === undefined)
  );
}
export class Playback {
  playing = false;
  position = 0;
  speed = 1;
  maximum = 0;
  countdown = 0;
  private last: number | undefined;
  command(c: Command, paragraphs: number[] = []) {
    if (!validCommand(c)) return false;
    switch (c.action) {
      case "play":
        this.playing = true;
        break;
      case "pause":
        this.playing = false;
        break;
      case "togglePlay":
        this.playing = !this.playing;
        break;
      case "restart":
        this.position = 0;
        this.playing = false;
        this.countdown = 0;
        break;
      case "speedUp":
        this.speed = Math.min(3, this.speed + 0.25);
        break;
      case "speedDown":
        this.speed = Math.max(0.5, this.speed - 0.25);
        break;
      case "setSpeed":
        this.speed = c.value!;
        break;
      case "scrollBack":
        this.position -= 100;
        break;
      case "scrollForward":
        this.position += 100;
        break;
      case "nextParagraph":
        this.position =
          paragraphs.find((p) => p > this.position + 2) ?? this.maximum;
        break;
      case "previousParagraph":
        this.position =
          [...paragraphs].reverse().find((p) => p < this.position - 2) ?? 0;
        break;
    }
    this.position = Math.max(0, Math.min(this.maximum, this.position));
    this.last = undefined;
    return true;
  }
  tick(now: number) {
    const delta =
      this.last === undefined
        ? 0
        : Math.max(0, Math.min(0.05, (now - this.last) / 1000));
    this.last = now;
    if (this.playing) {
      if (this.countdown > 0)
        this.countdown = Math.max(0, this.countdown - delta);
      else
        this.position = Math.min(
          this.maximum,
          this.position + 40 * this.speed * delta,
        );
      if (this.position >= this.maximum && this.countdown === 0)
        this.playing = false;
    }
    return this.position;
  }
  suspend() {
    this.last = undefined;
    this.playing = false;
  }
}
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseBundle(input: string): Script[] {
  if (input.length > 10_000_000) throw Error("invalidImport");
  const x = JSON.parse(input);
  if (x.version !== 1 || !Array.isArray(x.scripts) || x.scripts.length > 1000)
    throw Error("invalidImport");
  return x.scripts.map((s: Script) => {
    if (
      !s ||
      !uuid.test(s.scriptId) ||
      typeof s.title !== "string" ||
      typeof s.body !== "string" ||
      s.body.length > 2_000_000 ||
      !Number.isFinite(Date.parse(s.createdAt)) ||
      !Number.isFinite(Date.parse(s.updatedAt))
    )
      throw Error("invalidImport");
    const p = { ...defaults, ...s.preferences };
    for (const [key, min, max] of [
      ["speed", 0.5, 3],
      ["fontSize", 16, 100],
      ["lineHeight", 1, 3],
      ["textWidth", 280, 1600],
      ["countdownSeconds", 0, 10],
    ] as const) {
      if (
        typeof p[key] !== "number" ||
        !Number.isFinite(p[key]) ||
        p[key] < min ||
        p[key] > max
      )
        throw Error("invalidImport");
    }
    if (
      !["left", "center", "right"].includes(p.alignment) ||
      !["dark", "light"].includes(p.appearance) ||
      [p.mirrorHorizontal, p.mirrorVertical, p.focusLine].some(
        (v) => typeof v !== "boolean",
      )
    )
      throw Error("invalidImport");
    return {
      scriptId: s.scriptId,
      title: s.title,
      body: s.body,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      preferences: p,
    };
  });
}
export function exportBundle(scripts: Script[]) {
  return JSON.stringify({ version: 1, scripts }, null, 2);
}
export const standardKeys: Record<string, Action | "mirror" | "preset"> = {
  Space: "togglePlay",
  ArrowUp: "speedUp",
  ArrowDown: "speedDown",
  ArrowLeft: "previousParagraph",
  ArrowRight: "nextParagraph",
  KeyR: "restart",
  KeyM: "mirror",
};
export function keyboardSafe(
  e: {
    repeat: boolean;
    isComposing: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
  },
  editable: boolean,
  reader: boolean,
) {
  return (
    reader &&
    !editable &&
    !e.repeat &&
    !e.isComposing &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey
  );
}
