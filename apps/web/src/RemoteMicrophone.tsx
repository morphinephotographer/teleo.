import { useEffect, useId, useRef, useState } from "react";
import type {
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
import { Icon } from "./ui";

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
              ...(issue
                ? {
                    error:
                      issue as import("../../../packages/protocol/remote-voice").RemoteVoiceError,
                  }
                : {}),
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
    if (offer) setError(null);
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
    if (status !== "starting" && status !== "listening") return;
    const beat = setInterval(() => {
      if (
        session.current &&
        !send.current({
          type: "voiceStatus",
          version: 1,
          session: session.current,
          status,
        })
      )
        stopRef.current(false);
    }, 2000);
    return () => clearInterval(beat);
  }, [status]);
  const start = () => {
    if (!offer || !connected || document.hidden) return;
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
  const label = t(on ? "voicePhoneStop" : "voicePhoneStart");
  const hint = t(
    error ||
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
        className={on ? "remote-mic active" : "remote-mic"}
        disabled={!connected || !offer || !supported}
        aria-label={label}
        aria-describedby={hintId}
        aria-pressed={on}
        title={hint}
        onClick={() => (on ? stop() : start())}
      >
        <Icon name="microphone" />
      </button>
      <span id={hintId} className="sr-only" role="status">
        {hint}
      </span>
    </div>
  );
}
