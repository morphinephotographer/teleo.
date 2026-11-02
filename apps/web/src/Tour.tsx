import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Key } from "./i18n";
import { localGet, localSet } from "./i18n";
import { Icon } from "./ui";

/**
 * First-run walkthrough for 1.3.0: editor, text tools, phone remote, Reader and
 * voice follow. Non-modal: clicks pass through the shade, so nobody is blocked.
 * Each step spotlights the real control and shows a short looping scene.
 */
export const tourKey = "teleo.tour.v130";

export function tourNeeded() {
  const value = localGet(tourKey);
  if (value === "done") return false;
  // Automated browsers only see the tour when a test opts in.
  if (navigator.webdriver && value !== "force") return false;
  return true;
}
export function markTourDone() {
  localSet(tourKey, "done");
}

export type TourScene = "editor" | "tools" | "phone" | "read" | "voice";
type Step = {
  id: TourScene;
  title: Key;
  body: Key;
  target: string;
  /** The step is shown inside Reader. */
  reader?: boolean;
  /** Used when the target is missing (e.g. no speech recognition in Firefox). */
  fallback?: Key;
};
const steps: Step[] = [
  {
    id: "editor",
    title: "tourEditorTitle",
    body: "tourEditorBody",
    target: ".editor textarea",
  },
  {
    id: "tools",
    title: "tourToolsTitle",
    body: "tourToolsBody",
    target: ".editor-tools-trigger",
  },
  {
    id: "phone",
    title: "tourPhoneTitle",
    body: "tourPhoneBody",
    target: "header .tour-remote",
  },
  {
    id: "read",
    title: "tourReadTitle",
    body: "tourReadBody",
    target: "header .segmented button:last-of-type",
  },
  {
    id: "voice",
    title: "tourVoiceTitle",
    body: "tourVoiceBody",
    target: ".reader-voice",
    reader: true,
    fallback: "tourVoiceUnsupported",
  },
];

function findTarget(selector: string) {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el || el.closest("[inert]")) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth)
    return null;
  return el;
}

type Box = { top: number; left: number; width: number; height: number };
const close = (a: Box | null, b: Box | null) =>
  a === b ||
  (!!a &&
    !!b &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5);

export function Tour({
  t,
  reading,
  onReader,
  onClose,
}: {
  t: (key: Key) => string;
  reading: boolean;
  /** Ask the app to enter (true) or leave (false) Reader for a step. */
  onReader: (open: boolean) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const last = index === steps.length - 1;
  const [box, setBox] = useState<Box | null>(null);
  const [missing, setMissing] = useState(false);
  const [place, setPlace] = useState<React.CSSProperties>({});
  const [sheet, setSheet] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);

  const finish = useCallback(() => {
    markTourDone();
    onClose();
  }, [onClose]);

  // Move between Studio and Reader as the steps require (once per step change).
  const asked = useRef<boolean | null>(null);
  useEffect(() => {
    const want = !!step.reader;
    if (want === reading) {
      asked.current = null;
      return;
    }
    if (asked.current === want) return;
    asked.current = want;
    onReader(want);
  }, [step.reader, reading, onReader]);

  // Follow the real control through layout changes, panel animations and resizes.
  useEffect(() => {
    let frame = 0;
    let previous: Box | null | undefined;
    const started = performance.now();
    setMissing(false);
    const tick = () => {
      const el = findTarget(step.target);
      let next: Box | null = null;
      if (el) {
        const r = el.getBoundingClientRect();
        const pad = r.height > 120 ? 4 : 6;
        next = {
          top: r.top - pad,
          left: r.left - pad,
          width: r.width + pad * 2,
          height: r.height + pad * 2,
        };
      }
      if (previous === undefined || !close(previous, next)) {
        previous = next;
        setBox(next);
      }
      // Give Reader time to open before deciding the control does not exist.
      if (!el && performance.now() - started > 900) setMissing(true);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [step.target]);

  useLayoutEffect(() => {
    const c = card.current;
    if (!c) return;
    const m = 12;
    const narrow = innerWidth < 640;
    setSheet(narrow);
    const h = c.offsetHeight;
    if (narrow) {
      // Phones: a sheet along the bottom, or the top when the control is low.
      const low = box && box.top + box.height / 2 > innerHeight * 0.55;
      setPlace(
        low && box!.height < innerHeight * 0.4
          ? {
              left: m,
              right: m,
              top: `calc(${m}px + env(safe-area-inset-top, 0px))`,
            }
          : {
              left: m,
              right: m,
              bottom: `calc(${m}px + env(safe-area-inset-bottom, 0px))`,
            },
      );
      return;
    }
    const w = Math.min(380, innerWidth - m * 2);
    if (!box) {
      setPlace({
        width: w,
        left: (innerWidth - w) / 2,
        top: Math.max(m, (innerHeight - h) / 2),
      });
      return;
    }
    const gap = 14;
    const below = innerHeight - (box.top + box.height) - gap - m;
    const above = box.top - gap - m;
    let top: number;
    if (below >= h) top = box.top + box.height + gap;
    else if (above >= h) top = box.top - gap - h;
    else top = innerHeight - h - m - 8; // A large target: sit over its lower part.
    top = Math.min(Math.max(m, top), innerHeight - h - m);
    let left = box.left + box.width / 2 - w / 2;
    if (box.width > w * 1.6) left = box.left + box.width - w - 24;
    left = Math.min(Math.max(m, left), innerWidth - w - m);
    setPlace({ width: w, left, top });
  }, [box, index, missing]);

  useEffect(() => {
    primary.current?.focus({ preventScroll: true });
  }, [index]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      finish();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [finish]);

  const small = box && box.width < 90 && box.height < 90;
  const body = missing && step.fallback ? step.fallback : step.body;
  return (
    <div className="tour" data-step={step.id}>
      {box ? (
        <div
          className={"tour-spotlight" + (small ? " small" : "")}
          aria-hidden="true"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
          }}
        >
          {small && <span className="tour-tap" />}
        </div>
      ) : (
        <div className="tour-shade" aria-hidden="true" />
      )}
      <div
        ref={card}
        className={"tour-card" + (sheet ? " sheet" : "")}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        style={place}
      >
        <div className="tour-card-inner" key={step.id}>
          <Scene kind={step.id} />
          <div className="tour-copy">
            <span className="tour-count">
              {index + 1} / {steps.length}
            </span>
            <h2 id="tour-title">{t(step.title)}</h2>
            <p id="tour-body">{t(body)}</p>
          </div>
        </div>
        <div className="tour-foot">
          <div className="tour-progress" aria-hidden="true">
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={i === index ? "current" : i < index ? "seen" : ""}
              />
            ))}
          </div>
          <div className="tour-actions">
            {!last && (
              <button type="button" className="tour-skip" onClick={finish}>
                {t("tourSkip")}
              </button>
            )}
            {index > 0 && (
              <button
                type="button"
                className="tour-back"
                aria-label={t("tourBack")}
                onClick={() => setIndex(index - 1)}
              >
                <Icon name="back" />
              </button>
            )}
            <button
              ref={primary}
              type="button"
              className="primary"
              onClick={() => (last ? finish() : setIndex(index + 1))}
            >
              {t(last ? "tourFinish" : "tourNext")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const bar = (w: number, key: number, extra = "") => (
  <i
    key={key}
    className={"s-bar " + extra}
    style={{ "--w": `${w}%`, "--i": key } as React.CSSProperties}
  />
);

/** Small looping scenes drawn with CSS and the app's own icons. */
function Scene({ kind }: { kind: TourScene }) {
  return (
    <div className={"tour-scene scene-" + kind} aria-hidden="true">
      {kind === "editor" && (
        <div className="s-doc">
          <div className="s-doc-top">
            <span className="s-saved" />
            <span className="s-time" />
          </div>
          <span className="s-title" />
          {[94, 82, 66, 88, 52].map((w, i) => bar(w, i, "type"))}
          <span className="s-caret" />
        </div>
      )}
      {kind === "tools" && (
        <>
          <div className="s-doc s-messy">
            {[70, 96, 40, 84, 60].map((w, i) => bar(w, i, "messy"))}
            <span className="s-cue">[ ]</span>
          </div>
          <div className="s-menu">
            <span className="s-more">
              <Icon name="more" />
            </span>
            <div className="s-menu-list">
              <i />
              <i />
              <i />
              <i className="s-find">⌘F</i>
            </div>
          </div>
        </>
      )}
      {kind === "phone" && (
        <>
          <div className="s-laptop">
            <div className="s-laptop-screen">
              <svg
                viewBox="0 0 7 7"
                className="s-qr"
                shapeRendering="crispEdges"
              >
                {[
                  "1110111",
                  "1010101",
                  "1110111",
                  "0001000",
                  "1110110",
                  "1010011",
                  "1110101",
                ].flatMap((row, y) =>
                  [...row].map((c, x) =>
                    c === "1" ? (
                      <rect key={`${x}${y}`} x={x} y={y} width="1" height="1" />
                    ) : null,
                  ),
                )}
              </svg>
              <span className="s-ok">
                <Icon name="play" />
              </span>
              <span className="s-arrived" />
            </div>
            <div className="s-laptop-base" />
          </div>
          <div className="s-phone">
            <span className="s-scan" />
            <span className="s-remote">
              <i className="s-r-play">
                <Icon name="play" />
              </i>
              <i className="s-r-send">
                <Icon name="documentPlus" />
              </i>
            </span>
          </div>
          <span className="s-flying" />
        </>
      )}
      {kind === "read" && (
        <div className="s-reader">
          <div className="s-roll">
            {[86, 72, 90, 64, 80, 70, 88, 58, 76, 84, 66, 90].map((w, i) =>
              bar(w, i),
            )}
          </div>
          <span className="s-guide" />
          <div className="s-dock">
            <i />
            <i className="s-dock-play">
              <Icon name="play" />
            </i>
            <i />
          </div>
        </div>
      )}
      {kind === "voice" && (
        <div className="s-reader s-voice">
          <div className="s-words">
            {[
              [18, 26, 14, 22],
              [24, 12, 30, 16],
              [16, 28, 20, 18],
              [26, 14, 22, 20],
            ].map((row, r) => (
              <div className="s-row" key={r}>
                {row.map((w, i) => (
                  <i
                    key={i}
                    style={
                      {
                        "--w": `${w}%`,
                        "--n": r * 4 + i,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
            ))}
          </div>
          <span className="s-guide" />
          <span className="s-mic">
            <Icon name="microphone" />
            <b />
            <b />
            <b />
          </span>
        </div>
      )}
    </div>
  );
}
