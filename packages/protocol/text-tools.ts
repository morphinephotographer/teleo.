/**
 * Plain-text tools for the editor's "More" menu. Every tool is a pure
 * function: text in, text out. Scripts stay plain text, so nothing here adds
 * formatting the Reader or voice follow would not understand.
 */

const bullet = /^[ \t]*(?:[•◦▪▫●○■□‣⁃∙·*]|[-–](?=\s))[ \t]+/;

/**
 * Tidies text pasted from PDFs, Word or web pages: rejoins hard-wrapped
 * lines and words hyphenated across lines, turns list bullets into separate
 * paragraphs, collapses repeated spaces and blank lines. Em dashes that open
 * dialogue lines ("— Привет") and numbered lists are kept.
 */
export function cleanupText(input: string) {
  const lines = input
    .replace(/\r\n?/g, "\n")
    .replace(/[   ]/g, " ")
    .split("\n");
  const paragraphs: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length) paragraphs.push(current.join(" "));
    current = [];
  };
  for (const raw of lines) {
    const line = raw.replace(/[ \t]+/g, " ").trim();
    if (!line) {
      flush();
      continue;
    }
    if (bullet.test(raw) || /^—\s/.test(line)) {
      // A list item or a dialogue line starts its own paragraph.
      flush();
      current.push(line.replace(bullet, "").trim() || line);
      continue;
    }
    const previous = current[current.length - 1];
    if (previous && /\p{L}-$/u.test(previous) && /^\p{Ll}/u.test(line))
      current[current.length - 1] = previous.slice(0, -1) + line;
    else current.push(line);
  }
  flush();
  return paragraphs
    .map((p) => p.replace(/ {2,}/g, " ").replace(/ ([,.;:!?…])/g, "$1"))
    .filter(Boolean)
    .join("\n\n");
}

const abbreviations = new Set(
  [
    // Russian / Ukrainian
    "т",
    "е",
    "д",
    "п",
    "др",
    "г",
    "гг",
    "им",
    "ул",
    "стр",
    "см",
    "напр",
    "тыс",
    "млн",
    "млрд",
    "руб",
    "грн",
    "коп",
    "вул",
    "див",
    "тис",
    "тощо",
    "проф",
    "доц",
    "акад",
    "св",
    // English
    "mr",
    "mrs",
    "ms",
    "dr",
    "prof",
    "st",
    "vs",
    "etc",
    "e.g",
    "i.e",
    "jr",
    "sr",
    "inc",
    "no",
  ].map((a) => a.toLowerCase()),
);

/** Splits one paragraph into sentences without breaking on initials or common abbreviations. */
export function splitSentences(paragraph: string) {
  const text = paragraph.replace(/\s+/g, " ").trim();
  if (!text) return [];
  const sentences: string[] = [];
  let start = 0;
  const end = /([.!?…]+["»”’)]*)\s+(?=["«„“(\[—–-]?\s*[\p{Lu}\p{N}\[])/gu;
  let m: RegExpExecArray | null;
  while ((m = end.exec(text))) {
    const before = text.slice(start, m.index);
    const word = (before.match(/(\S+)$/)?.[1] || "")
      .replace(/^[«„"“(]+/, "")
      .toLowerCase();
    const bare = word.replace(/\.$/, "");
    const isInitial = /^\p{Lu}$/u.test(word) || /^\p{L}$/u.test(bare);
    if (m[1] === "." && (isInitial || abbreviations.has(bare))) continue;
    sentences.push(text.slice(start, m.index + m[1].length).trim());
    start = m.index + m[0].length;
  }
  sentences.push(text.slice(start).trim());
  return sentences.filter(Boolean);
}

/** Every sentence becomes its own paragraph; cues stay where they were. */
export function sentencePerParagraph(input: string) {
  return input
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .flatMap((p) => splitSentences(p))
    .join("\n\n");
}

/** Joins lines and paragraphs into one paragraph. */
export function joinLines(input: string) {
  return input
    .replace(/\s*\n\s*/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Turns text into a reading cue: shown in Reader, skipped by voice follow. */
export function wrapCue(input: string) {
  const inner = input.replace(/[[\]]/g, "").replace(/\s+/g, " ").trim();
  return inner ? `[${inner}]` : "";
}

export type TextCase = "upper" | "lower" | "sentence";
export function changeCase(input: string, mode: TextCase, locale = "ru") {
  if (mode === "upper") return input.toLocaleUpperCase(locale);
  const lower = input.toLocaleLowerCase(locale);
  if (mode === "lower") return lower;
  // Sentence case: capitalise the first letter of the text and after . ! ? …
  return lower.replace(
    /(^|[.!?…]\s+|\n\s*)(["«„“(\[—–-]?\s*)(\p{Ll})/gu,
    (_, lead: string, open: string, letter: string) =>
      lead + open + letter.toLocaleUpperCase(locale),
  );
}

/** Text to insert at a caret so a cue is separated from neighbouring words. */
export function spacedInsertion(text: string, at: number, insertion: string) {
  const before = text[at - 1],
    after = text[at];
  const lead = before && !/\s/.test(before) ? " " : "";
  const tail = after && !/\s/.test(after) ? " " : "";
  return lead + insertion + tail;
}

export function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Seconds needed to read `words` at the Reader speed (150 words/min at 1x). */
export function readingSeconds(words: number, speed = 1) {
  return Math.round((words / (150 * Math.max(0.1, speed))) * 60);
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** All [start, end) ranges of `query` in `text`. */
export function findMatches(text: string, query: string, matchCase = false) {
  if (!query) return [] as [number, number][];
  const pattern = new RegExp(escapeRegExp(query), matchCase ? "gu" : "giu");
  return [...text.matchAll(pattern)].map(
    (m) => [m.index!, m.index! + m[0].length] as [number, number],
  );
}

export function replaceAll(
  text: string,
  query: string,
  replacement: string,
  matchCase = false,
) {
  if (!query) return { text, count: 0 };
  const matches = findMatches(text, query, matchCase);
  let out = "",
    last = 0;
  for (const [a, b] of matches) {
    out += text.slice(last, a) + replacement;
    last = b;
  }
  return { text: out + text.slice(last), count: matches.length };
}

/**
 * The smallest single edit turning `before` into `after`: replacing only what
 * changed keeps the caret, scroll position and a tidy undo step.
 */
export function minimalEdit(before: string, after: string) {
  let start = 0;
  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  )
    start++;
  let endBefore = before.length,
    endAfter = after.length;
  while (
    endBefore > start &&
    endAfter > start &&
    before[endBefore - 1] === after[endAfter - 1]
  ) {
    endBefore--;
    endAfter--;
  }
  return { start, end: endBefore, text: after.slice(start, endAfter) };
}
