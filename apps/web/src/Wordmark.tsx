import { useRef } from "react";

/**
 * Branding is plain text: never a route, action, tab stop or focus target.
 * With `playful`, a tap plays a small trampoline: the dot hops onto the "o",
 * the "o" gives under it like a trampoline and throws the dot back to its
 * place, where it bounces once; the "o" settles. It is a reward, not a
 * control, so the wordmark stays a span without a role or tab stop.
 */
export function Wordmark({
  className = "",
  playful = false,
}: {
  className?: string;
  playful?: boolean;
}) {
  const mark = useRef<HTMLSpanElement>(null);
  const running = useRef<Animation[]>([]);
  if (!playful)
    return (
      <span className={`brand wordmark ${className}`} translate="no">
        teleo.
      </span>
    );
  const play = () => {
    const el = mark.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const o = el.querySelector<HTMLElement>(".wordmark-o");
    const dot = el.querySelector<HTMLElement>(".wordmark-dot");
    const base = el.querySelector<HTMLElement>(".wordmark-base");
    if (!o || !dot || !base || typeof o.animate !== "function") return;
    running.current.forEach((a) => a.cancel());

    // Glyph geometry from the real font: where the ink of "o" and "." sits.
    const style = getComputedStyle(el);
    const size = parseFloat(style.fontSize);
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return;
    ctx.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
    const ink = (ch: string) => {
      const m = ctx.measureText(ch);
      return {
        center: (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2,
        top: m.actualBoundingBoxAscent,
      };
    };
    const oInk = ink("o"),
      dotInk = ink(".");
    const oBox = o.getBoundingClientRect(),
      dotBox = dot.getBoundingClientRect(),
      baseline = base.getBoundingClientRect().top;
    const dx = oBox.left + oInk.center - (dotBox.left + dotInk.center);
    const top = -oInk.top; // dot resting on top of the "o"
    const em = size;
    // Never fly above the top of the window (the bar sits close to it).
    const room = Math.max(0.1 * em, baseline - oInk.top - dotInk.top - 4);
    const hop = Math.min(0.22 * em, room),
      fly = Math.min(0.42 * em, room);
    // Squash and stretch around the baseline, where the letters stand.
    o.style.transformOrigin = `50% ${baseline - oBox.top}px`;
    dot.style.transformOrigin = `50% ${baseline - dotBox.top}px`;

    const T = 1000;
    const at = (x: number, y: number, sx = 1, sy = 1) =>
      `translate(${x}px, ${y}px) scale(${sx}, ${sy})`;
    const up = "cubic-bezier(0.2, 0.6, 0.35, 1)"; // decelerating rise
    const down = "cubic-bezier(0.55, 0, 0.8, 0.4)"; // accelerating fall
    const press = 0.62,
      launch = 1.14;
    running.current = [
      dot.animate(
        [
          { offset: 0, transform: at(0, 0), easing: "ease-out" },
          { offset: 0.06, transform: at(0, 0, 1.2, 0.8), easing: up },
          {
            offset: 0.17,
            transform: at(dx * 0.5, top - hop),
            easing: down,
          },
          { offset: 0.27, transform: at(dx, top), easing: "ease-out" },
          {
            offset: 0.39,
            transform: at(dx, top * press, 1.15, 0.85),
            easing: "ease-in",
          },
          { offset: 0.48, transform: at(dx, top * launch), easing: up },
          {
            offset: 0.62,
            transform: at(dx * 0.45, top - fly),
            easing: down,
          },
          { offset: 0.78, transform: at(0, 0, 1.25, 0.75), easing: up },
          { offset: 0.87, transform: at(0, -0.12 * em), easing: down },
          { offset: 0.94, transform: at(0, 0, 1.1, 0.9), easing: "ease-out" },
          { offset: 1, transform: at(0, 0) },
        ],
        { duration: T },
      ),
      o.animate(
        [
          { offset: 0, transform: "scale(1, 1)" },
          { offset: 0.27, transform: "scale(1, 1)", easing: "ease-out" },
          {
            offset: 0.39,
            transform: `scale(1.12, ${press})`,
            easing: "ease-in-out",
          },
          {
            offset: 0.48,
            transform: `scale(0.94, ${launch})`,
            easing: "ease-in-out",
          },
          {
            offset: 0.58,
            transform: "scale(1.04, 0.95)",
            easing: "ease-in-out",
          },
          {
            offset: 0.68,
            transform: "scale(0.99, 1.02)",
            easing: "ease-in-out",
          },
          { offset: 0.76, transform: "scale(1, 1)" },
          { offset: 1, transform: "scale(1, 1)" },
        ],
        { duration: T },
      ),
    ];
  };
  return (
    <span
      ref={mark}
      className={`brand wordmark playful ${className}`}
      translate="no"
      onPointerDown={play}
    >
      tele
      <span className="wordmark-o">o</span>
      <span className="wordmark-dot">.</span>
      <span className="wordmark-base" aria-hidden="true" />
    </span>
  );
}
