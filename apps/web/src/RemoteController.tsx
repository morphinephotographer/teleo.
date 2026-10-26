import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Action } from "../../../packages/protocol/domain";
import {
  paragraphs,
  type PreviewReceiver,
} from "../../../packages/protocol/preview";
import { type Key, localGet, localSet } from "./i18n";
import { Icon, IconButton, Segmented } from "./ui";
import { TeleoSelect } from "./menus";
import {
  feedback,
  feedbackAvailable,
  feedbackEnabled,
  setFeedback,
} from "./feedback";
import type { PlaybackState } from "./remote";

// Sampled smooth Bezier outline, normalized to a scalable polygon. CSS clipping also
// clips hit-testing, so the transparent flank never intercepts the central controls.
function speedOutline() {
  const points: number[][] = [[0.2, 0.07]];
  const curve = (a: number[], b: number[], c: number[], d: number[]) => {
    for (let n = 1; n <= 12; n++) {
      const t = n / 12,
        u = 1 - t;
      points.push([
        u * u * u * a[0] +
          3 * u * u * t * b[0] +
          3 * u * t * t * c[0] +
          t * t * t * d[0],
        u * u * u * a[1] +
          3 * u * u * t * b[1] +
          3 * u * t * t * c[1] +
          t * t * t * d[1],
      ]);
    }
  };
  curve([0.2, 0.07], [0.25, 0.02], [0.26, 0.12], [0.3, 0.19]);
  curve([0.3, 0.19], [0.42, 0.4], [0.63, 0.56], [0.83, 0.67]);
  curve([0.83, 0.67], [0.91, 0.72], [0.88, 0.79], [0.9, 0.84]);
  curve([0.9, 0.84], [0.94, 0.95], [0.87, 0.98], [0.74, 0.98]);
  points.push([0.2, 0.98]);
  curve([0.2, 0.98], [0.07, 0.98], [0.04, 0.92], [0.06, 0.83]);
  points.push([0.07, 0.38]);
  curve([0.07, 0.38], [0.08, 0.25], [0.13, 0.12], [0.2, 0.07]);
  return (
    "polygon(" +
    points
      .map(([x, y]) => `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`)
      .join(",") +
    ")"
  );
}
export const SPEED_CLIP = speedOutline();
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
  onCommand: (action: Action) => void;
  onDisconnect: () => void;
  onRequest: () => void;
  language: ReactNode;
  onStudio: () => void;
}) {
  const [tab, setTab] = useState("remote"),
    [appearance, setAppearance] = useState(
      localGet("teleo.remoteAppearance") || "light",
    ),
    [haptics, setHaptics] = useState(feedbackEnabled);
  const lastSession = useRef("");
  useEffect(() => {
    if (preview.sessionId && preview.sessionId !== lastSession.current) {
      lastSession.current = preview.sessionId;
      setTab("remote");
    }
  }, [preview.sessionId]);
  const scroll = useRef<HTMLDivElement>(null);
  const content = useMemo(() => paragraphs(preview.body), [preview.body]);
  const index = Math.min(preview.position?.paragraph || 0, content.length - 1);
  useEffect(() => {
    if (tab !== "text") return;
    const active = scroll.current?.querySelector<HTMLElement>(
      '[aria-current="true"]',
    );
    if (active && scroll.current) {
      const a = active.getBoundingClientRect(),
        r = scroll.current.getBoundingClientRect();
      if (a.top < r.top || a.bottom > r.bottom)
        active.scrollIntoView({ block: "nearest", behavior: "auto" });
    }
  }, [tab, index, preview.script?.revision]);
  const textNodes = useMemo(
    () =>
      content.map((p, n) => (
        <p
          key={(preview.script?.revision || "none") + ":" + n}
          data-preview-paragraph={n}
          aria-current={n === index ? "true" : undefined}
          dir="auto"
        >
          {p.text || "\u00a0"}
        </p>
      )),
    [content, index, preview.script?.revision],
  );
  const connected = status === "connected";
  const act = (a: Action) => {
    feedback();
    onCommand(a);
  };
  return (
    <main className={"controller remote-v03 remote-appearance-" + appearance}>
      <header className="remote-header">
        <a
          href="/studio"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            onStudio();
          }}
        >
          teleo<span>.</span>
        </a>
        <div className="remote-header-actions">
          {language}
          <IconButton
            name="settings"
            label={t("settings")}
            active={tab === "settings"}
            onClick={() => setTab("settings")}
          />
        </div>
      </header>
      <Segmented
        label={t("remoteTabs")}
        value={tab}
        onChange={(value) => {
          feedback();
          setTab(value);
          if (value === "text" && connected) onRequest();
        }}
        options={[
          { value: "remote", label: t("remote") },
          { value: "text", label: t("textSettings") },
          { value: "settings", label: t("remoteSettings") },
        ]}
      />
      <div className={"remote-status " + (connected ? "online" : "")}>
        <p role="status">{t(status || "pairHelp")}</p>
        {preview.allowed && preview.script ? (
          <span className="remote-script">
            {preview.script.title || t("untitled")}
          </span>
        ) : (
          <span className="remote-script">
            {t(preview.allowed ? "previewLoading" : "previewPrivate")}
          </span>
        )}
      </div>
      {tab === "remote" ? (
        connected ? (
          <div className="remote-layout">
            <div className="remote-stage">
              <button
                className="remote-main-play"
                aria-label={t(state.playing ? "pause" : "play")}
                onClick={() => act(state.playing ? "pause" : "play")}
              >
                <Icon name={state.playing ? "pause" : "play"} />
              </button>
              <button
                className="speed-wing speed-wing-left"
                style={{ clipPath: SPEED_CLIP }}
                aria-label={t("speedDown")}
                onClick={() => act("speedDown")}
              >
                <Icon name="minus" />
              </button>
              <div className="speed-display">
                <output>
                  <span className="sr-only">
                    {t(state.playing ? "play" : "pause")}{" "}
                  </span>
                  {state.speed.toFixed(2)}×
                </output>
                <span>{t("speed")}</span>
              </div>
              <button
                className="speed-wing speed-wing-right"
                style={{ clipPath: SPEED_CLIP }}
                aria-label={t("speedUp")}
                onClick={() => act("speedUp")}
              >
                <Icon name="plus" />
              </button>
            </div>
            <div className="remote-paragraphs">
              <button
                aria-label={t("previousParagraph")}
                onClick={() => act("previousParagraph")}
              >
                <span>
                  <Icon name="previous" />
                </span>
                <small>{t("previousParagraph")}</small>
              </button>
              <button
                aria-label={t("nextParagraph")}
                onClick={() => act("nextParagraph")}
              >
                <span>
                  <Icon name="next" />
                </span>
                <small>{t("nextParagraph")}</small>
              </button>
            </div>
          </div>
        ) : (
          <div className="remote-placeholder">
            <Icon name="remote" />
            <p>{t("pairHelp")}</p>
          </div>
        )
      ) : tab === "text" ? (
        <div
          className="remote-text"
          ref={scroll}
          aria-label={t("textSettings")}
        >
          {!connected ? (
            <p>{t(status || "disconnected")}</p>
          ) : !preview.allowed ? (
            <div className="preview-private">
              <Icon name="text" />
              <h2>{t("previewPrivate")}</h2>
              <p>{t("previewConsentHelp")}</p>
            </div>
          ) : preview.unavailable ? (
            <p>{t("previewTooLarge")}</p>
          ) : preview.unavailable ? (
            <p>{t("previewTooLarge")}</p>
          ) : !preview.script ? (
            <p>{t("previewLoading")}</p>
          ) : (
            textNodes
          )}
        </div>
      ) : (
        <div className="remote-settings">
          <section>
            <h2>{t("connection")}</h2>
            <div className="setting-row">
              <span>{t("remotePeer")}</span>
              <strong>{t(connected ? "studio" : "disconnected")}</strong>
            </div>
            <div className="setting-row">
              <span>{t("textSettings")}</span>
              <strong>
                {t(
                  preview.allowed && connected
                    ? "previewAllowed"
                    : "previewPrivate",
                )}
              </strong>
            </div>
            <p className="muted">{t("previewConsentHelp")}</p>
          </section>
          <section>
            <h2>{t("appearance")}</h2>
            <TeleoSelect
              label={t("remoteAppearance")}
              value={appearance}
              onChange={(value) => {
                setAppearance(value);
                localSet("teleo.remoteAppearance", value);
              }}
              options={[
                { value: "light", label: t("light") },
                { value: "dark", label: t("dark") },
                { value: "system", label: t("system") },
              ]}
            />
          </section>
          <section>
            <h2>{t("feedback")}</h2>
            {feedbackAvailable() ? (
              <label className="check">
                <input
                  type="checkbox"
                  checked={haptics}
                  onChange={(e) => {
                    setHaptics(e.target.checked);
                    setFeedback(e.target.checked);
                  }}
                />
                {t("haptics")}
              </label>
            ) : (
              <p className="muted">{t("hapticsUnavailable")}</p>
            )}
          </section>
          {connected && (
            <>
              <button onClick={() => act("restart")}>
                <Icon name="restart" />
                {t("restart")}
              </button>
              <button className="remote-disconnect" onClick={onDisconnect}>
                {t("revoke")}
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
}
