import { useRef } from "react";

/**
 * Branding is plain text: never a route, action, tab stop or focus target.
 * With `playful`, a tap plays a small trampoline: the dot hops onto the "o",
 * the top of the "o" bends in under its weight and throws it back; the dot
 * lands on its place and bounces once while the "o" settles. It is a reward,
 * not a control, so the wordmark stays a span without a role or tab stop.
 */
export function Wordmark({
  className = "",
  playful = false,
}: {
  className?: string;
  playful?: boolean;
}) {
  const mark = useRef<HTMLSpanElement>(null);
  const sheet = useRef<HTMLCanvasElement>(null);
  const frame = useRef(0);
  if (!playful)
    return (
      <span className={`brand wordmark ${className}`} translate="no">
        teleo.
      </span>
    );
  const play = () => {
    const el = mark.current,
      view = sheet.current;
    if (!el || !view || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const o = el.querySelector<HTMLElement>(".wordmark-o");
    const dot = el.querySelector<HTMLElement>(".wordmark-dot");
    const base = el.querySelector<HTMLElement>(".wordmark-base");
    const out = view.getContext("2d");
    if (!o || !dot || !base || !out) return;
    cancelAnimationFrame(frame.current);
    o.style.color = "";
    dot.style.transform = "";

    // Glyph geometry from the real font: where the ink of "o" and "." sits.
    const style = getComputedStyle(el);
    const size = parseFloat(style.fontSize);
    const font = (px: number) =>
      `${style.fontWeight} ${px}px ${style.fontFamily}`;
    const measure = document.createElement("canvas").getContext("2d");
    if (!measure) return;
    measure.font = font(size);
    const ink = (ch: string) => {
      const m = measure.measureText(ch);
      return {
        left: -m.actualBoundingBoxLeft,
        width: m.actualBoundingBoxRight + m.actualBoundingBoxLeft,
        top: m.actualBoundingBoxAscent,
      };
    };
    const oInk = ink("o"),
      dotInk = ink(".");
    const markBox = el.getBoundingClientRect(),
      oBox = o.getBoundingClientRect(),
      dotBox = dot.getBoundingClientRect(),
      baseline = base.getBoundingClientRect().top;
    const em = size;
    const oCenter = oBox.left + oInk.left + oInk.width / 2;
    const dx = oCenter - (dotBox.left + dotInk.left + dotInk.width / 2);
    const top = -oInk.top; // the dot resting on top of the "o"
    const dent = 0.42 * oInk.top; // deepest bend of the top of the "o"
    // Never fly above the top of the window (the bar sits close to it).
    const room = Math.max(0.1 * em, baseline - oInk.top - dotInk.top - 4);
    const hop = Math.min(0.22 * em, room),
      fly = Math.min(0.42 * em, room);
    dot.style.transformOrigin = `50% ${baseline - dotBox.top}px`;

    // The "o" is drawn on a canvas laid exactly over the letter, so its top
    // can bend: every pixel column above the middle moves down by the dent.
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const pad = 0.15 * em;
    const left = oBox.left - pad,
      right = oBox.right + pad,
      upper = baseline - oInk.top - 2 * pad,
      lower = baseline + pad;
    const W = Math.ceil((right - left) * dpr),
      H = Math.ceil((lower - upper) * dpr);
    Object.assign(view.style, {
      left: `${left - markBox.left}px`,
      top: `${upper - markBox.top}px`,
      width: `${W / dpr}px`,
      height: `${H / dpr}px`,
    });
    view.width = W;
    view.height = H;
    const glyph = document.createElement("canvas");
    glyph.width = W;
    glyph.height = H;
    const g = glyph.getContext("2d");
    if (!g) return;
    g.font = font(size * dpr);
    g.fillStyle = style.color;
    g.fillText("o", (oBox.left - left) * dpr, (baseline - upper) * dpr);
    const middle = Math.round((baseline - oInk.top / 2 - upper) * dpr);
    const centre = (oCenter - left) * dpr,
      reach = 0.45 * oInk.width * dpr;
    const bend = Array.from({ length: W }, (_, x) => {
      const u = (x + 0.5 - centre) / reach;
      return Math.abs(u) < 1 ? Math.cos((Math.PI / 2) * u) ** 2 : 0;
    });
    const draw = (depth: number) => {
      out.clearRect(0, 0, W, H);
      out.drawImage(glyph, 0, middle, W, H - middle, 0, middle, W, H - middle);
      // Pressed: each column's upper half slides down into the empty
      // counter, so the top stroke bends in whole. Springing back: it
      // stretches up instead, so no gap opens at the middle.
      for (let x = 0; x < W; x++) {
        const shift = depth * dpr * bend[x];
        if (shift >= 0)
          out.drawImage(glyph, x, 0, 1, middle, x, shift, 1, middle);
        else out.drawImage(glyph, x, 0, 1, middle, x, shift, 1, middle - shift);
      }
    };

    // Keyframes: [time 0–1, value, easing towards the next point].
    type Ease = (u: number) => number;
    const lin: Ease = (u) => u,
      rise: Ease = (u) => 1 - (1 - u) * (1 - u),
      fall: Ease = (u) => u * u,
      smooth: Ease = (u) => u * u * (3 - 2 * u);
    type Key = [number, number, Ease?];
    const track = (keys: Key[]) => (t: number) => {
      let i = 0;
      while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
      const [t0, a, ease = lin] = keys[i],
        [t1, b] = keys[i + 1];
      const u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0 || 1)));
      return a + (b - a) * ease(u);
    };
    const depth = track([
      [0, 0],
      [0.27, 0, rise],
      [0.39, dent, fall],
      [0.47, -0.12 * dent, rise],
      [0.57, 0.06 * dent, smooth],
      [0.66, -0.02 * dent, smooth],
      [0.74, 0],
      [1, 0],
    ]);
    const x = track([
      [0, 0],
      [0.06, 0],
      [0.27, dx],
      [0.47, dx],
      [0.78, 0],
      [1, 0],
    ]);
    const flight = track([
      [0, 0],
      [0.06, 0, rise],
      [0.17, top - hop, fall],
      [0.27, top],
      [0.47, top - 0.12 * dent, rise],
      [0.62, top - fly, fall],
      [0.78, 0, rise],
      [0.87, -0.12 * em, fall],
      [0.94, 0],
      [1, 0],
    ]);
    const y = (t: number) =>
      t >= 0.27 && t <= 0.47 ? top + depth(t) : flight(t);
    const squash = track([
      [0, 1],
      [0.06, 1.2, smooth],
      [0.12, 0.92, smooth],
      [0.27, 1, smooth],
      [0.39, 1.15, smooth],
      [0.47, 0.9, smooth],
      [0.56, 1],
      [0.76, 1],
      [0.78, 1.25, smooth],
      [0.84, 1],
      [0.92, 1],
      [0.94, 1.1, smooth],
      [1, 1],
    ]);

    const T = 1000;
    const start = Date.now();
    draw(0);
    view.hidden = false;
    o.style.color = "transparent";
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / T);
      const sx = squash(t);
      dot.style.transform = `translate(${x(t)}px, ${y(t)}px) scale(${sx}, ${1 / sx})`;
      draw(depth(t));
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else {
        view.hidden = true;
        o.style.color = "";
        dot.style.transform = "";
      }
    };
    frame.current = requestAnimationFrame(tick);
  };
  return (
    <span
      ref={mark}
      className={`brand wordmark playful ${className}`}
      translate="no"
      onPointerDown={play}
    >
      {/* One inline run, so the letters keep a common baseline in the flex bar. */}
      <span className="wordmark-text">
        tele
        <span className="wordmark-o">o</span>
        <span className="wordmark-dot">.</span>
        <span className="wordmark-base" aria-hidden="true" />
      </span>
      <canvas
        ref={sheet}
        className="wordmark-sheet"
        aria-hidden="true"
        hidden
      />
    </span>
  );
}
