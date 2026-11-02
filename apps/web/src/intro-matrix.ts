/**
 * Intro variant #1 ("Matrix"): columns of letters fall on a dark screen; the
 * letters of "teleo." are snatched one by one from different sides, fly to the
 * foreground and land exactly on the real (DOM) wordmark, while the rain keeps
 * falling behind it. Everything is drawn on one canvas; the final word is the
 * DOM text so it stays crisp and readable by assistive technology.
 */
const POOL =
  "abcdefghijklmnopqrstuvwxyzабвгдежзийклмнопрстуфхцчшщъыьэюяієїґ0123456789";
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const BG: [number, number, number] = [10, 10, 11];
const TRAIL: [number, number, number] = [245, 245, 247];
const HEAD: [number, number, number] = [255, 255, 255];

export const MATRIX_TIMING = {
  rainIn: 600,
  firstPick: 900,
  pickGap: 380,
  lift: 300,
  flight: 1250,
};
/** When the last letter has landed (ms from the start). */
export const MATRIX_LANDED =
  MATRIX_TIMING.firstPick +
  5 * MATRIX_TIMING.pickGap +
  MATRIX_TIMING.lift +
  MATRIX_TIMING.flight;

// Where each letter is snatched from (screen fractions). Letters on the right
// of the word never come from the left band, so no letter crosses landed ones.
const REGIONS = [
  [0.08, 0.3],
  [0.42, 0.92],
  [0.82, 0.16],
  [0.9, 0.8],
  [0.55, 0.07],
  [0.96, 0.45],
];

const ease = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = () => POOL[(Math.random() * POOL.length) | 0];
const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

type Column = {
  x: number;
  speed: number;
  head: number;
  length: number;
  glyphs: Map<number, string>;
  fixed: Map<number, string>;
  holes: Set<number>;
  rows: number;
  dim: number;
  planned?: boolean;
};
type Slot = { ch: string; x: number; baseline: number; size: number };
type Flight = {
  k: number;
  ch: string;
  col: Column;
  row: number;
  at: number;
  from: { x: number; y: number } | null;
  taken: boolean;
};

export function startMatrixIntro(
  canvas: HTMLCanvasElement,
  word: HTMLElement,
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const T = MATRIX_TIMING;
  let W = 0,
    H = 0,
    dpr = 1,
    fs = 16,
    font = "",
    columns: Column[] = [],
    slots: Slot[] = [],
    flights: Flight[] = [],
    raf = 0,
    last = performance.now();
  const start = last;

  function newColumn(c: number, rows: number, first: boolean): Column {
    return {
      x: c * fs + fs / 2,
      speed: rand(7, 20),
      head: first ? rand(-rows, rows) : rand(-20, -2),
      length: Math.round(rand(8, 30)),
      glyphs: new Map(),
      fixed: new Map(),
      holes: new Set(),
      rows,
      dim: rand(0.45, 1),
    };
  }

  /** Targets are the real glyph positions of the DOM wordmark (one span per letter). */
  function measureWord() {
    const style = getComputedStyle(word);
    const size = parseFloat(style.fontSize);
    font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
    ctx!.font = font;
    const asc = ctx!.measureText("teleo.").fontBoundingBoxAscent || size * 0.95;
    slots = Array.from(word.children, (el) => {
      const r = el.getBoundingClientRect();
      return {
        ch: el.textContent || "",
        x: r.left,
        baseline: r.top + asc,
        size,
      };
    });
  }

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth;
    H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    fs = W < 600 ? 14 : W < 1100 ? 16 : 18;
    measureWord();
    const rows = Math.ceil(H / fs) + 2;
    columns = Array.from({ length: Math.ceil(W / fs) }, (_, c) =>
      newColumn(c, rows, true),
    );
    flights = slots.map((slot, k) => {
      const at = T.firstPick + k * T.pickGap;
      const [fx, fy] = REGIONS[k % REGIONS.length];
      const c = Math.max(
        0,
        Math.min(columns.length - 1, Math.round((fx * W) / fs)),
      );
      const col = columns[c];
      const row = Math.round((fy * H) / fs);
      // Time the stream so its bright head reaches the row as it is snatched.
      col.head = row + 0.6 - (col.speed * at) / 1000;
      col.length = Math.max(col.length, 14);
      col.dim = 1;
      col.planned = true;
      col.fixed.set(row, slot.ch);
      return { k, ch: slot.ch, col, row, at, from: null, taken: false };
    });
  }

  function glyph(col: Column, row: number) {
    const fixed = col.fixed.get(row);
    if (fixed) return fixed;
    let g = col.glyphs.get(row);
    if (!g || Math.random() < 0.015) {
      g = pick();
      col.glyphs.set(row, g);
    }
    return g;
  }

  function frame(now: number) {
    const dt = Math.min(50, now - last);
    last = now;
    const t = now - start;
    const c = ctx!;
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      col.head += (col.speed * dt) / 1000;
      if (
        col.head - col.length > col.rows &&
        !(col.planned && flights.some((f) => f.col === col && !f.taken))
      )
        columns[i] = newColumn(i, col.rows, false);
    }

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = rgba(BG, 1);
    c.fillRect(0, 0, W, H);

    // Rain.
    const rainAlpha = easeOut(clamp(t / T.rainIn));
    c.font = `500 ${fs}px ${MONO}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (const col of columns) {
      const headRow = Math.floor(col.head);
      for (let r = headRow; r > headRow - col.length; r--) {
        if (r < 0 || r > col.rows || col.holes.has(r)) continue;
        const d = headRow - r;
        c.fillStyle =
          d === 0
            ? rgba(HEAD, 0.9 * rainAlpha * col.dim)
            : rgba(
                TRAIL,
                Math.pow(1 - d / col.length, 1.6) * 0.55 * col.dim * rainAlpha,
              );
        c.fillText(glyph(col, r), col.x, r * fs + fs / 2);
      }
    }

    // A soft dark pool behind the word so it reads while the rain continues.
    const pool = ease(clamp((t - T.firstPick) / 2400));
    if (pool > 0) {
      const g = c.createRadialGradient(
        W / 2,
        H / 2,
        0,
        W / 2,
        H / 2,
        Math.max(W * 0.55, 260),
      );
      g.addColorStop(0, rgba(BG, 0.88 * pool));
      g.addColorStop(0.6, rgba(BG, 0.5 * pool));
      g.addColorStop(1, rgba(BG, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }

    // Snatched letters. Landed letters are left to the DOM wordmark.
    for (const f of flights) {
      if (t < f.at) continue;
      const slot = slots[f.k];
      const sx0 = f.col.x;
      const sy0 = f.row * fs + fs / 2;
      if (!f.taken) {
        f.taken = true;
        f.col.holes.add(f.row);
      }
      const p = clamp((t - f.at) / T.lift);
      const q = clamp((t - f.at - T.lift) / T.flight);
      if (q <= 0) {
        // The glyph flares and swells in place.
        const s = fs * (1 + 1.2 * easeOut(p));
        c.font = `600 ${s}px ${MONO}`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillStyle = rgba(HEAD, 0.7 + 0.3 * p);
        c.shadowColor = rgba(HEAD, 0.8);
        c.shadowBlur = 18 * p;
        c.fillText(f.ch, sx0, sy0);
        c.shadowBlur = 0;
        continue;
      }
      const landed = q >= 1;
      const letter = word.children[f.k] as HTMLElement | undefined;
      if (landed && letter && !letter.dataset.landed)
        letter.dataset.landed = "";
      if (landed) continue;
      if (!f.from) {
        c.font = font.replace(/[\d.]+px/, `${fs * 2.2}px`);
        const w0 = c.measureText(f.ch).width;
        f.from = { x: sx0 - w0 / 2, y: sy0 + fs * 0.75 };
      }
      // Toward the viewer: the letter overshoots its final size, then settles.
      const e = ease(q);
      const { x: sx, y: sy } = f.from;
      const tx = slot.x,
        ty = slot.baseline;
      const mx = (sx + tx) / 2,
        my = (sy + ty) / 2,
        dx = tx - sx,
        dy = ty - sy;
      const c1 = { x: mx - dy * 0.2, y: my + dx * 0.2 };
      const c2 = { x: mx + dy * 0.2, y: my - dx * 0.2 };
      const away = (o: { x: number; y: number }) =>
        Math.abs(o.y - H / 2) + Math.abs(o.x - W / 2) * 0.25;
      const ctrl = away(c1) > away(c2) ? c1 : c2;
      const x = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * ctrl.x + e * e * tx;
      const y = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * ctrl.y + e * e * ty;
      const swell = Math.sin(Math.PI * clamp((q - 0.45) / 0.55)) * 0.14;
      const size = (fs * 2.2 + (slot.size - fs * 2.2) * e) * (1 + swell);
      c.save();
      c.translate(x, y);
      c.rotate((1 - e) * (f.k % 2 ? 0.16 : -0.16));
      c.font = font.replace(/[\d.]+px/, `${size}px`);
      c.textAlign = "left";
      c.textBaseline = "alphabetic";
      c.fillStyle = "#f5f5f7";
      c.shadowColor = rgba(HEAD, 0.55);
      c.shadowBlur = 30 * (1 - e) + 10;
      c.fillText(f.ch, 0, 0);
      c.restore();
    }
    raf = requestAnimationFrame(frame);
  }

  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // Keep the timeline; only the geometry is recomputed.
      const taken = flights.map((f) => f.taken);
      layout();
      flights.forEach((f, i) => {
        if (taken[i]) {
          f.taken = true;
          f.col.holes.add(f.row);
        }
      });
    }, 120);
  };
  layout();
  raf = requestAnimationFrame(frame);
  addEventListener("resize", onResize);
  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(resizeTimer);
    removeEventListener("resize", onResize);
  };
}
