import { keyboardSafe } from "../../../packages/protocol/domain";
export const r400Keys = {
  Period: "togglePlay",
  PageUp: "r400Backward",
  PageDown: "r400Forward",
  F5: "enterFullscreen",
} as const;
export type R400Action =
  | "togglePlay"
  | "enterFullscreen"
  | "speedDown"
  | "speedUp"
  | "scrollBack"
  | "scrollForward";
type KeyInput = Parameters<typeof keyboardSafe>[0] & {
  code: string;
  key?: string;
};
/** Native repeats are captured; only paused arrows may reach the bounded hold controller. */
export function r400Shortcut(
  event: KeyInput,
  scope: {
    enabled: boolean;
    reader: boolean;
    blocked: boolean;
    playing: boolean;
  },
): { action: R400Action | null } | null {
  if (
    !scope.enabled ||
    !keyboardSafe(
      {
        repeat: false,
        isComposing: event.isComposing,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
      },
      scope.blocked,
      scope.reader,
    )
  )
    return null;
  if (!Object.hasOwn(r400Keys, event.code)) return null;
  const action: R400Action =
    event.code === "PageUp"
      ? scope.playing
        ? "speedDown"
        : "scrollBack"
      : event.code === "PageDown"
        ? scope.playing
          ? "speedUp"
          : "scrollForward"
        : event.code === "F5"
          ? "enterFullscreen"
          : "togglePlay";
  const pausedArrow = action === "scrollBack" || action === "scrollForward";
  return { action: event.repeat && !pausedArrow ? null : action };
}

/** No autonomous timer: lost keyup cannot leave scrolling running. OS repeats drive bounded steps. */
export class R400Hold {
  private held: { code: string; last: number; expires: number } | null = null;
  constructor(private now = () => performance.now()) {}
  step(code: string, repeat: boolean) {
    const now = this.now();
    if (!repeat) {
      this.held = { code, last: now, expires: now + 1500 };
      return 1;
    }
    const held = this.held;
    if (!held || held.code !== code || now > held.expires) {
      this.stop();
      return 0;
    }
    held.expires = now + 500;
    if (now - held.last < 80) return 0;
    held.last = now;
    return 0.5;
  }
  stop(code?: string) {
    if (!code || this.held?.code === code) this.held = null;
  }
}
/** One app-level listener; the caller supplies its latest handler without rebinding on renders. */
export function bindReaderKeyboard(
  target: EventTarget,
  handle: (event: KeyboardEvent) => void,
  release: (code?: string) => void = () => {},
  documentTarget: EventTarget = target,
) {
  const listener: EventListener = (event) => handle(event as KeyboardEvent);
  const keyup: EventListener = (event) =>
    release((event as KeyboardEvent).code);
  const stop = () => release();
  target.addEventListener("keydown", listener);
  target.addEventListener("keyup", keyup);
  target.addEventListener("blur", stop);
  target.addEventListener("pagehide", stop);
  documentTarget.addEventListener("visibilitychange", stop);
  documentTarget.addEventListener("focusin", stop);
  return () => {
    target.removeEventListener("keydown", listener);
    target.removeEventListener("keyup", keyup);
    target.removeEventListener("blur", stop);
    target.removeEventListener("pagehide", stop);
    documentTarget.removeEventListener("visibilitychange", stop);
    documentTarget.removeEventListener("focusin", stop);
    stop();
  };
}
