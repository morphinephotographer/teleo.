import { useEffect, useId, useRef, useState } from "react";
import type {
  RemoteVoiceError,
  VoiceFrame,
  VoiceOffer,
} from "../../../packages/protocol/remote-voice";
import {
  VoiceFollow,
  voiceFollowSupported,
  type VoiceStatus,
  type VoiceError,
} from "./voice-follow";
import type { Key } from "./i18n";
import { Icon, Sheet } from "./ui";

/** Capture starts only in the phone's button handler, never on a host message. */
export function RemoteMicrophone({
  offer,
  connected,
  onFrame,
  t,
}: {
  offer: VoiceOffer | null;
  connected: boolean;
  onFrame: (frame: VoiceFrame) => boolean;
  t: (key: Key) => string;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("off");
  const [error, setError] = useState<VoiceError | null>(null);
  const send = useRef(onFrame);
  send.current = onFrame;
  const session = useRef<string | null>(null);
  const sequence = useRef(0);
  const pending = useRef<{ text: string; restart: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [capture] = useState(
    () =>
      new VoiceFollow(
        () => {},
        (next, issue) => {
          setStatus(next);
          if (next !== "off") setError(issue ?? null);
          const id = session.current;
          if (id && next !== "off")
            send.current({
              type: "voiceStatus",
              version: 1,
              session: id,
              status: next,
              ...(issue ? { error: issue as RemoteVoiceError } : {}),
            });
          if (next === "error") {
            clearTimeout(timer.current);
            timer.current = undefined;
            pending.current = null;
          }
        },
        { log: false },
      ),
  );
  const stop = (notify = true) => {
    const id = session.current;
    session.current = null;
    clearTimeout(timer.current);
    timer.current = undefined;
    pending.current = null;
    capture.stop();
    if (id && notify)
      send.current({ type: "voiceStop", version: 1, session: id });
  };
  const stopRef = useRef(stop);
  stopRef.current = stop;
  useEffect(() => {
    if (offer || !connected) {
      setError(null);
      setHelpOpen(false);
    }
    return () => stopRef.current(false);
  }, [offer?.session, connected]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) stopRef.current();
    };
    document.addEventListener("visibilitychange", hidden);
    const pageHide = () => stopRef.current();
    window.addEventListener("pagehide", pageHide);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", pageHide);
      stopRef.current();
    };
  }, []);
  useEffect(() => {
    const paused = status === "error" && error === "voicePaused";
    if (status !== "starting" && status !== "listening" && !paused) return;
    const beat = setInterval(() => {
      if (
        session.current &&
        !send.current({
          type: "voiceStatus",
          version: 1,
          session: session.current,
          status,
          ...(paused ? { error: "voicePaused" as const } : {}),
        })
      )
        stopRef.current(false);
    }, 2000);
    return () => clearInterval(beat);
  }, [status, error]);
  const start = () => {
    if (!offer || !connected || document.hidden) return;
    if (capture.paused && session.current === offer.session) {
      capture.resume();
      return;
    }
    stop(false);
    session.current = offer.session;
    sequence.current = 0;
    capture.start("", offer.language, 0, (text, restart) => {
      pending.current = {
        text: text.slice(-600),
        restart: restart || text.length > 600 || !!pending.current?.restart,
      };
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = undefined;
        const value = pending.current;
        pending.current = null;
        if (!value || !session.current) return;
        if (
          !send.current({
            type: "voiceTranscript",
            version: 1,
            session: session.current,
            sequence: sequence.current++,
            ...value,
          })
        )
          stopRef.current(false);
      }, 250);
    });
  };
  const hintId = useId();
  const on = status === "starting" || status === "listening";
  const supported = voiceFollowSupported();
  const label = t(
    !offer ? "voicePhoneSetup" : on ? "voicePhoneStop" : "voicePhoneStart",
  );
  const caption = t(
    !offer
      ? "voicePhoneSetup"
      : error === "voicePaused"
        ? "voicePhoneResume"
        : status === "listening"
          ? "voiceListening"
          : "voicePhoneTap",
  );
  const hint = t(
    (error === "voicePaused" ? "voicePhonePaused" : error) ||
      (!supported
        ? "voiceUnsupported"
        : !offer
          ? "voicePhoneHelp"
          : status === "listening"
            ? "voiceListening"
            : status === "starting"
              ? "voiceStarting"
              : "voicePhoneReady"),
  );
  return (
    <div className="remote-microphone">
      <button
        type="button"
        className={"remote-mic" + (on ? " active" : offer ? " ready" : "")}
        disabled={!connected || !supported}
        aria-label={label}
        aria-describedby={hintId}
        aria-pressed={offer ? on : undefined}
        aria-haspopup={offer ? undefined : "dialog"}
        title={hint}
        onClick={() => {
          if (!offer) setHelpOpen(true);
          else if (on) stop();
          else start();
        }}
      >
        <Icon name="microphone" />
        <span aria-hidden="true">
          {caption}
          {status === "starting" ? "…" : ""}
        </span>
      </button>
      <span
        id={hintId}
        className={error ? "remote-mic-hint" : "sr-only"}
        role="status"
      >
        {hint}
      </span>
      <Sheet
        open={helpOpen && connected && !offer}
        className="remote-advanced remote-settings-page remote-mic-setup"
        title={t("voicePhone")}
        closeLabel={t("close")}
        backLabel={t("back")}
        onClose={() => setHelpOpen(false)}
      >
        <p>{t("voicePhoneHelp")}</p>
      </Sheet>
    </div>
  );
}
