import { localGet, localSet } from "./i18n";
export const feedbackAvailable = () => typeof navigator.vibrate === "function";
export const feedbackEnabled = () =>
  feedbackAvailable() && localGet("teleo.haptics") !== "false";
export const setFeedback = (enabled: boolean) =>
  localSet("teleo.haptics", String(enabled));
export function feedback() {
  if (feedbackEnabled())
    try {
      navigator.vibrate(12);
    } catch {
      /* Feedback never prevents a real command. */
    }
}
