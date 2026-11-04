import { useRef } from "react";

/**
 * Branding is plain text: never a route, action, tab stop or focus target.
 * With `playful`, a tap makes the "o" wink and the dot hop — a small reward,
 * not a control, so it stays a span without a role or tab stop.
 */
export function Wordmark({
  className = "",
  playful = false,
}: {
  className?: string;
  playful?: boolean;
}) {
  const mark = useRef<HTMLSpanElement>(null);
  if (!playful)
    return (
      <span className={`brand wordmark ${className}`} translate="no">
        teleo.
      </span>
    );
  const play = () => {
    const el = mark.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Restart cleanly when tapped again mid-animation.
    el.classList.remove("wink");
    void el.offsetWidth;
    el.classList.add("wink");
  };
  return (
    <span
      ref={mark}
      className={`brand wordmark playful ${className}`}
      translate="no"
      onPointerDown={play}
      onAnimationEnd={(e) => {
        if (e.animationName === "wordmark-hop")
          e.currentTarget.classList.remove("wink");
      }}
    >
      tele
      <span className="wordmark-o">o</span>
      <span className="wordmark-dot">.</span>
    </span>
  );
}
