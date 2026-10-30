import { keyboardSafe } from "../../../packages/protocol/domain";

const shortcuts = {
  Space: "togglePlay",
  ArrowLeft: "lineBack",
  ArrowRight: "lineForward",
  ArrowUp: "speedUp",
  ArrowDown: "speedDown",
} as const;

/** Browser reading keys are independent of optional hardware-remote profiles. */
export function readerShortcut(
  event: Parameters<typeof keyboardSafe>[0] & { code: string },
  scope: { reader: boolean; blocked: boolean },
): { action: (typeof shortcuts)[keyof typeof shortcuts] | null } | null {
  if (
    !Object.hasOwn(shortcuts, event.code) ||
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
  // Consume native repeats so Space cannot toggle repeatedly or scroll the page.
  return {
    action: event.repeat
      ? null
      : shortcuts[event.code as keyof typeof shortcuts],
  };
}
