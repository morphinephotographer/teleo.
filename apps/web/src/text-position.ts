import { captureAnchor } from "./reading-anchor";
type Block = { text: string; offset: number };
function geometry(p: HTMLElement) {
  const node = p.firstChild;
  if (!(node instanceof Text) || !node.length) return null;
  const reverse =
    new DOMMatrixReadOnly(getComputedStyle(p.parentElement!).transform).d < 0;
  const rect = p.getBoundingClientRect();
  const top = reverse ? -rect.bottom : rect.top;
  const y = (offset: number) => {
    const range = document.createRange();
    let i = Math.max(0, Math.min(node.length - 1, offset));
    if (i > 0 && /[\uDC00-\uDFFF]/.test(node.data[i])) i--;
    range.setStart(node, i);
    range.setEnd(
      node,
      Math.min(node.length, i + (node.data.codePointAt(i)! > 0xffff ? 2 : 1)),
    );
    const r = range.getBoundingClientRect();
    return reverse ? -r.bottom : r.top;
  };
  const first = y(0);
  const line = (at: number) => {
    const row = y(at);
    let lo = 0,
      hi = at;
    while (lo < hi) {
      const m = Math.floor((lo + hi) / 2);
      if (y(m) < row - 0.5) lo = m + 1;
      else hi = m;
    }
    const start = lo;
    lo = at + 1;
    hi = node.length;
    while (lo < hi) {
      const m = Math.floor((lo + hi) / 2);
      if (y(m) <= row + 0.5) lo = m + 1;
      else hi = m;
    }
    const end = lo,
      lineTop = top + row - first;
    const next = p.nextElementSibling?.getBoundingClientRect();
    const advance =
      end < node.length
        ? y(end) - row
        : next
          ? (reverse ? -next.bottom : next.top) - lineTop
          : parseFloat(getComputedStyle(p).lineHeight);
    return { start, end, top: lineTop, advance: Math.max(1, advance || 1) };
  };
  return { node, y, line, reverse };
}
/** Continuous character coordinate; no paragraph percentage or device-specific pixel ratio. */
export function textOffsetAtView(
  view: HTMLElement,
  blocks: Block[],
  focus = 0,
) {
  const anchor = captureAnchor(view, focus);
  const p =
    anchor &&
    view.querySelectorAll<HTMLElement>("[data-paragraph]")[anchor.paragraph];
  const g = p && geometry(p);
  if (!anchor || !g || !blocks[anchor.paragraph]) return 0;
  const rect = view.getBoundingClientRect(),
    screen = rect.top + (view.clientHeight * focus) / 100;
  const target = g.reverse ? -screen : screen;
  let lo = 0,
    hi = g.node.length - 1;
  // Find a character on the last rendered line that starts before the guide.
  const firstY = g.y(0),
    pTop = g.reverse
      ? -p.getBoundingClientRect().bottom
      : p.getBoundingClientRect().top;
  while (lo < hi) {
    const m = Math.ceil((lo + hi) / 2);
    if (pTop + g.y(m) - firstY <= target) lo = m;
    else hi = m - 1;
  }
  const row = g.line(lo),
    fraction = Math.max(0, Math.min(1, (target - row.top) / row.advance));
  return (
    blocks[anchor.paragraph].offset +
    Math.min(
      blocks[anchor.paragraph].text.length,
      row.start + (row.end - row.start) * fraction,
    )
  );
}
export function scrollToTextOffset(
  view: HTMLElement,
  blocks: Block[],
  offset: number,
  focus = 0,
) {
  if (!blocks.length) return;
  let index = blocks.length - 1;
  while (index > 0 && blocks[index].offset > offset) index--;
  const p = view.querySelectorAll<HTMLElement>("[data-paragraph]")[index];
  const g = p && geometry(p);
  if (!g) return;
  const local = Math.max(
    0,
    Math.min(blocks[index].text.length, offset - blocks[index].offset),
  );
  const row = g.line(Math.min(g.node.length - 1, Math.floor(local)));
  const point =
    row.top +
    Math.max(
      0,
      Math.min(1, (local - row.start) / Math.max(1, row.end - row.start)),
    ) *
      row.advance;
  const r = view.getBoundingClientRect(),
    screen = r.top + (view.clientHeight * focus) / 100;
  const delta = point - (g.reverse ? -screen : screen);
  view.scrollTop = Math.max(
    0,
    Math.min(
      view.scrollHeight - view.clientHeight,
      view.scrollTop + delta * (g.reverse ? -1 : 1),
    ),
  );
}

/** Last gesture sample wins; final release never creates a burst. */
export class SeekQueue {
  private timer?: ReturnType<typeof setTimeout>;
  private latest?: { value: number; anchor?: number };
  private last = -Infinity;
  constructor(
    private send: (value: number, anchor?: number) => void,
    private interval = 120,
  ) {}
  get pending() {
    return !!this.latest;
  }
  push(value: number, anchor?: number) {
    this.latest = { value, anchor };
    if (this.timer) return;
    const delay = Math.max(0, this.interval - (performance.now() - this.last));
    if (delay)
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.flush();
      }, delay);
    else this.flush();
  }
  private flush() {
    const next = this.latest;
    this.latest = undefined;
    if (next) {
      this.last = performance.now();
      this.send(next.value, next.anchor);
    }
  }
  cancel() {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.latest = undefined;
  }
}
