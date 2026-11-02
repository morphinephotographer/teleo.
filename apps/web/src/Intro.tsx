import { useEffect, useRef, useState } from "react";
import { MATRIX_LANDED, startMatrixIntro } from "./intro-matrix";

const sessionKey = "teleo.intro.seen.v1";
export function introNeeded() {
  if (!["/", "/studio"].includes(location.pathname)) return false;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  try {
    if (reduced) {
      sessionStorage.setItem(sessionKey, "true");
      return false;
    }
    return sessionStorage.getItem(sessionKey) !== "true";
  } catch {
    return !reduced;
  }
}
/** The word stays on screen this long after the last letter lands. */
const HOLD = 700,
  FADE = 300;
export function Intro({
  skipLabel,
  onDone,
}: {
  skipLabel: string;
  onDone: () => void;
}) {
  const skip = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const word = useRef<HTMLSpanElement>(null);
  const [leaving, setLeaving] = useState(false);
  const [resolved, setResolved] = useState(false);
  useEffect(() => {
    try {
      sessionStorage.setItem(sessionKey, "true");
    } catch {
      /* One mount still plays only once. */
    }
    skip.current?.focus();
    const stop =
      canvas.current && word.current
        ? startMatrixIntro(canvas.current, word.current)
        : () => {};
    // The final word is guaranteed visible even if a frame was missed.
    const resolve = setTimeout(() => setResolved(true), MATRIX_LANDED + 60);
    const fade = setTimeout(() => setLeaving(true), MATRIX_LANDED + HOLD);
    const done = setTimeout(onDone, MATRIX_LANDED + HOLD + FADE);
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      if (motion.matches) onDone();
    };
    motion.addEventListener("change", change);
    return () => {
      stop();
      clearTimeout(resolve);
      clearTimeout(fade);
      clearTimeout(done);
      motion.removeEventListener("change", change);
    };
  }, [onDone]);
  return (
    <div
      className={"brand-intro" + (leaving ? " leaving" : "")}
      role="dialog"
      aria-modal="true"
      aria-label="teleo."
    >
      <canvas ref={canvas} className="intro-rain" aria-hidden="true" />
      <div
        className={"intro-wordmark" + (resolved ? " resolved" : "")}
        aria-hidden="true"
      >
        <span ref={word} className="intro-static" translate="no">
          {[..."teleo."].map((letter, i) => (
            <span key={i}>{letter}</span>
          ))}
        </span>
      </div>
      <button ref={skip} className="intro-skip" onClick={onDone}>
        {skipLabel}
      </button>
    </div>
  );
}
