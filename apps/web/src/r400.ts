import { keyboardSafe } from "../../../packages/protocol/domain";
export const r400Keys = {
  Period: "togglePlay",
  PageUp: "previousParagraph",
  PageDown: "nextParagraph",
  F5: "enterFullscreen",
} as const;
export type R400Action = (typeof r400Keys)[keyof typeof r400Keys];
type KeyInput = Parameters<typeof keyboardSafe>[0] & {
  code: string;
  key?: string;
};
/** A repeat is captured but never dispatched: don't let native PageDown/F5 scroll/reload. */
export function r400Shortcut(
  event: KeyInput,
  scope: { enabled: boolean; reader: boolean; blocked: boolean },
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
  const action = r400Keys[event.code as keyof typeof r400Keys];
  return action ? { action: event.repeat ? null : action } : null;
}
/** One app-level listener; the caller supplies its latest handler without rebinding on renders. */
export function bindReaderKeyboard(
  target: EventTarget,
  handle: (event: KeyboardEvent) => void,
) {
  const listener: EventListener = (event) => handle(event as KeyboardEvent);
  target.addEventListener("keydown", listener);
  return () => target.removeEventListener("keydown", listener);
}
