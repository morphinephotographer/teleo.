import { validCommand, type Command, type Preferences } from "./domain";

/** Allowlisted settings metadata is available even when the script text stays private. */
export type ControlValues = Pick<
  Preferences,
  | "fontSize"
  | "lineHeight"
  | "textWidth"
  | "mirrorHorizontal"
  | "mirrorVertical"
  | "focusLine"
  | "countdownSeconds"
> & { focusDimming?: boolean; alignment?: Preferences["alignment"] };
export type ControlState = ControlValues & {
  version: 1;
  target: string;
  maximum: number;
  marks?: number[];
  focusPosition?: number;
};
export type ControlCommand =
  | Command
  | { action: "seek"; target: string; value: number; anchor?: number }
  | {
      action: "setPreference";
      target: string;
      key: keyof ControlValues;
      value: number | boolean | Preferences["alignment"];
    };
const uuid = (v: unknown): v is string =>
  typeof v === "string" && /^[a-f0-9-]{36}$/.test(v);
const bounds = {
  fontSize: [16, 120],
  lineHeight: [1, 3],
  textWidth: [280, 1600],
  countdownSeconds: [0, 10],
} as const;
const bools = ["mirrorHorizontal", "mirrorVertical", "focusLine"];
export function validControlValue(key: unknown, value: unknown) {
  if (typeof key !== "string") return false;
  if (key === "alignment")
    return value === "left" || value === "center" || value === "right";
  if (key === "focusDimming" || bools.includes(key))
    return typeof value === "boolean";
  const range = bounds[key as keyof typeof bounds];
  return (
    !!range &&
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= range[0] &&
    value <= range[1]
  );
}
export function validControlCommand(v: unknown): v is ControlCommand {
  if (validCommand(v)) return true;
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  if (!uuid(m.target)) return false;
  if (m.action === "seek")
    return (
      Object.keys(m)
        .filter((k) => k !== "anchor")
        .sort()
        .join(",") === "action,target,value" &&
      (m.anchor === undefined ||
        (typeof m.anchor === "number" &&
          Number.isFinite(m.anchor) &&
          m.anchor >= 0 &&
          m.anchor <= 8192 * 256)) &&
      typeof m.value === "number" &&
      Number.isFinite(m.value) &&
      m.value >= 0 &&
      m.value <= 1
    );
  return (
    m.action === "setPreference" &&
    Object.keys(m).sort().join(",") === "action,key,target,value" &&
    validControlValue(m.key, m.value)
  );
}
export function validControlState(v: unknown): v is ControlState {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return (
    Object.keys(m)
      .filter(
        (k) =>
          k !== "marks" &&
          k !== "focusDimming" &&
          k !== "alignment" &&
          k !== "focusPosition",
      )
      .sort()
      .join(",") ===
      "countdownSeconds,focusLine,fontSize,lineHeight,maximum,mirrorHorizontal,mirrorVertical,target,textWidth,version" &&
    (m.marks === undefined ||
      (Array.isArray(m.marks) &&
        m.marks.length <= 12 &&
        m.marks.every(
          (n) =>
            typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1,
        ))) &&
    (m.focusPosition === undefined ||
      (typeof m.focusPosition === "number" &&
        Number.isFinite(m.focusPosition) &&
        m.focusPosition >= 20 &&
        m.focusPosition <= 70)) &&
    (m.focusDimming === undefined || typeof m.focusDimming === "boolean") &&
    (m.alignment === undefined ||
      validControlValue("alignment", m.alignment)) &&
    m.version === 1 &&
    uuid(m.target) &&
    typeof m.maximum === "number" &&
    Number.isFinite(m.maximum) &&
    m.maximum >= 0 &&
    Object.keys(bounds)
      .concat(bools)
      .every((k) => validControlValue(k, m[k]))
  );
}
export function timeAt(position: number, maximum: number, speed: number) {
  if (
    ![position, maximum, speed].every(Number.isFinite) ||
    maximum <= 0 ||
    speed <= 0
  )
    return { elapsed: 0, remaining: 0 };
  const bounded = Math.max(0, Math.min(maximum, position));
  return {
    elapsed: bounded / (40 * speed),
    remaining: (maximum - bounded) / (40 * speed),
  };
}
export function clockTime(seconds: number) {
  const whole = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(whole / 60)
    .toString()
    .padStart(2, "0")}:${(whole % 60).toString().padStart(2, "0")}`;
}

export type PlaybackState = {
  playing: boolean;
  speed: number;
  position: number;
  controls?: ControlState;
};
export function validPlaybackState(v: unknown): v is PlaybackState {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return (
    Object.keys(m).every((k) =>
      ["playing", "speed", "position", "controls"].includes(k),
    ) &&
    typeof m.playing === "boolean" &&
    typeof m.speed === "number" &&
    Number.isFinite(m.speed) &&
    m.speed >= 0.5 &&
    m.speed <= 3 &&
    typeof m.position === "number" &&
    Number.isFinite(m.position) &&
    m.position >= 0 &&
    (m.controls === undefined || validControlState(m.controls))
  );
}
