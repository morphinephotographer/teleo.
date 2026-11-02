import { useEffect, useRef, useState, type RefObject } from "react";
import { Popover } from "./menus";
import { Icon } from "./ui";
import type { Key } from "./i18n";
import {
  changeCase,
  cleanupText,
  countWords,
  findMatches,
  joinLines,
  minimalEdit,
  readingSeconds,
  replaceAll,
  sentencePerParagraph,
  spacedInsertion,
  wrapCue,
  type TextCase,
} from "../../../packages/protocol/text-tools";

type Translate = (key: Key) => string;
type Area = RefObject<HTMLTextAreaElement | null>;

/**
 * Replaces [start, end) of the editor text the way typing would: through the
 * browser's editing commands, so the change lands in the undo history (⌘Z /
 * Ctrl+Z) and flows through the normal input → autosave path.
 */
export function replaceInEditor(
  area: HTMLTextAreaElement,
  start: number,
  end: number,
  text: string,
  select: "end" | "inserted" = "end",
) {
  const scroll = area.scrollTop;
  const expected = area.value.slice(0, start) + text + area.value.slice(end);
  area.focus({ preventScroll: true });
  area.setSelectionRange(start, end);
  let done = false;
  try {
    done = text
      ? document.execCommand("insertText", false, text)
      : start === end || document.execCommand("delete");
  } catch {
    done = false;
  }
  if (!done || area.value !== expected) {
    area.value = area.value; // keep React's tracker in sync before the change
    area.setRangeText(text, start, end, "end");
    area.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (select === "inserted") area.setSelectionRange(start, start + text.length);
  area.scrollTop = scroll;
}

/** Applies a whole-text transformation as the smallest single edit. */
function replaceWhole(area: HTMLTextAreaElement, next: string) {
  const before = area.value;
  const caret = area.selectionStart;
  const change = minimalEdit(before, next);
  replaceInEditor(area, change.start, change.end, change.text);
  const at = Math.min(caret, area.value.length);
  area.setSelectionRange(at, at);
}

function cueWords(t: Translate) {
  return t("cueList").split("|");
}

export function EditorTools({
  area,
  t,
  locale,
  speed,
  onFind,
}: {
  area: Area;
  t: Translate;
  locale: string;
  speed: number;
  onFind: () => void;
}) {
  const [selection, setSelection] = useState({ start: 0, end: 0, text: "" });
  const [note, setNote] = useState("");
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(noteTimer.current), []);
  const say = (text: string) => {
    clearTimeout(noteTimer.current);
    setNote(text);
    noteTimer.current = setTimeout(() => setNote(""), 2400);
  };
  const hasSelection = selection.text.trim().length > 0;
  const snapshot = () => {
    const el = area.current;
    if (!el) return;
    const start = Math.min(el.selectionStart, el.selectionEnd),
      end = Math.max(el.selectionStart, el.selectionEnd);
    setSelection({ start, end, text: el.value.slice(start, end) });
  };
  /** Runs after the menu has closed and returned focus, then focuses the text. */
  const later = (action: (el: HTMLTextAreaElement) => void) =>
    setTimeout(() => {
      const el = area.current;
      if (el) action(el);
    });
  const transform = (fn: (text: string) => string) =>
    later((el) => {
      const { start, end } = selection;
      if (hasSelection) {
        const before = el.value.slice(start, end),
          next = fn(before);
        if (next === before) return say(t("nothingToChange"));
        replaceInEditor(el, start, end, next, "inserted");
      } else {
        const next = fn(el.value);
        if (next === el.value) return say(t("nothingToChange"));
        replaceWhole(el, next);
      }
      say(t("textUpdated"));
    });
  const onSelection = (fn: (text: string) => string) =>
    later((el) => {
      const { start, end } = selection,
        before = el.value.slice(start, end),
        next = fn(before);
      if (next === before) return say(t("nothingToChange"));
      replaceInEditor(el, start, end, next, "inserted");
      say(t("textUpdated"));
    });
  const insertCue = (word: string) =>
    later((el) => {
      const at = selection.end;
      const text = spacedInsertion(el.value, at, `[${word}]`);
      replaceInEditor(el, at, at, text);
    });
  const words = countWords(selection.text);
  const cases: [TextCase, Key][] = [
    ["upper", "caseUpper"],
    ["lower", "caseLower"],
    ["sentence", "caseSentence"],
  ];
  const mac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  return (
    <div className="editor-tools">
      <span className="editor-tools-note" aria-live="polite">
        {note}
      </span>
      <Popover
        label={t("textTools")}
        className="editor-tools-picker"
        triggerClassName="editor-tools-trigger"
        trigger={<Icon name="more" />}
        width={320}
        maxHeight={680}
        align="end"
        onOpenChange={(open) => open && snapshot()}
      >
        <div className="tools-heading" role="presentation">
          {t("toolsOrganize")}
          <small>
            {hasSelection ? t("appliesToSelection") : t("appliesToScript")}
          </small>
        </div>
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          className="tools-item"
          onClick={() => transform(cleanupText)}
        >
          <strong>{t("toolCleanup")}</strong>
          <small>{t("toolCleanupHint")}</small>
        </button>
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          className="tools-item"
          onClick={() => transform(sentencePerParagraph)}
        >
          <strong>{t("toolSentences")}</strong>
          <small>{t("toolSentencesHint")}</small>
        </button>
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          className="tools-item"
          disabled={!hasSelection}
          onClick={() => onSelection(joinLines)}
        >
          <strong>{t("toolJoin")}</strong>
          <small>{t("toolJoinHint")}</small>
        </button>
        <div className="tools-separator" role="separator" />
        <div className="tools-heading" role="presentation">
          {t("toolsCues")}
          <small>{t("toolCueHint")}</small>
        </div>
        <div
          className="tools-chips"
          role="group"
          aria-label={t("toolInsertCue")}
        >
          {cueWords(t).map((word) => (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="tools-chip"
              key={word}
              onClick={() => insertCue(word)}
            >
              [{word}]
            </button>
          ))}
        </div>
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          className="tools-item"
          disabled={!hasSelection}
          onClick={() => onSelection(wrapCue)}
        >
          <strong>{t("toolWrapCue")}</strong>
        </button>
        <div className="tools-separator" role="separator" />
        <div className="tools-heading" role="presentation">
          {t("textCase")}
          {!hasSelection && <small>{t("selectToApply")}</small>}
        </div>
        <div className="tools-chips" role="group" aria-label={t("textCase")}>
          {cases.map(([mode, key]) => (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="tools-chip"
              key={mode}
              disabled={!hasSelection}
              onClick={() =>
                onSelection((text) => changeCase(text, mode, locale))
              }
            >
              {t(key)}
            </button>
          ))}
        </div>
        <div className="tools-separator" role="separator" />
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          className="tools-item tools-item-row"
          onClick={() => setTimeout(onFind)}
        >
          <strong>{t("toolFind")}</strong>
          <kbd>{mac ? "⌘F" : "Ctrl+F"}</kbd>
        </button>
        {hasSelection && (
          <div className="tools-footer" role="presentation">
            {t("selectionStats")}: {new Intl.NumberFormat(locale).format(words)}{" "}
            {t("words")} · ~{readingSeconds(words, speed)} {t("secondsShort")}
          </div>
        )}
      </Popover>
    </div>
  );
}

/** Find and replace bar shown above the editor text. */
export function FindBar({
  area,
  t,
  onClose,
}: {
  area: Area;
  t: Translate;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(() => {
    const el = area.current;
    const picked = el ? el.value.slice(el.selectionStart, el.selectionEnd) : "";
    return picked.includes("\n") ? "" : picked;
  });
  const [replacement, setReplacement] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState("");
  const [, refresh] = useState(0);
  const text = area.current?.value ?? "";
  const matches = findMatches(text, query, matchCase);
  const active = matches.length ? Math.min(index, matches.length - 1) : -1;
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  // Recount when the text changes while the bar is open.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const update = () => refresh((n) => n + 1);
    el.addEventListener("input", update);
    return () => el.removeEventListener("input", update);
  }, [area]);
  /** Selects a match in the text and scrolls it into view, keeping focus here. */
  const show = (i: number) => {
    const el = area.current,
      m = matches[i];
    if (!el || !m) return;
    const back = document.activeElement as HTMLElement | null;
    // A focused textarea scrolls its selection into view.
    el.focus({ preventScroll: true });
    el.setSelectionRange(m[0], m[1]);
    back?.focus({ preventScroll: true });
    setIndex(i);
  };
  const step = (dir: 1 | -1) => {
    if (!matches.length) return;
    show((active + dir + matches.length) % matches.length);
  };
  const replaceCurrent = () => {
    const el = area.current,
      m = matches[active];
    if (!el || !m) return;
    const back = document.activeElement as HTMLElement | null;
    replaceInEditor(el, m[0], m[1], replacement);
    back?.focus({ preventScroll: true });
    const next = findMatches(el.value, query, matchCase).findIndex(
      ([a]) => a >= m[0] + replacement.length,
    );
    setNote("");
    if (next >= 0) requestAnimationFrame(() => show(next));
  };
  const replaceEvery = () => {
    const el = area.current;
    if (!el) return;
    const result = replaceAll(el.value, query, replacement, matchCase);
    if (!result.count) return;
    const back = document.activeElement as HTMLElement | null;
    replaceWhole(el, result.text);
    back?.focus({ preventScroll: true });
    setNote(t("replacedCount").replace("{n}", String(result.count)));
  };
  const close = () => {
    onClose();
    area.current?.focus();
  };
  const count = !query
    ? ""
    : matches.length
      ? t("matchesOf")
          .replace("{n}", String(active + 1))
          .replace("{total}", String(matches.length))
      : t("noMatches");
  return (
    <div
      className="find-bar"
      role="search"
      aria-label={t("toolFind")}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      <div className="find-row">
        <label className="find-field">
          <Icon name="search" />
          <input
            ref={input}
            aria-label={t("findLabel")}
            placeholder={t("findLabel")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
              setNote("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                step(e.shiftKey ? -1 : 1);
              }
            }}
          />
          <span className="find-count" aria-live="polite">
            {count}
          </span>
        </label>
        <button
          type="button"
          className="icon-button find-step find-previous"
          aria-label={t("findPrevious")}
          title={t("findPrevious")}
          disabled={!matches.length}
          onClick={() => step(-1)}
        >
          <Icon name="chevron" />
        </button>
        <button
          type="button"
          className="icon-button find-step find-next"
          aria-label={t("findNext")}
          title={t("findNext")}
          disabled={!matches.length}
          onClick={() => step(1)}
        >
          <Icon name="chevron" />
        </button>
        <button
          type="button"
          className="icon-button find-close"
          aria-label={t("closeFind")}
          title={t("closeFind")}
          onClick={close}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="find-row">
        <label className="find-field">
          <input
            aria-label={t("replaceLabel")}
            placeholder={t("replaceLabel")}
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                replaceCurrent();
              }
            }}
          />
        </label>
        <button
          type="button"
          className="find-action"
          disabled={!matches.length}
          onClick={replaceCurrent}
        >
          {t("replaceOne")}
        </button>
        <button
          type="button"
          className="find-action"
          disabled={!matches.length}
          onClick={replaceEvery}
        >
          {t("replaceAll")}
        </button>
      </div>
      <div className="find-row find-options">
        <label className="find-case">
          <input
            type="checkbox"
            checked={matchCase}
            onChange={(e) => {
              setMatchCase(e.target.checked);
              setIndex(0);
            }}
          />
          {t("matchCase")}
        </label>
        <span className="find-note" role="status">
          {note}
        </span>
      </div>
    </div>
  );
}
