import { useEffect, useState, useRef, useId } from "react";
import {
  type Playback,
  type Command,
  type Preferences,
} from "../../../packages/protocol/domain";
import { formatSpeed, stepSpeed } from "../../../packages/protocol/speed";
import { type Key } from "./i18n";
import { Icon, IconButton } from "./ui";
import { AlignmentControl } from "./AlignmentControl";
type Typography = "fontSize" | "lineHeight" | "textWidth";
export function ReaderDock({
  engine,
  preferences: p,
  t,
  command,
  preference,
  beforeLayout,
  seek,
}: {
  engine: Playback;
  preferences: Preferences;
  t: (key: Key) => string;
  command: (c: Command) => void;
  preference: (patch: Partial<Preferences>) => void;
  beforeLayout: () => void;
  seek: (position: number) => void;
}) {
  const [compact, setCompact] = useState(
      () =>
        matchMedia(
          "(max-width: 600px), (max-height: 500px) and (max-width: 1000px)",
        ).matches,
    ),
    [expanded, setExpanded] = useState(false);
  const [pane, setPane] = useState<Typography | "tools" | null>(null);
  const dock = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const closePane = () => {
    beforeLayout();
    const selector = pane === "tools" ? ".dock-tools-trigger" : ".dock-aa";
    setPane(null);
    requestAnimationFrame(() =>
      dock.current?.querySelector<HTMLButtonElement>(selector)?.focus(),
    );
  };
  useEffect(() => {
    const mq = matchMedia(
      "(max-width: 600px), (max-height: 500px) and (max-width: 1000px)",
    );
    const update = () => {
      // ResizeObserver restores the pre-resize anchor; do not recapture reflowed text here.
      setCompact(mq.matches);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const change = (value: typeof pane) => {
    beforeLayout();
    setPane((v) => (v === value ? null : value));
  };
  const open = !compact || expanded;
  const [min, max, step] =
    pane === "fontSize"
      ? [16, 100, 1]
      : pane === "lineHeight"
        ? [1, 3, 0.1]
        : [280, 1600, 20];
  return (
    <div
      ref={dock}
      onKeyDown={(e) => {
        if (e.key === "Escape" && pane && !document.fullscreenElement) {
          e.preventDefault();
          e.stopPropagation();
          closePane();
        }
      }}
      className={`reader-controls reader-dock ${compact ? "compact" : "wide"} ${open ? "expanded" : "minimal"}`}
      role="toolbar"
      aria-label={t("playbackSettings")}
    >
      {open && pane && (
        <section
          id={panelId}
          className="dock-inline-panel"
          aria-label={t(pane === "tools" ? "readingTools" : "textSettings")}
        >
          <div className="dock-panel-heading">
            {pane !== "tools" && (
              <div className="dock-text-tabs">
                {(
                  [
                    ["fontSize", "size"],
                    ["lineHeight", "spacing"],
                    ["textWidth", "width"],
                  ] as const
                ).map(([key, icon]) => (
                  <IconButton
                    key={key}
                    name={icon}
                    label={t(key)}
                    active={pane === key}
                    onClick={() => {
                      beforeLayout();
                      setPane(key);
                    }}
                  />
                ))}
              </div>
            )}
            <IconButton name="close" label={t("close")} onClick={closePane} />
          </div>
          {pane !== "tools" ? (
            <>
              <label className="dock-live-slider">
                <Icon
                  name={
                    pane === "fontSize"
                      ? "size"
                      : pane === "lineHeight"
                        ? "spacing"
                        : "width"
                  }
                />
                <input
                  aria-label={t(pane)}
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={p[pane]}
                  onChange={(e) =>
                    preference({ [pane]: Number(e.target.value) })
                  }
                />
                <output>
                  {p[pane]}
                  {pane !== "lineHeight" ? " px" : ""}
                </output>
              </label>
              <AlignmentControl
                t={t}
                value={p.alignment}
                onChange={(alignment) => preference({ alignment })}
              />
            </>
          ) : (
            <div className="dock-secondary">
              <IconButton
                name="mirror"
                label={t("mirrorHorizontal")}
                active={p.mirrorHorizontal}
                onClick={() =>
                  preference({ mirrorHorizontal: !p.mirrorHorizontal })
                }
              />
              <IconButton
                name="mirror"
                className="vertical-mirror"
                label={t("mirrorVertical")}
                active={p.mirrorVertical}
                onClick={() =>
                  preference({ mirrorVertical: !p.mirrorVertical })
                }
              />
              <IconButton
                name="focus"
                label={t("focusLine")}
                active={p.focusLine}
                onClick={() => preference({ focusLine: !p.focusLine })}
              />
              <IconButton
                name="restart"
                label={t("restart")}
                onClick={() => command({ action: "restart" })}
              />
              <div
                className="dock-countdown"
                role="group"
                aria-label={t("timer")}
              >
                {[0, 3, 5, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={p.countdownSeconds === n}
                    onClick={() => preference({ countdownSeconds: n })}
                  >
                    {n ? `${n} ${t("seconds")}` : t("off")}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
      <div className="dock-main-row">
        <IconButton
          name={engine.playing ? "pause" : "play"}
          className="dock-play primary"
          label={t(engine.playing ? "pause" : "play")}
          onClick={() => command({ action: engine.playing ? "pause" : "play" })}
        />
        <div className="dock-group speed-group">
          {open && (
            <IconButton
              name="minus"
              label={t("speedDown")}
              disabled={stepSpeed(engine.speed, -1) === engine.speed}
              onClick={() => command({ action: "speedDown" })}
            />
          )}
          <output aria-label={t("speed")}>{formatSpeed(engine.speed)}×</output>
          {open && (
            <IconButton
              name="plus"
              label={t("speedUp")}
              disabled={stepSpeed(engine.speed, 1) === engine.speed}
              onClick={() => command({ action: "speedUp" })}
            />
          )}
        </div>
        {open && (
          <>
            <div className="dock-group paragraph-group">
              <IconButton
                name="paragraphPrevious"
                label={t("previousParagraph")}
                onClick={() => command({ action: "previousParagraph" })}
              />
              <IconButton
                name="paragraphNext"
                label={t("nextParagraph")}
                onClick={() => command({ action: "nextParagraph" })}
              />
            </div>
            <button
              type="button"
              className="icon-button dock-aa"
              aria-label={t("fontSize")}
              aria-controls={panelId}
              aria-expanded={pane !== null && pane !== "tools"}
              onClick={() => change("fontSize")}
            >
              <span className="aa-glyph" aria-hidden="true">
                Aa
              </span>
            </button>
            {!compact && (
              <>
                <IconButton
                  name="mirror"
                  label={t("mirrorHorizontal")}
                  active={p.mirrorHorizontal}
                  onClick={() =>
                    preference({ mirrorHorizontal: !p.mirrorHorizontal })
                  }
                />
                <IconButton
                  name="mirror"
                  className="vertical-mirror"
                  label={t("mirrorVertical")}
                  active={p.mirrorVertical}
                  onClick={() =>
                    preference({ mirrorVertical: !p.mirrorVertical })
                  }
                />
              </>
            )}
            <IconButton
              name="timer"
              className="dock-tools-trigger"
              label={t("timer")}
              active={pane === "tools"}
              onClick={() => change("tools")}
            />
          </>
        )}
        {compact && (
          <button
            type="button"
            className="icon-button dock-expand"
            aria-label={t(expanded ? "collapseControls" : "expandControls")}
            aria-expanded={expanded}
            onClick={() => {
              beforeLayout();
              setExpanded((v) => !v);
            }}
          >
            <Icon name={expanded ? "next" : "previous"} />
          </button>
        )}
      </div>
      {open && (
        <input
          className="seek dock-seek"
          aria-label={t("position")}
          type="range"
          min={0}
          max={engine.maximum || 1}
          value={Math.min(engine.maximum, engine.position)}
          disabled={engine.maximum <= 0}
          onChange={(e) => seek(Number(e.target.value))}
        />
      )}
    </div>
  );
}
