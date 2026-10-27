import { useEffect, useRef, useState } from "react";

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
export function Intro({
  skipLabel,
  onDone,
}: {
  skipLabel: string;
  onDone: () => void;
}) {
  const skip = useRef<HTMLButtonElement>(null);
  const [leaving, setLeaving] = useState(false);
  const [resolved, setResolved] = useState(false);
  useEffect(() => {
    try {
      sessionStorage.setItem(sessionKey, "true");
    } catch {
      /* One mount still plays only once. */
    }
    skip.current?.focus();
    // The final brand must not depend on six filtered/composited animation layers.
    const resolve = setTimeout(() => setResolved(true), 2100);
    const fade = setTimeout(() => setLeaving(true), 3150);
    const done = setTimeout(onDone, 3450);
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      if (motion.matches) onDone();
    };
    motion.addEventListener("change", change);
    return () => {
      clearTimeout(fade);
      clearTimeout(resolve);
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
      <div className="letter-field" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span
            key={i}
            className="drift-letter"
            style={
              {
                "--x": `${((i * 37) % 96) - 48}vw`,
                "--y": `${((i * 23) % 84) - 42}vh`,
                "--size": `${18 + ((i * 11) % 42)}px`,
                "--delay": `${i * 22}ms`,
                "--tilt": `${i % 2 ? 8 : -8}deg`,
              } as React.CSSProperties
            }
          >
            {"teleo."[i % 6]}
          </span>
        ))}
      </div>
      <div
        className={"intro-wordmark" + (resolved ? " resolved" : "")}
        aria-hidden="true"
      >
        <span className="intro-static">teleo.</span>
        {!resolved && (
          <div className="intro-assembly">
            {[..."teleo."].map((letter, i) => (
              <span
                key={i}
                style={
                  {
                    "--from-x": `${[-32, 26, -18, 31, -26, 19][i]}vw`,
                    "--from-y": `${[-24, -31, 24, 27, -9, 16][i]}vh`,
                    "--delay": `${i * 65}ms`,
                  } as React.CSSProperties
                }
              >
                {letter}
              </span>
            ))}
          </div>
        )}
      </div>
      <button ref={skip} className="intro-skip" onClick={onDone}>
        {skipLabel}
        <span aria-hidden="true">↗</span>
      </button>
    </div>
  );
}
