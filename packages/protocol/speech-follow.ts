/**
 * Speech-to-script alignment for voice follow.
 *
 * Ported from Textream 1.7.1 (SpeechTextAlignment.swift, PromptMatcher.swift),
 * Copyright (c) 2026 Fatih Kadir Akin, MIT License — see THIRD_PARTY_NOTICES.md.
 *
 * Differences from the original: offsets are UTF-16 indices into the
 * unmodified script body (the same coordinate the Reader's paragraph blocks
 * use), so whitespace and blank lines are never collapsed; "ё" folds to "е";
 * the word scan, not an average of both scans, sets the position.
 *
 * The recognizer hands us the whole transcript of its current session on
 * every result. Two strategies scan it from the last confirmed position — a
 * character-level fuzzy walk and a word-level fuzzy walk — and their result is
 * committed only when it is unlikely to be a false positive.
 */

type Token = { start: number; end: number; key: string; skip: boolean };

const wordChar = /[\p{L}\p{N}]/u;
const isWordChar = (c: string) => wordChar.test(c);

function fold(c: string) {
  const lower = c.toLowerCase();
  const single = lower.length === 1 ? lower : c;
  return single === "ё" ? "е" : single;
}

/** Lower-cased letters, digits and spaces only. */
export function normalizeSpoken(text: string) {
  let out = "";
  for (const c of text) {
    if (isWordChar(c)) out += [...c].map(fold).join("");
    else if (/\s/.test(c)) out += " ";
  }
  return out;
}

const nonWordChars = /[^\p{L}\p{N}]+/gu;
function wordKey(word: string) {
  return word.toLowerCase().replace(nonWordChars, "").replace(/ё/g, "е");
}

/** Closed `[...]` cues; they are never expected to be spoken. */
export function annotationRanges(text: string) {
  const ranges: [number, number][] = [];
  let open = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "[" && open < 0) open = i;
    else if (text[i] === "]" && open >= 0) {
      ranges.push([open, i + 1]);
      open = -1;
    }
  }
  return ranges;
}

function editDistance(a: string, b: string) {
  const x = [...a],
    y = [...b];
  let row = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const next = [i];
    for (let j = 1; j <= y.length; j++)
      next[j] =
        x[i - 1] === y[j - 1]
          ? row[j - 1]
          : Math.min(row[j - 1], row[j], next[j - 1]) + 1;
    row = next;
  }
  return row[y.length];
}

/** Tolerates recognizer spelling and inflection differences; short words must match exactly. */
export function fuzzyWordMatch(a: string, b: string) {
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = Math.min([...a].length, [...b].length);
  if (shorter <= 2) return false;
  // A partially recognized word ("telepro" → "teleprompters").
  if (shorter >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  let shared = 0;
  const x = [...a],
    y = [...b];
  while (shared < shorter && x[shared] === y[shared]) shared++;
  // Same stem, different ending ("презентация" / "презентации"). At least 4
  // letters: Slavic prefixes such as "роз-" or "при-" alone are not a match.
  if (shared >= Math.max(4, Math.ceil((shorter * 3) / 5))) return true;
  const distance = editDistance(a, b);
  if (shorter <= 4) return distance <= 1;
  if (shorter <= 8) return distance <= 2;
  return distance <= Math.floor(Math.max(x.length, y.length) / 3);
}

/**
 * The in-order word scan decides the position, so it always lands on a word
 * boundary; the character scan only confirms it. Textream averages the two,
 * which leaves the position mid-word after one misrecognized letter and lets
 * unrelated speech nudge it forward.
 */
export function bestOffset(_characterResult: number, wordResult: number) {
  return Math.max(0, wordResult);
}

/** Shortest run of spoken words searched across the whole script. */
const RELOCATE_WORDS = 3;
/** …and their minimum combined letters, so short common words never trigger a jump. */
const RELOCATE_LETTERS = 10;
/** Longest run of recent words compared when a phrase occurs in several places. */
const RELOCATE_LONGEST = 8;

export class SpeechFollower {
  readonly text: string;
  private ranges: [number, number][];
  private tokens: Token[];
  /** Token indices per distinct spoken word, for whole-script phrase search. */
  private byKey = new Map<string, number[]>();
  private confirmed: number;
  private matchStart: number;
  private recent: number[] = [];
  private anchor = "";
  private lastTranscript = "";
  private lastJumpAt = -Infinity;
  /** A distant phrase match waiting for the next spoken word to confirm it. */
  private pending: { last: number } | null = null;

  constructor(text: string, start = 0) {
    this.text = text;
    this.ranges = annotationRanges(text);
    this.tokens = this.tokenize();
    this.tokens.forEach((token, index) => {
      if (token.skip) return;
      const list = this.byKey.get(token.key);
      if (list) list.push(index);
      else this.byKey.set(token.key, [index]);
    });
    this.confirmed = this.advancePastAnnotations(this.clamp(start));
    this.matchStart = this.confirmed;
  }

  /** Confirmed read position: the start of the next unread word. */
  get position() {
    return this.confirmed;
  }

  /** A new recognizer session starts a fresh transcript from the current position. */
  restart() {
    this.matchStart = this.confirmed;
    this.recent = [];
    this.anchor = "";
    this.lastTranscript = "";
    this.pending = null;
  }

  /** Manual move (tap, scroll). Keeps the session; ignores speech said before the jump. */
  jump(offset: number, now = 0) {
    this.confirmed = this.advancePastAnnotations(this.clamp(offset));
    this.matchStart = this.confirmed;
    this.recent = [];
    this.anchor = this.lastTranscript;
    this.lastJumpAt = now;
    this.pending = null;
    return this.confirmed;
  }

  match(transcript: string, now = 0) {
    if (now - this.lastJumpAt <= 300) {
      this.anchor = transcript;
      return this.confirmed;
    }
    this.lastTranscript = transcript;
    let spoken = transcript;
    if (this.anchor) {
      let common = 0;
      while (
        common < this.anchor.length &&
        common < transcript.length &&
        this.anchor[common] === transcript[common]
      )
        common++;
      const trim = Math.min(
        transcript.length,
        Math.max(common, this.anchor.length - 24),
      );
      spoken = transcript.slice(trim);
    }
    if (!spoken.trim()) return this.confirmed;
    const words = spoken.split(/\s+/).map(wordKey).filter(Boolean);
    if (this.matchStart < this.text.length) this.followNearby(spoken);
    if (words.length >= RELOCATE_WORDS) this.relocate(words, transcript);
    return this.confirmed;
  }

  /** In-order tracking from the last confirmed position (Textream's approach). */
  private followNearby(spoken: string) {
    const characterResult = this.characterMatch(spoken) - this.matchStart;
    const wordResult = this.wordMatch(spoken) - this.matchStart;
    const raw = Math.min(
      this.matchStart + bestOffset(characterResult, wordResult),
      this.text.length,
    );
    const candidate = this.advancePastAnnotations(raw);
    if (candidate <= this.confirmed) return;

    this.recent.push(candidate);
    if (this.recent.length > 3) this.recent.shift();
    const agreed =
      this.recent.filter((p) => Math.abs(p - candidate) <= 10).length >= 2;
    const bothProgressed = Math.min(characterResult, wordResult) > 0;
    const skippedAnnotation = candidate > raw;
    const smallStep = candidate - this.confirmed <= 15;
    if (bothProgressed || skippedAnnotation || agreed || smallStep)
      this.confirmed = candidate;
  }

  /**
   * The reader skipped ahead, jumped to another paragraph or went back.
   * Find the longest run of the latest spoken words (up to 8) as consecutive
   * script words. If that run is not where the reader currently is, the
   * occurrence nearest the current position becomes a candidate, and the
   * position moves there once the next spoken word continues at that place.
   * Runs include words the in-order tracker already took: it tolerates single
   * mismatched words and can otherwise follow a repetitive script into the
   * wrong section.
   */
  private relocate(words: string[], transcript: string) {
    let places: number[] = [];
    for (
      let length = Math.min(words.length, RELOCATE_LONGEST);
      length >= RELOCATE_WORDS && !places.length;
      length--
    ) {
      const tail = words.slice(-length);
      if (tail.join("").length < RELOCATE_LETTERS) break;
      places = this.findPhrase(tail);
    }
    const here = this.tokenIndexAt(this.confirmed) - 1; // last word read
    if (!places.length || places.some((last) => Math.abs(last - here) <= 2)) {
      this.pending = null; // nothing found, or the reader is already there
      return;
    }
    let best = places[0];
    for (const last of places)
      if (
        Math.abs(last - here) < Math.abs(best - here) ||
        (Math.abs(last - here) === Math.abs(best - here) && last > best)
      )
        best = last;
    const pending = this.pending;
    if (pending && best === pending.last) return; // same words, revised
    if (pending && best > pending.last && best - pending.last <= 4) {
      this.confirmed = this.advancePastAnnotations(this.after(best));
      this.matchStart = this.confirmed;
      this.recent = [];
      this.anchor = transcript;
      this.pending = null;
      return;
    }
    this.pending = { last: best };
  }

  /** Token indices where `keys` occur as consecutive spoken words (cues skipped). */
  private findPhrase(keys: string[]) {
    const ends: number[] = [];
    const tokens = this.tokens;
    // Compare each distinct word once instead of every occurrence.
    const starts: number[] = [];
    for (const [key, indices] of this.byKey)
      if (fuzzyWordMatch(key, keys[0])) starts.push(...indices);
    starts.sort((a, b) => a - b);
    for (const i of starts) {
      let j = i,
        k = 1;
      while (k < keys.length) {
        j++;
        while (j < tokens.length && tokens[j].skip) j++;
        if (j >= tokens.length || !fuzzyWordMatch(tokens[j].key, keys[k]))
          break;
        k++;
      }
      if (k === keys.length) ends.push(j);
    }
    return ends;
  }

  private tokenIndexAt(offset: number) {
    const index = this.tokens.findIndex((t) => t.start >= offset);
    return index < 0 ? this.tokens.length : index;
  }

  /** Offset of the word following token `index`. */
  private after(index: number) {
    return index + 1 < this.tokens.length
      ? this.tokens[index + 1].start
      : this.tokens[index].end;
  }

  /** Clamps to the text and snaps an offset inside a word back to that word's start. */
  private clamp(offset: number) {
    const value = Math.max(
      0,
      Math.min(this.text.length, Math.floor(offset) || 0),
    );
    const token = this.tokens?.find((t) => t.start < value && value < t.end);
    return token ? token.start : value;
  }

  private annotationAt(index: number) {
    return this.ranges.find(([a, b]) => index >= a && index < b);
  }

  advancePastAnnotations(offset: number) {
    let current = this.clamp(offset);
    let skipped = false;
    while (current < this.text.length) {
      const inside = this.annotationAt(current);
      if (inside) {
        current = inside[1];
        skipped = true;
        continue;
      }
      let next = current;
      while (next < this.text.length && /\s/.test(this.text[next])) next++;
      const ahead = this.ranges.find(([a]) => a === next);
      if (ahead) {
        current = ahead[1];
        skipped = true;
        continue;
      }
      return skipped ? next : current;
    }
    return current;
  }

  private tokenize() {
    const tokens: Token[] = [];
    const pattern = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(this.text))) {
      const start = m.index,
        end = start + m[0].length;
      // Only the part of the word outside `[...]` cues is ever spoken.
      let spokenPart = m[0];
      if (this.ranges.some(([a, b]) => a < end && b > start)) {
        spokenPart = "";
        for (let i = start; i < end; i++)
          if (!this.annotationAt(i)) spokenPart += this.text[i];
      }
      const key = wordKey(spokenPart);
      tokens.push({ start, end, key, skip: !key });
    }
    return tokens;
  }

  /** Character-level fuzzy walk; returns an absolute offset. */
  private characterMatch(spoken: string) {
    const src = this.text;
    const spk = [...normalizeSpoken(spoken)];
    let si = this.matchStart,
      ri = 0,
      lastGood = this.matchStart;
    const same = (i: number, c: string) => fold(src[i]) === c;
    while (si < src.length && ri < spk.length) {
      const annotation = this.annotationAt(si);
      if (annotation) {
        si = annotation[1];
        lastGood = si;
        continue;
      }
      if (!isWordChar(src[si])) {
        si++;
        continue;
      }
      if (!isWordChar(spk[ri])) {
        ri++;
        continue;
      }
      if (same(si, spk[ri])) {
        si++;
        ri++;
        lastGood = si;
        continue;
      }
      let found = false;
      for (let skip = 1; skip <= Math.min(5, spk.length - ri - 1); skip++)
        if (same(si, spk[ri + skip])) {
          ri += skip;
          found = true;
          break;
        }
      if (found) continue;
      for (let skip = 1; skip <= Math.min(5, src.length - si - 1); skip++)
        if (same(si + skip, spk[ri])) {
          si += skip;
          found = true;
          break;
        }
      if (found) continue;
      ri++;
    }
    // Move past trailing punctuation, spaces and cues to the next word.
    while (si < src.length) {
      const annotation = this.annotationAt(si);
      if (annotation) si = annotation[1];
      else if (!isWordChar(src[si])) si++;
      else break;
      lastGood = si;
    }
    return lastGood;
  }

  /** Word-level fuzzy walk; returns the start of the next unread word. */
  private wordMatch(spoken: string) {
    const tokens = this.tokens;
    let si = tokens.findIndex((t) => t.end > this.matchStart);
    if (si < 0) return this.matchStart;
    const words = spoken.split(/\s+/).map(wordKey).filter(Boolean);
    let ri = 0,
      position = this.matchStart;
    const after = (index: number) =>
      index + 1 < tokens.length ? tokens[index + 1].start : tokens[index].end;
    while (si < tokens.length && ri < words.length) {
      const token = tokens[si];
      if (token.skip) {
        position = after(si);
        si++;
        continue;
      }
      if (fuzzyWordMatch(token.key, words[ri])) {
        position = after(si);
        si++;
        ri++;
        continue;
      }
      let found = false;
      for (let skip = 1; skip <= Math.min(5, words.length - ri - 1); skip++)
        if (fuzzyWordMatch(token.key, words[ri + skip])) {
          ri += skip;
          found = true;
          break;
        }
      if (found) continue;
      for (let skip = 1; skip <= Math.min(5, tokens.length - si - 1); skip++) {
        const ahead = tokens[si + skip];
        if (!ahead.skip && fuzzyWordMatch(ahead.key, words[ri])) {
          si += skip;
          found = true;
          break;
        }
      }
      if (found) continue;
      ri++;
    }
    while (si < tokens.length && tokens[si].skip) {
      position = after(si);
      si++;
    }
    return Math.max(position, this.matchStart);
  }
}

/** Speech recognition language for a script: Ukrainian/Russian letters, else the UI language. */
export function speechLanguage(text: string, uiLocale: string) {
  const sample = text.replace(/\[[^\]]*\]/g, " ").slice(0, 6000);
  const cyrillic = (sample.match(/\p{Script=Cyrillic}/gu) || []).length;
  const latin = (sample.match(/\p{Script=Latin}/gu) || []).length;
  if (cyrillic > latin) {
    const uk = (sample.match(/[ґєіїҐЄІЇ]/g) || []).length;
    const ru = (sample.match(/[ыэъёЫЭЪЁ]/g) || []).length;
    if (uk > ru) return "uk-UA";
    if (ru > uk) return "ru-RU";
    return uiLocale === "uk" ? "uk-UA" : "ru-RU";
  }
  if (latin > 0) return "en-US";
  return uiLocale === "uk" ? "uk-UA" : uiLocale === "ru" ? "ru-RU" : "en-US";
}
