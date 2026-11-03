import { SpeechFollower } from "../../../packages/protocol/speech-follow";

/** Minimal Web Speech API surface (not in TypeScript's DOM lib as a constructor). */
type RecognitionResultList = ArrayLike<
  ArrayLike<{ transcript: string }> & { isFinal: boolean }
>;
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: RecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionConstructor = new () => Recognition;

export type VoiceStatus = "off" | "starting" | "listening" | "error";
export type VoiceError =
  | "voiceUnsupported"
  | "voicePermission"
  | "voiceMicrophone"
  | "voiceNetwork"
  | "voiceLanguageError"
  | "voiceFailed"
  | "voicePaused";

function recognitionConstructor(): RecognitionConstructor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

export function voiceFollowSupported() {
  return typeof window !== "undefined" && !!recognitionConstructor();
}

/**
 * iPhone and iPad (iPadOS reports itself as a Mac with a touch screen).
 * Their recognizer ends a session after every phrase or pause, and starting
 * the next one too soon makes it fail at once.
 */
export function isAppleTouch() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

/** Optional on-screen event log for field diagnosis: add ?voicelog=1 to the URL. */
function voiceLog() {
  if (
    typeof location === "undefined" ||
    !/[?&]voicelog=1\b/.test(location.search)
  )
    return (_message: string) => {};
  const box = document.createElement("pre");
  box.className = "voice-log";
  Object.assign(box.style, {
    position: "fixed",
    left: "8px",
    bottom: "8px",
    zIndex: "2000",
    maxWidth: "min(92vw, 520px)",
    maxHeight: "40vh",
    overflow: "auto",
    margin: "0",
    padding: "8px 10px",
    font: "11px/1.4 ui-monospace, Menlo, monospace",
    color: "#f5f5f7",
    background: "#000c",
    borderRadius: "10px",
    userSelect: "text",
    whiteSpace: "pre-wrap",
  });
  const start = performance.now();
  const lines: string[] = [];
  return (message: string) => {
    if (!box.isConnected) document.body.append(box);
    lines.push(
      `${((performance.now() - start) / 1000).toFixed(1)}s ${message}`,
    );
    if (lines.length > 40) lines.shift();
    box.textContent = lines.join("\n");
    box.scrollTop = box.scrollHeight;
  };
}

/**
 * Keeps speech recognition running while voice follow is on and turns its
 * transcripts into a confirmed script position. Browsers end sessions on
 * their own (silence, time limits, on iPhone/iPad after every phrase); each
 * end opens a fresh recognizer that continues from the confirmed position.
 * When the browser will not keep listening without a tap (iPhone/iPad),
 * listening pauses and the next tap on the text or the microphone continues.
 */
export class VoiceFollow {
  private recognition?: Recognition;
  private follower?: SpeechFollower;
  private active = false;
  private suspended = false;
  private restartTimer?: ReturnType<typeof setTimeout>;
  private language = "";
  private emptySessions = 0;
  private sessionStarted = 0;
  private started = false;
  private heardInSession = false;
  /** A session has started at least once (later starts are automatic restarts). */
  private listened = false;
  private networkErrors = 0;
  private captureErrors = 0;
  private readonly apple = isAppleTouch();
  private readonly log = voiceLog();

  constructor(
    private onPosition: (offset: number) => void,
    private onStatus: (status: VoiceStatus, error?: VoiceError) => void,
  ) {}

  get running() {
    return this.active;
  }

  /** Listening stopped because the browser wants a tap; resume() continues. */
  get paused() {
    return this.suspended && !!this.follower;
  }

  get position() {
    return this.follower?.position ?? 0;
  }

  start(text: string, language: string, from: number) {
    this.stop(false);
    if (!recognitionConstructor()) {
      this.onStatus("error", "voiceUnsupported");
      return;
    }
    this.follower = new SpeechFollower(text, from);
    this.language = language;
    this.listened = false;
    this.begin();
  }

  /** Continue after a pause (call it from a tap: browsers allow a start then). */
  resume(offset?: number) {
    if (!this.follower) return;
    if (offset !== undefined) this.follower.jump(offset, performance.now());
    this.begin();
  }

  /** Move the read position (tap or manual scroll) without restarting the microphone. */
  jump(offset: number) {
    if (!this.follower) return;
    this.onPosition(this.follower.jump(offset, performance.now()));
  }

  stop(report = true) {
    this.active = false;
    this.suspended = false;
    clearTimeout(this.restartTimer);
    this.close();
    if (report) {
      this.follower = undefined;
      this.onStatus("off");
    }
  }

  private begin() {
    clearTimeout(this.restartTimer);
    this.close();
    this.active = true;
    this.suspended = false;
    this.emptySessions = 0;
    this.networkErrors = 0;
    this.captureErrors = 0;
    this.onStatus(this.listened ? "listening" : "starting");
    if (this.follower) this.onPosition(this.follower.position);
    this.open();
  }

  private get emptyLimit() {
    return this.apple ? 4 : 6;
  }

  /** Each session gets a new recognizer: Safari does not reliably restart a used one. */
  private open() {
    if (!this.active || !this.follower) return;
    const Constructor = recognitionConstructor();
    if (!Constructor) return this.fail("voiceUnsupported");
    const recognition = new Constructor();
    recognition.lang = this.language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      if (this.recognition !== recognition) return;
      this.log("start");
      this.started = true;
      this.sessionStarted = performance.now();
      if (!this.listened) this.onStatus("listening");
      this.listened = true;
    };
    recognition.onresult = (event) => {
      if (this.recognition !== recognition || !this.follower) return;
      this.heardInSession = true;
      this.emptySessions = 0;
      this.networkErrors = 0;
      this.captureErrors = 0;
      const parts: string[] = [];
      for (let i = 0; i < event.results.length; i++)
        parts.push(event.results[i][0]?.transcript || "");
      const transcript = parts.join(" ").replace(/\s+/g, " ").trim();
      this.log(`result …${transcript.slice(-40)}`);
      const before = this.follower.position;
      const after = this.follower.match(transcript, performance.now());
      if (after !== before) this.onPosition(after);
    };
    recognition.onerror = (event) => {
      if (this.recognition !== recognition) return;
      const error = event.error;
      this.log(`error ${error}`);
      // Normal pauses and our own restarts: the session ends and reopens.
      if (error === "no-speech" || error === "aborted") return;
      // A brief network loss: the session ends and reopens.
      if (error === "network" && ++this.networkErrors <= 3) return;
      // iPhone/iPad report a busy microphone while the last session closes.
      if (
        error === "audio-capture" &&
        this.listened &&
        ++this.captureErrors <= 4
      )
        return;
      if (error === "not-allowed" || error === "service-not-allowed") {
        // Refused before it ever listened: no permission. Refused on an
        // automatic restart: the browser wants a tap, so pause.
        if (this.listened) this.suspend();
        else this.fail("voicePermission");
        return;
      }
      this.fail(
        error === "audio-capture"
          ? "voiceMicrophone"
          : error === "network"
            ? "voiceNetwork"
            : error === "language-not-supported"
              ? "voiceLanguageError"
              : "voiceFailed",
      );
    };
    recognition.onend = () => {
      if (this.recognition !== recognition) return;
      this.log("end");
      this.recognition = undefined;
      if (!this.active) return;
      const short =
        !this.started || performance.now() - this.sessionStarted < 1500;
      if (this.heardInSession) this.emptySessions = 0;
      else if (short) this.emptySessions++;
      // Sessions that keep ending at once: the browser will not listen on its
      // own any more. Pause rather than flicker the microphone on and off.
      if (this.emptySessions > this.emptyLimit) return this.suspend();
      this.restartTimer = setTimeout(
        () => this.open(),
        this.apple
          ? Math.min(2500, 450 + 450 * this.emptySessions)
          : Math.min(1500, 200 * (this.emptySessions + 1)),
      );
    };
    this.recognition = recognition;
    this.started = false;
    this.heardInSession = false;
    this.follower.restart();
    try {
      this.log("open");
      recognition.start();
    } catch (error) {
      // A start that throws (still busy) is retried like an empty session.
      this.log(`start threw ${(error as Error)?.name || error}`);
      this.recognition = undefined;
      if (++this.emptySessions > this.emptyLimit) return this.suspend();
      this.restartTimer = setTimeout(() => this.open(), this.apple ? 900 : 400);
    }
  }

  private close() {
    const recognition = this.recognition;
    this.recognition = undefined;
    if (!recognition) return;
    recognition.onresult = recognition.onerror = null;
    recognition.onend = recognition.onstart = null;
    try {
      recognition.abort();
    } catch {
      /* already stopped */
    }
  }

  private suspend() {
    this.log("paused – tap to continue");
    clearTimeout(this.restartTimer);
    this.close();
    this.active = false;
    this.suspended = true;
    this.onStatus("error", "voicePaused");
  }

  private fail(error: VoiceError) {
    this.log(`stopped: ${error}`);
    this.active = false;
    this.suspended = false;
    clearTimeout(this.restartTimer);
    this.close();
    this.follower = undefined;
    this.onStatus("error", error);
  }
}
