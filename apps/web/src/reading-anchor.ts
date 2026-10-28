/** One content anchor; DOM geometry is measured after reflow, never a scroll percentage. */
export type ReadingAnchor = {
  paragraph: number;
  offset: number;
  delta: number;
};
function character(node: Text, offset: number) {
  let start = Math.max(0, Math.min(node.length - 1, offset));
  if (start > 0 && /[\uDC00-\uDFFF]/.test(node.data[start])) start--;
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(
    node,
    Math.min(
      node.length,
      start + (node.data.codePointAt(start)! > 0xffff ? 2 : 1),
    ),
  );
  return range.getBoundingClientRect();
}
export function captureAnchor(
  view: HTMLElement,
  focus = 35,
): ReadingAnchor | null {
  const paragraphs = Array.from(
    view.querySelectorAll<HTMLElement>("[data-paragraph]"),
  );
  const y =
    view.getBoundingClientRect().top + (view.clientHeight * focus) / 100;
  if (!paragraphs.length) return null;
  const reversed =
    new DOMMatrixReadOnly(
      getComputedStyle(paragraphs[0].parentElement!).transform,
    ).d < 0;
  // Paragraphs are laid out in source order (reversed visually by mirror V).
  // Find the guide's neighbours without measuring every paragraph each frame.
  let left = 0,
    right = paragraphs.length - 1;
  while (left < right) {
    const mid = Math.floor((left + right) / 2),
      r = paragraphs[mid].getBoundingClientRect();
    if (reversed ? r.top > y : r.bottom < y) left = mid + 1;
    else right = mid;
  }
  let paragraph = -1,
    distance = Infinity;
  for (
    let i = Math.max(0, left - 1);
    i <= Math.min(paragraphs.length - 1, left + 1);
    i++
  ) {
    const p = paragraphs[i];
    if (!(p.firstChild instanceof Text) || !p.firstChild.length) continue;
    const r = p.getBoundingClientRect(),
      d = Math.max(r.top - y, y - r.bottom, 0);
    if (d < distance) {
      distance = d;
      paragraph = i;
    }
  }
  if (paragraph < 0) return null;
  const p = paragraphs[paragraph],
    node = p.firstChild as Text;
  let lo = 0,
    hi = node.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2),
      rect = character(node, mid),
      center = (rect.top + rect.bottom) / 2;
    if (reversed ? center > y : center < y) lo = mid + 1;
    else hi = mid;
  }
  const offset = lo > 0 && /[\uDC00-\uDFFF]/.test(node.data[lo]) ? lo - 1 : lo;
  return { paragraph, offset, delta: character(node, offset).top - y };
}
export function restoreAnchor(
  view: HTMLElement,
  anchor: ReadingAnchor,
  focus = 35,
) {
  const paragraphs = view.querySelectorAll<HTMLElement>("[data-paragraph]");
  const p = paragraphs[Math.min(anchor.paragraph, paragraphs.length - 1)];
  const node = p?.firstChild;
  if (!(node instanceof Text) || !node.length) return view.scrollTop;
  const rect = character(node, anchor.offset),
    y = view.getBoundingClientRect().top + (view.clientHeight * focus) / 100;
  const maximum = Math.max(0, view.scrollHeight - view.clientHeight);
  const old = view.scrollTop;
  view.scrollTop = Math.max(
    0,
    Math.min(maximum, old + rect.top - y - anchor.delta),
  );
  anchor.delta = rect.top - (view.scrollTop - old) - y;
  return view.scrollTop;
}
