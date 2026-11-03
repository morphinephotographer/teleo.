import { SpeechFollower } from "../../../packages/protocol/speech-follow";

/** Minimal Web Speech API surface (not in TypeScript's DOM lib as a constructor). */
type RecognitionResult = ArrayLike<{ transcript: string }> & {
  isFinal: boolean;
};
type RecognitionResultList = ArrayLike<RecognitionResult>;
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult:
    | ((event: {
        results: RecognitionResultList;
        resultIndex?: number;
      }) => void)
    | null;
  onerror: ((event: { error: string; message?: string }) => void) | null;
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
  | "voicePaused"
  | "voiceNoAudio";

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

/**
 * Field-test switches, read from the address (and kept for the browser tab):
 * `voicelog=1` on-screen event log; `voicemode=phrase|continuous`;
 * `voicedelay=<ms>` pause before reopening; `voicereuse=0|1`;
 * `voicelang=<tag>|device` recognition language override.
 */
export type VoiceOptions = {
  log: boolean;
  mode?: "phrase" | "continuous";
  delay?: number;
  reuse?: boolean;
  lang?: string;
};
export function voiceOptions(search = ""): VoiceOptions {
  const read = (key: string) => {
    const fromUrl = new URLSearchParams(search).get(key);
    try {
      if (fromUrl !== null) sessionStorage.setItem("teleo." + key, fromUrl);
      return fromUrl ?? sessionStorage.getItem("teleo." + key);
    } catch {
      return fromUrl;
    }
  };
  const mode = read("voicemode");
  const delay = Number(read("voicedelay"));
  const reuse = read("voicereuse");
  const lang = read("voicelang");
  return {
    log: read("voicelog") === "1",
    mode: mode === "phrase" || mode === "continuous" ? mode : undefined,
    delay:
      Number.isFinite(delay) && delay > 0 ? Math.min(5000, delay) : undefined,
    reuse: reuse === "0" ? false : reuse === "1" ? true : undefined,
    lang: lang || undefined,
  };
}

/** On-screen event log for field diagnosis (see voiceOptions). */
function voiceLog(enabled: boolean) {
  if (!enabled || typeof document === "undefined")
    return (_message: string) => {};
  const box = document.createElement("pre");
  box.className = "voice-log";
  Object.assign(box.style, {
    position: "fixed",
    left: "8px",
    bottom: "8px",
    zIndex: "2000",
    maxWidth: "min(92vw, 560px)",
    maxHeight: "45vh",
    overflow: "auto",
    margin: "0",
    padding: "8px 10px",
    font: "11px/1.4 ui-monospace, Menlo, monospace",
    color: "#f5f5f7",
    background: "#000d",
    borderRadius: "10px",
    userSelect: "text",
    whiteSpace: "pre-wrap",
  });
  const start = performance.now();
  const lines: string[] = [];
  return (message: string) => {
    if (!box.isConnected) document.body.append(box);
    const line = `${((performance.now() - start) / 1000).toFixed(1)}s ${message}`;
    lines.push(line);
    // Also in the console, for Safari's Web Inspector on a connected iPad.
    console.info("[teleo voice]", line);
    if (lines.length > 60) lines.shift();
    box.textContent = lines.join("\n");
    box.scrollTop = box.scrollHeight;
  };
}

/**
 * One transcript from a result list. Safari repeats earlier phrases in later
 * results ("hello", "hello world") and can send the same final phrase twice;
 * joining them naively would make the reader appear to repeat itself.
 */
export function joinResults(results: RecognitionResultList) {
  const kept: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const phrase = (results[i]?.[0]?.transcript || "").trim();
    if (!phrase) continue;
    const last = kept[kept.length - 1];
    const a = phrase.toLocaleLowerCase(),
      b = last?.toLocaleLowerCase();
    if (b !== undefined && a.startsWith(b)) kept[kept.length - 1] = phrase;
    else if (b !== undefined && b.startsWith(a)) continue;
    else kept.push(phrase);
  }
  return kept.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Keeps speech recognition running while voice follow is on and turns its
 * transcripts into a confirmed script position. Browsers end sessions on
 * their own (silence, time limits, on iPhone/iPad after every phrase); each
 * end opens the next session, which continues from the confirmed position.
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
  /** Sessions in a row that ended without ever starting. */
  private failedStarts = 0;
  /** Sessions in a row that started but closed at once without hearing anything. */
  private quickEmpty = 0;
  /** The last recognizer, reused (iPhone/iPad) so Safari does not ask again. */
  private spare?: Recognition;
  private sessionStarted = 0;
  private sessionOpened = 0;
  private sessions = 0;
  private started = false;
  private heardInSession = false;
  private lastTranscript = "";
  /** A session has started at least once (later starts are automatic restarts). */
  private listened = false;
  private networkErrors = 0;
  private captureErrors = 0;
  private readonly apple = isAppleTouch();
  private readonly options: VoiceOptions;
  private readonly log: (message: string) => void;

  constructor(
    private onPosition: (offset: number) => void,
    private onStatus: (status: VoiceStatus, error?: VoiceError) => void,
    options?: VoiceOptions,
  ) {
    this.options =
      options ??
      voiceOptions(typeof location === "undefined" ? "" : location.search);
    this.log = voiceLog(this.options.log);
  }

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

  /** One phrase per session on iPhone/iPad: WebKit's continuous mode stops delivering results. */
  private get continuous() {
    return this.options.mode ? this.options.mode === "continuous" : !this.apple;
  }
  private get reuse() {
    return this.options.reuse ?? this.apple;
  }
  private get failLimit() {
    return this.apple ? 4 : 6;
  }

  start(text: string, language: string, from: number) {
    this.stop(false);
    if (!recognitionConstructor()) {
      this.onStatus("error", "voiceUnsupported");
      return;
    }
    this.follower = new SpeechFollower(text, from);
    const lang = this.options.lang;
    this.language = lang === "device" ? "" : lang || language;
    this.listened = false;
    this.sessions = 0;
    this.log(
      `voice on · ${this.apple ? "iPhone/iPad" : "other"} · lang ${this.language || "device"} · ${this.continuous ? "continuous" : "phrase"} · reuse ${this.reuse ? "yes" : "no"}`,
    );
    this.begin();
  }

  /** Continue after a pause (call it from a tap: browsers allow a start then). */
  resume(offset?: number) {
    if (!this.follower) return;
    if (offset !== undefined) this.follower.jump(offset, performance.now());
    this.log("resume (tap)");
    this.begin();
  }

  /** Move the read position (tap or manual scroll) without restarting the microphone. */
  jump(offset: number) {
    if (!this.follower) return;
    this.onPosition(this.follower.jump(offset, performance.now()));
  }

  stop(report = true) {
    if (this.active || this.suspended) this.log("voice off");
    this.active = false;
    this.suspended = false;
    clearTimeout(this.restartTimer);
    this.close();
    this.spare = undefined;
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
    this.failedStarts = 0;
    this.quickEmpty = 0;
    this.networkErrors = 0;
    this.captureErrors = 0;
    this.onStatus(this.listened ? "listening" : "starting");
    if (this.follower) this.onPosition(this.follower.position);
    this.open();
  }

  /** Opens one recognition session. */
  private open(fresh = false): void {
    if (!this.active || !this.follower) return;
    const Constructor = recognitionConstructor();
    if (!Constructor) return this.fail("voiceUnsupported");
    const reused = this.reuse && !fresh ? this.spare : undefined;
    const recognition = reused || new Constructor();
    this.spare = undefined;
    if (this.language) recognition.lang = this.language;
    recognition.continuous = this.continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    const session = ++this.sessions;
    recognition.onstart = () => {
      if (this.recognition !== recognition) return;
      this.started = true;
      this.sessionStarted = performance.now();
      this.log(
        `#${session} start (+${Math.round(this.sessionStarted - this.sessionOpened)} ms)`,
      );
      if (!this.listened) this.onStatus("listening");
      this.listened = true;
    };
    recognition.onresult = (event) => {
      if (this.recognition !== recognition || !this.follower) return;
      const transcript = joinResults(event.results);
      if (!transcript) return;
      this.heardInSession = true;
      this.failedStarts = 0;
      this.quickEmpty = 0;
      this.networkErrors = 0;
      this.captureErrors = 0;
      // Safari can drop what it heard earlier in a session; a transcript that
      // no longer continues the last one starts a new stretch of speech.
      const last = this.lastTranscript;
      if (
        last &&
        transcript.length < last.length * 0.6 &&
        !last
          .toLocaleLowerCase()
          .startsWith(transcript.toLocaleLowerCase().slice(0, 12))
      ) {
        this.log(`#${session} transcript restarted`);
        this.follower.restart();
      }
      this.lastTranscript = transcript;
      const finals = Array.from(
        { length: event.results.length },
        (_, i) => event.results[i]?.isFinal,
      ).filter(Boolean).length;
      this.log(
        `#${session} heard${finals ? " (final)" : ""} …${transcript.slice(-42)}`,
      );
      const before = this.follower.position;
      const after = this.follower.match(transcript, performance.now());
      if (after !== before) this.onPosition(after);
    };
    recognition.onerror = (event) => {
      if (this.recognition !== recognition) return;
      const error = event.error;
      this.log(
        `#${session} error ${error}${event.message ? ` (${event.message})` : ""}`,
      );
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
        // Refused before it ever listened: no permission (or Dictation off).
        // Refused on an automatic restart: the browser wants a tap, so pause.
        if (this.listened) this.suspend();
        // "service-not-allowed": the speech service itself is off
        // (on iPhone/iPad, Dictation); "not-allowed": the microphone.
        else
          this.fail(
            error === "service-not-allowed" && this.apple
              ? "voiceNoAudio"
              : "voicePermission",
          );
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
      const lasted = this.started
        ? Math.round(performance.now() - this.sessionStarted)
        : 0;
      this.log(
        `#${session} end ${this.heardInSession ? "after speech" : this.started ? "in silence" : "before starting"}${this.started ? ` (${lasted} ms)` : ""}`,
      );
      this.recognition = undefined;
      if (this.reuse) this.spare = recognition;
      if (!this.active) return;
      if (this.heardInSession) {
        this.failedStarts = 0;
        this.quickEmpty = 0;
      } else if (!this.started) {
        this.failedStarts++;
      } else if (lasted < 800) {
        // Opened and closed at once without hearing anything: not a quiet
        // presenter but a recognizer that cannot listen (Dictation off, the
        // language not available, the microphone taken by another app).
        this.quickEmpty++;
      } else {
        this.quickEmpty = 0; // a real pause in speech
      }
      if (this.failedStarts > this.failLimit) return this.suspend();
      if (this.quickEmpty >= 6) return this.fail("voiceNoAudio");
      const base = this.options.delay ?? (this.apple ? 300 : 150);
      const backoff = Math.max(this.failedStarts, this.quickEmpty - 2, 0);
      const wait = backoff
        ? Math.min(2500, base + (this.apple ? 500 : 300) * backoff)
        : this.started && lasted < 1000 && !this.apple
          ? 400
          : base;
      this.restartTimer = setTimeout(
        () => this.open(this.failedStarts > 1),
        wait,
      );
    };
    this.recognition = recognition;
    this.started = false;
    this.heardInSession = false;
    this.lastTranscript = "";
    this.follower.restart();
    this.sessionOpened = performance.now();
    try {
      this.log(`#${session} open${reused ? " (same recognizer)" : ""}`);
      recognition.start();
    } catch (error) {
      this.log(`#${session} start threw ${(error as Error)?.name || error}`);
      this.recognition = undefined;
      // A reused recognizer that will not start: try a fresh one right away.
      if (reused) return this.open(true);
      if (++this.failedStarts > this.failLimit) return this.suspend();
      this.restartTimer = setTimeout(
        () => this.open(true),
        this.apple ? 900 : 400,
      );
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
    this.log("paused – tap the text or the microphone to continue");
    clearTimeout(this.restartTimer);
    this.close();
    this.spare = undefined;
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
    this.spare = undefined;
    this.follower = undefined;
    this.onStatus("error", error);
  }
}
