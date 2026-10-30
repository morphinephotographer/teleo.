import { useEffect, useState, useRef } from "react";
import {
  type Playback,
  type Command,
  type Preferences,
} from "../../../packages/protocol/domain";
import { formatSpeed, stepSpeed } from "../../../packages/protocol/speed";
import { type Key } from "./i18n";
import { Icon, IconButton } from "./ui";
import { AlignmentControl } from "./AlignmentControl";
import { Popover, TeleoMenu } from "./menus";
type Typography = "fontSize" | "lineHeight" | "textWidth";
export function ReaderDock({
  engine,
  preferences: p,
  t,
  command,
  preference,
  beforeLayout,
  dimming,
  setDimming,
  focusPosition,
  setFocusPosition,
  fullscreen,
  moveLine,
  letterSpacing,
  setLetterSpacing,
}: {
  engine: Playback;
  preferences: Preferences;
  t: (key: Key) => string;
  command: (c: Command) => void;
  preference: (patch: Partial<Preferences>) => void;
  beforeLayout: () => void;
  seek: (position: number) => void;
  dimming: boolean;
  setDimming: (value: boolean) => void;
  focusPosition: number;
  setFocusPosition: (value: number) => void;
  fullscreen: () => void;
  moveLine: (direction: number) => void;
  letterSpacing: number;
  setLetterSpacing: (value: number) => void;
}) {
  const [compact, setCompact] = useState(
      () =>
        matchMedia(
          "(max-width: 600px), (max-height: 500px) and (max-width: 1000px)",
        ).matches,
    ),
    [expanded, setExpanded] = useState(false);
  const dock = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    if (engine.playing)
      dock.current
        ?.querySelectorAll<HTMLElement>("[popover]:popover-open")
        .forEach((el) => el.hidePopover());
  }, [engine.playing]);
  if (!compact) {
    const slider = (
      key: Typography | "speed",
      icon: "size" | "spacing" | "width" | "timer",
      min: number,
      max: number,
      step: number,
    ) => {
      const value = key === "speed" ? engine.speed : p[key];
      return (
        <Popover
          kind="dialog"
          width={260}
          className="approved-pill"
          label={t(key)}
          trigger={
            <>
              <Icon name={icon} />
              <span>{key === "speed" ? formatSpeed(value) + "×" : value}</span>
              <Icon name="chevron" />
            </>
          }
        >
          <label className="toolbar-slider">
            {t(key)}
            <output>{value}</output>
            <input
              aria-label={t(key)}
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(e) =>
                key === "speed"
                  ? command({
                      action: "setSpeed",
                      value: Number(e.target.value),
                    })
                  : preference({ [key]: Number(e.target.value) })
              }
            />
          </label>
          {key === "speed" && (
            <div className="toolbar-speed-steps">
              <button
                onClick={() => command({ action: "speedDown" })}
                disabled={stepSpeed(value, -1) === value}
                aria-label={t("speedDown")}
              >
                −
              </button>
              <button
                onClick={() => command({ action: "speedUp" })}
                disabled={stepSpeed(value, 1) === value}
                aria-label={t("speedUp")}
              >
                +
              </button>
            </div>
          )}
        </Popover>
      );
    };
    return (
      <div
        ref={dock}
        inert={engine.playing}
        aria-hidden={engine.playing || undefined}
        className="reader-controls approved-reader-toolbar"
        role="toolbar"
        aria-label={t("playbackSettings")}
      >
        <IconButton
          name="restart"
          label={t("restart")}
          onClick={() => command({ action: "restart" })}
        />
        <IconButton
          name="sun"
          label={t("focusDimming")}
          active={dimming}
          onClick={() => setDimming(!dimming)}
        />
        <Popover
          kind="dialog"
          className="approved-circle"
          label={t("focusLine")}
          trigger={<Icon name="focus" />}
          triggerClassName="icon-button"
          selected={p.focusLine}
        >
          <label className="check">
            <input
              type="checkbox"
              checked={p.focusLine}
              onChange={(e) => preference({ focusLine: e.target.checked })}
            />
            {t("focusLine")}
          </label>
          <label className="toolbar-slider">
            {t("focusPosition")}
            <output>{focusPosition}%</output>
            <input
              aria-label={t("focusPosition")}
              type="range"
              min={20}
              max={70}
              value={focusPosition}
              onChange={(e) => {
                beforeLayout();
                setFocusPosition(Number(e.target.value));
              }}
            />
          </label>
        </Popover>
        <TeleoMenu
          className="approved-pill"
          label={t("timer")}
          closeLabel={t("close")}
          trigger={
            <>
              <Icon name="timer" />
              <span>
                {p.countdownSeconds ? p.countdownSeconds + "s" : t("off")}
              </span>
              <Icon name="chevron" />
            </>
          }
          items={[0, 3, 5, 10].map((n) => ({
            label: n ? `${n} ${t("seconds")}` : t("off"),
            action: () => preference({ countdownSeconds: n }),
          }))}
        />
        {slider("textWidth", "width", 280, 1600, 20)}
        {slider("fontSize", "size", 16, 100, 1)}
        <IconButton
          name={engine.playing ? "pause" : "play"}
          className="dock-play primary"
          label={t(engine.playing ? "pause" : "play")}
          onClick={() => command({ action: engine.playing ? "pause" : "play" })}
        />
        {slider("speed", "timer", 0.5, 3, 0.1)}
        {slider("lineHeight", "spacing", 1, 3, 0.1)}
        <div className="approved-pill approved-alignment">
          <AlignmentControl
            t={t}
            value={p.alignment}
            onChange={(alignment) => preference({ alignment })}
          />
        </div>
        <IconButton
          name="mirror"
          label={t("mirrorHorizontal")}
          active={p.mirrorHorizontal}
          onClick={() => preference({ mirrorHorizontal: !p.mirrorHorizontal })}
        />
        <IconButton
          name="mirror"
          className="vertical-mirror"
          label={t("mirrorVertical")}
          active={p.mirrorVertical}
          onClick={() => preference({ mirrorVertical: !p.mirrorVertical })}
        />
        <IconButton
          name="fullscreen"
          label={t("fullscreen")}
          onClick={fullscreen}
        />
      </div>
    );
  }
  return (
    <div
      ref={dock}
      className="reader-controls reader-dock mobile-reader-dock"
      role="toolbar"
      aria-label={t("playbackSettings")}
    >
      {expanded && (
        <section
          className="mobile-reader-options"
          aria-label={t("readingTools")}
        >
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
              onClick={() => preference({ mirrorVertical: !p.mirrorVertical })}
            />
            <IconButton
              name="focus"
              label={t("focusLine")}
              active={p.focusLine}
              onClick={() => preference({ focusLine: !p.focusLine })}
            />
            <IconButton
              name="sun"
              label={t("focusDimming")}
              active={dimming}
              onClick={() => setDimming(!dimming)}
            />
            <IconButton
              name="restart"
              label={t("restart")}
              onClick={() => command({ action: "restart" })}
            />
          </div>
          {(
            [
              ["fontSize", 16, 100, 1],
              ["lineHeight", 1, 3, 0.1],
              ["textWidth", 280, 1600, 20],
            ] as const
          ).map(([key, min, max, step]) => (
            <label className="mobile-reader-slider" key={key}>
              <span>{t(key)}</span>
              <input
                aria-label={t(key)}
                type="range"
                min={min}
                max={max}
                step={step}
                value={p[key]}
                onChange={(e) => preference({ [key]: Number(e.target.value) })}
              />
              <output>{p[key]}</output>
            </label>
          ))}
          <label className="mobile-reader-slider">
            <span>{t("letterSpacing")}</span>
            <input
              aria-label={t("letterSpacing")}
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={letterSpacing}
              onChange={(e) => {
                beforeLayout();
                setLetterSpacing(Number(e.target.value));
              }}
            />
            <output>{letterSpacing}</output>
          </label>
          <div className="dock-countdown" role="group" aria-label={t("timer")}>
            <span>{t("timer")}</span>
            {[0, 3, 5, 10].map((n) => (
              <button
                key={n}
                aria-pressed={p.countdownSeconds === n}
                onClick={() => preference({ countdownSeconds: n })}
              >
                {n ? n + "s" : t("off")}
              </button>
            ))}
          </div>
          <AlignmentControl
            t={t}
            value={p.alignment}
            onChange={(alignment) => preference({ alignment })}
          />
        </section>
      )}
      <div className="mobile-reader-main">
        <div className="mobile-speed">
          <IconButton
            name="minus"
            label={t("speedDown")}
            disabled={stepSpeed(engine.speed, -1) === engine.speed}
            onClick={() => command({ action: "speedDown" })}
          />
          <output aria-label={t("speed")}>{formatSpeed(engine.speed)}×</output>
          <IconButton
            name="plus"
            label={t("speedUp")}
            disabled={stepSpeed(engine.speed, 1) === engine.speed}
            onClick={() => command({ action: "speedUp" })}
          />
        </div>
        <IconButton
          name={engine.playing ? "pause" : "play"}
          className="dock-play primary"
          label={t(engine.playing ? "pause" : "play")}
          onClick={() => command({ action: engine.playing ? "pause" : "play" })}
        />
        <div className="mobile-lines">
          <IconButton
            name="paragraphPrevious"
            label={t("previousLine")}
            onClick={() => moveLine(-1)}
          />
          <IconButton
            name="paragraphNext"
            label={t("nextLine")}
            onClick={() => moveLine(1)}
          />
          <button
            className="icon-button dock-expand"
            aria-label={t(expanded ? "collapseControls" : "expandControls")}
            aria-expanded={expanded}
            onClick={() => {
              beforeLayout();
              setExpanded(!expanded);
            }}
          >
            <Icon name={expanded ? "next" : "previous"} />
          </button>
        </div>
      </div>
    </div>
  );
}
