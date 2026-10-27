import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  paragraphs,
  type PreviewReceiver,
} from "../../../packages/protocol/preview";
import {
  clockTime,
  timeAt,
  type ControlCommand,
  type ControlValues,
} from "../../../packages/protocol/control";
import { type Key } from "./i18n";
import { AlignmentControl, type Alignment } from "./AlignmentControl";
import { Icon, IconButton, Sheet, type IconName } from "./ui";
import {
  feedback,
  feedbackAvailable,
  feedbackEnabled,
  setFeedback,
} from "./feedback";
import type { PlaybackState } from "./remote";

function HostSlider({
  name,
  icon,
  min,
  max,
  step,
  value,
  disabled,
  onChange,
}: {
  name: string;
  icon: IconName;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<number | null>(null);
  const active = useRef(false);
  const send = useRef(onChange);
  send.current = onChange;
  const flush = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    if (pending.current !== null) {
      send.current(pending.current);
      pending.current = null;
    }
  };
  useEffect(() => {
    if (!active.current) setDraft(null);
  }, [value]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (disabled) {
      clearTimeout(timer.current);
      pending.current = null;
      setDraft(null);
    }
  }, [disabled]);
  return (
    <label className="quick-slider">
      <span className="quick-symbol" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <span className="sr-only">{name}</span>
      <input
        type="range"
        aria-label={name}
        min={min}
        max={max}
        step={step}
        value={draft ?? value}
        disabled={disabled}
        onPointerDown={() => {
          active.current = true;
        }}
        onPointerUp={() => {
          active.current = false;
          flush();
        }}
        onChange={(e) => {
          const next = Number(e.target.value);
          setDraft(next);
          pending.current = next;
          if (!timer.current) timer.current = setTimeout(flush, 200);
        }}
        onBlur={() => {
          active.current = false;
          flush();
          setDraft(null);
        }}
      />
      <output aria-label={name}>{Number.isFinite(value) ? value : "—"}</output>
    </label>
  );
}
export function RemoteController({
  t,
  status,
  state,
  preview,
  onCommand,
  onDisconnect,
  onRequest,
  language,
  onStudio,
}: {
  t: (key: Key) => string;
  status: Key | null;
  state: PlaybackState;
  preview: PreviewReceiver;
  onCommand: (command: ControlCommand) => void;
  onDisconnect: () => void;
  onRequest: () => void;
  language: ReactNode;
  onStudio: () => void;
}) {
  const [quick, setQuick] = useState(false),
    [advanced, setAdvanced] = useState(false),
    [detail, setDetail] = useState<
      | "timer"
      | "fontSize"
      | "lineHeight"
      | "textWidth"
      | "mirror"
      | "focus"
      | "connection"
      | null
    >(null),
    [expanded, setExpanded] = useState(false),
    [visibleText, setVisibleText] = useState(true);
  const [haptics, setHaptics] = useState(feedbackEnabled),
    [scrub, setScrub] = useState<number | null>(null),
    [filling, setFilling] = useState(false);
  const connected = status === "connected",
    c = state.controls;
  const content = useMemo(() => paragraphs(preview.body), [preview.body]);
  const index = Math.max(
    0,
    Math.min(preview.position?.paragraph || 0, content.length - 1),
  );
  const scroll = useRef<HTMLDivElement>(null),
    quickRef = useRef<HTMLDivElement>(null),
    quickTrigger = useRef<HTMLButtonElement>(null);
  const lastSession = useRef("");
  useEffect(() => {
    const changed = () => setFilling(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  useEffect(() => {
    if (!connected) setScrub(null);
  }, [connected]);
  useEffect(() => {
    setScrub(null);
  }, [c?.target]);
  useEffect(() => {
    if (preview.sessionId && preview.sessionId !== lastSession.current) {
      lastSession.current = preview.sessionId;
      setQuick(false);
      setAdvanced(false);
      setExpanded(false);
    }
  }, [preview.sessionId]);
  useEffect(() => {
    if (!quick) return;
    const id = requestAnimationFrame(() =>
      quickRef.current
        ?.querySelector<HTMLInputElement | HTMLButtonElement>("input,button")
        ?.focus(),
    );
    return () => cancelAnimationFrame(id);
  }, [quick]);
  useEffect(() => {
    if (!advanced) return;
    const id = requestAnimationFrame(() =>
      document
        .querySelector<HTMLButtonElement>(
          ".remote-settings-page[open] .sheet-heading button",
        )
        ?.focus(),
    );
    return () => cancelAnimationFrame(id);
  }, [advanced, detail]);
  const closeQuick = () => {
    setQuick(false);
    requestAnimationFrame(() => quickTrigger.current?.focus());
  };
  useEffect(() => {
    if (!quick) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeQuick();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [quick]);
  useEffect(() => {
    const active = scroll.current?.querySelector<HTMLElement>(
      '[aria-current="true"]',
    );
    if (active && scroll.current) {
      const a = active.getBoundingClientRect(),
        r = scroll.current.getBoundingClientRect();
      if (a.top < r.top || a.bottom > r.bottom)
        active.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }, [index, preview.script?.revision, expanded]);
  const act = (action: ControlCommand) => {
    if (!connected) return;
    feedback();
    onCommand(action);
  };
  const pref = (
    key: keyof ControlValues,
    value: number | boolean | Alignment,
  ) => {
    if (c) act({ action: "setPreference", target: c.target, key, value });
  };
  // Collapse a burst to its final choice while retaining host-authoritative selection.
  // A new script or transport state cancels any queued gesture.
  const alignmentFrame = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (alignmentFrame.current !== null)
        cancelAnimationFrame(alignmentFrame.current);
      alignmentFrame.current = null;
    },
    [c?.target, connected],
  );
  const align = (value: Alignment) => {
    if (alignmentFrame.current !== null)
      cancelAnimationFrame(alignmentFrame.current);
    alignmentFrame.current = requestAnimationFrame(() => {
      alignmentFrame.current = null;
      pref("alignment", value);
    });
  };
  const fraction = c?.maximum
    ? Math.max(0, Math.min(1, state.position / c.maximum))
    : 0;
  const shown = scrub ?? fraction,
    time = timeAt(
      shown * (connected ? c?.maximum || 0 : 0),
      connected ? c?.maximum || 0 : 0,
      state.speed,
    );
  const seek = () => {
    if (scrub !== null && c && connected)
      act({ action: "seek", target: c.target, value: scrub });
    setScrub(null);
  };
  const text = !connected ? (
    <p className="remote-empty" role="status">
      {t(status || "pairHelp")}
    </p>
  ) : !preview.allowed ? (
    <div className="remote-empty">
      <h2>{t("previewPrivate")}</h2>
      <p>{t("previewConsentHelp")}</p>
    </div>
  ) : preview.unavailable ? (
    <p className="remote-empty">{t("previewTooLarge")}</p>
  ) : !preview.script ? (
    <p className="remote-empty">{t("previewLoading")}</p>
  ) : !visibleText ? (
    <p className="remote-empty">{t("textHidden")}</p>
  ) : (
    content.map((p, n) => (
      <p
        key={(preview.script?.revision || "") + n}
        data-preview-paragraph={n}
        aria-current={n === index ? "true" : undefined}
        dir="auto"
      >
        {p.text || "\u00a0"}
      </p>
    ))
  );
  async function fullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      setFilling(false);
    } else if (
      document.fullscreenEnabled &&
      document.documentElement.requestFullscreen
    ) {
      try {
        await document.documentElement.requestFullscreen();
        setFilling(true);
      } catch {
        setFilling((v) => !v);
      }
    } else setFilling((v) => !v);
  }
  function displayToggles(only?: "mirror" | "focus") {
    return (
      [
        ["mirrorHorizontal", "mirror"],
        ["mirrorVertical", "mirror"],
        ["focusLine", "align"],
        ["focusDimming", "focus"],
      ] as const
    )
      .filter(
        ([key]) =>
          !only ||
          (only === "mirror"
            ? key.startsWith("mirror")
            : !key.startsWith("mirror")),
      )
      .map(([key, icon]) => (
        <label
          className={
            "remote-toggle" +
            (key === "mirrorVertical" ? " vertical-mirror" : "")
          }
          key={key}
        >
          <Icon name={icon} />
          <span>{t(key === "focusDimming" ? "focus" : key)}</span>
          <input
            type="checkbox"
            checked={!!c?.[key]}
            disabled={!connected || !c}
            onChange={(e) => pref(key, e.target.checked)}
          />
        </label>
      ));
  }
  return (
    <main className={`controller remote-v06${filling ? " viewport-fill" : ""}`}>
      <header className="remote-header">
        <a
          href="/studio"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            onStudio();
          }}
        >
          teleo.
        </a>
        <span
          className={"remote-connection " + (connected ? "online" : "")}
          role="status"
          aria-label={t(status || "pairHelp")}
          title={t(status || "pairHelp")}
        >
          <i />
          <Icon name="monitor" />
          <span className="sr-only">{t(status || "pairHelp")}</span>
        </span>
        <IconButton
          name="gear"
          label={t("advancedSettings")}
          onClick={() => {
            setDetail(null);
            setAdvanced(true);
            setQuick(false);
          }}
        />
      </header>
      <div
        className="remote-text"
        ref={scroll}
        aria-label={t("textSettings")}
        style={{
          fontSize: Math.max(22, Math.min(34, (c?.fontSize || 40) * 0.65)),
          lineHeight: c?.lineHeight || 1.6,
        }}
      >
        {text}
      </div>
      <div className="remote-timeline">
        <div
          className="timeline-track"
          style={{ "--progress": `${shown * 100}%` } as React.CSSProperties}
        >
          <div className="paragraph-markers" aria-hidden="true">
            {preview.allowed &&
              (c?.marks || []).map((mark, i) => (
                <i key={i} style={{ left: `${mark * 100}%` }} />
              ))}
          </div>
          <input
            type="range"
            aria-label={t("position")}
            aria-valuetext={`${clockTime(time.elapsed)} / ${clockTime(time.elapsed + time.remaining)}`}
            min="0"
            max="1000"
            step="1"
            value={Math.round(shown * 1000)}
            disabled={!connected || !c?.maximum}
            onChange={(e) => setScrub(Number(e.target.value) / 1000)}
            onPointerUp={seek}
            onPointerCancel={() => setScrub(null)}
            onKeyUp={(e) => {
              if (
                [
                  "ArrowLeft",
                  "ArrowRight",
                  "Home",
                  "End",
                  "PageUp",
                  "PageDown",
                ].includes(e.key)
              )
                seek();
            }}
            onBlur={seek}
          />
        </div>
        <div className="timeline-time">
          <span>{clockTime(time.elapsed)}</span>
          <span>−{clockTime(time.remaining)}</span>
        </div>
      </div>
      <div className="remote-playback">
        <IconButton
          name="minus"
          label={t("speedDown")}
          disabled={!connected || state.speed <= 0.5}
          onClick={() => act({ action: "speedDown" })}
        />
        <button
          className="remote-main-play"
          aria-label={t(state.playing ? "pause" : "play")}
          disabled={!connected}
          onClick={() => act({ action: state.playing ? "pause" : "play" })}
        >
          <Icon name={state.playing ? "pause" : "play"} />
        </button>
        <IconButton
          name="plus"
          label={t("speedUp")}
          disabled={!connected || state.speed >= 3}
          onClick={() => act({ action: "speedUp" })}
        />
      </div>
      <output className="remote-speed" aria-label={t("speed")}>
        {state.speed.toFixed(2).replace(/0$/, "")}×
      </output>
      <div className="remote-paragraphs">
        <IconButton
          name="paragraphPrevious"
          label={t("previousParagraph")}
          disabled={!connected}
          onClick={() => act({ action: "previousParagraph" })}
        />
        <IconButton
          name="paragraphNext"
          label={t("nextParagraph")}
          disabled={!connected}
          onClick={() => act({ action: "nextParagraph" })}
        />
      </div>
      <button
        ref={quickTrigger}
        className="remote-quick-trigger"
        aria-label={t("quickSettings")}
        aria-expanded={quick}
        aria-controls="remote-quick"
        onClick={() => (quick ? closeQuick() : setQuick(true))}
      >
        <Icon name="settings" />
      </button>
      <Sheet
        id="remote-quick"
        open={quick}
        className="remote-quick-menu"
        title={t("textSettings")}
        closeLabel={t("close")}
        onClose={closeQuick}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div ref={quickRef} className="quick-typography">
          {(
            [
              ["fontSize", "size", 16, 100, 1],
              ["lineHeight", "spacing", 1, 3, 0.1],
              ["textWidth", "width", 280, 1600, 10],
            ] as const
          ).map(([key, icon, min, max, step]) => (
            <HostSlider
              key={(c?.target || "none") + key}
              name={t(key)}
              icon={icon}
              min={min}
              max={max}
              step={step}
              value={c?.[key] || min}
              disabled={!connected || !c}
              onChange={(v) => pref(key, v)}
            />
          ))}
          <div className="quick-alignment">
            <AlignmentControl
              t={t}
              value={c?.alignment}
              disabled={!connected || !c?.alignment}
              onChange={align}
            />
          </div>
        </div>
      </Sheet>
      <Sheet
        open={advanced}
        className="remote-advanced remote-settings-page"
        title={t(detail === "timer" ? "timer" : detail || "quickSettings")}
        closeLabel={t("close")}
        backLabel={t("back")}
        onClose={() => (detail ? setDetail(null) : setAdvanced(false))}
      >
        <div className="remote-settings-content">
          {!detail && (
            <>
              <section>
                <h3>{t("textSettings")}</h3>
                <div className="remote-list">
                  {(
                    [
                      ["fontSize", "size"],
                      ["lineHeight", "spacing"],
                      ["textWidth", "width"],
                    ] as const
                  ).map(([key, icon]) => (
                    <button key={key} onClick={() => setDetail(key)}>
                      <Icon name={icon} />
                      <span>{t(key)}</span>
                      <output>{c?.[key] ?? "—"}</output>
                      <Icon name="chevron" />
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h3>{t("playbackTab")}</h3>
                <div className="remote-list">
                  <button onClick={() => setDetail("timer")}>
                    <Icon name="timer" />
                    <span>{t("timer")}</span>
                    <output>
                      {c?.countdownSeconds
                        ? `${c.countdownSeconds} ${t("seconds")}`
                        : t("off")}
                    </output>
                    <Icon name="chevron" />
                  </button>
                  <label className="remote-toggle">
                    <Icon name="text" />
                    <span>{t("showText")}</span>
                    <input
                      type="checkbox"
                      checked={visibleText}
                      onChange={(e) => setVisibleText(e.target.checked)}
                    />
                  </label>
                </div>
              </section>
              <section>
                <h3>{t("displaySettings")}</h3>
                <div className="remote-list">{displayToggles()}</div>
              </section>
              <section>
                <h3>{t("connection")}</h3>
                <div className="remote-list">
                  <button onClick={() => setDetail("connection")}>
                    <Icon name="monitor" />
                    <span>
                      {t("studio")}
                      <small>{t(status || "pairHelp")}</small>
                    </span>
                    <Icon name="chevron" />
                  </button>
                </div>
              </section>
              <section className="remote-extras">
                {language}
                <button
                  disabled={!preview.allowed || !connected}
                  onClick={() => {
                    setAdvanced(false);
                    setExpanded(true);
                    onRequest();
                  }}
                >
                  {t("expandedText")}
                </button>
                <button onClick={() => void fullscreen()}>
                  {t("fullscreen")}
                </button>
                {feedbackAvailable() ? (
                  <label className="remote-toggle">
                    <span>{t("haptics")}</span>
                    <input
                      type="checkbox"
                      checked={haptics}
                      onChange={(e) => {
                        setHaptics(e.target.checked);
                        setFeedback(e.target.checked);
                      }}
                    />
                  </label>
                ) : (
                  <p>{t("hapticsUnavailable")}</p>
                )}
              </section>
            </>
          )}
          {detail === "timer" && (
            <section>
              <div className="remote-list timer-options">
                {[0, 3, 5, 10].map((n) => (
                  <button
                    key={n}
                    disabled={!connected || !c}
                    aria-pressed={c?.countdownSeconds === n}
                    onClick={() => pref("countdownSeconds", n)}
                  >
                    <span>{n ? `${n} ${t("seconds")}` : t("off")}</span>
                    <span aria-hidden="true">
                      {c?.countdownSeconds === n ? "✓" : ""}
                    </span>
                  </button>
                ))}
              </div>
              <p>{t("countdownHelp")}</p>
            </section>
          )}
          {(
            [
              ["fontSize", "size", 16, 100, 1],
              ["lineHeight", "spacing", 1, 3, 0.1],
              ["textWidth", "width", 280, 1600, 10],
            ] as const
          ).map(
            ([key, icon, min, max, step]) =>
              detail === key && (
                <section key={key}>
                  <HostSlider
                    key={(c?.target || "none") + key}
                    name={t(key)}
                    icon={icon}
                    min={min}
                    max={max}
                    step={step}
                    value={c?.[key] || min}
                    disabled={!connected || !c}
                    onChange={(v) => pref(key, v)}
                  />
                </section>
              ),
          )}
          {(detail === "mirror" || detail === "focus") && (
            <section>
              <div className="remote-list">{displayToggles(detail)}</div>
            </section>
          )}
          {detail === "connection" && (
            <section className="remote-connection-detail">
              <p role="status">{t(status || "pairHelp")}</p>
              <p>
                {t("remotePeer")}: {connected ? t("studio") : "—"}
              </p>
              <p>{t(preview.allowed ? "previewAllowed" : "previewPrivate")}</p>
              {!preview.allowed && <p>{t("previewConsentHelp")}</p>}
              {connected ? (
                <button
                  onClick={() => {
                    onDisconnect();
                    setAdvanced(false);
                  }}
                >
                  {t("revoke")}
                </button>
              ) : (
                <p>{t("newInviteRequired")}</p>
              )}
            </section>
          )}
        </div>
      </Sheet>
      <Sheet
        open={expanded}
        className="remote-expanded"
        title={t("textSettings")}
        closeLabel={t("close")}
        onClose={() => setExpanded(false)}
      >
        <div className="remote-expanded-text">{text}</div>
      </Sheet>
    </main>
  );
}
