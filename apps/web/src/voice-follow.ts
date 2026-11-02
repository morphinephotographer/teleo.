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
  | "voiceFailed";

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
 * Keeps one browser speech-recognition session alive while voice follow is on
 * and turns its transcripts into a confirmed script position. Browsers end
 * continuous sessions on their own (silence, time limits); each end starts a
 * fresh session that continues from the confirmed position.
 */
export class VoiceFollow {
  private recognition?: Recognition;
  private follower?: SpeechFollower;
  private active = false;
  private restartTimer?: ReturnType<typeof setTimeout>;
  private quickEnds = 0;
  private sessionStarted = 0;
  private heardInSession = false;

  constructor(
    private onPosition: (offset: number) => void,
    private onStatus: (status: VoiceStatus, error?: VoiceError) => void,
  ) {}

  get running() {
    return this.active;
  }

  get position() {
    return this.follower?.position ?? 0;
  }

  start(text: string, language: string, from: number) {
    this.stop(false);
    const Constructor = recognitionConstructor();
    if (!Constructor) {
      this.onStatus("error", "voiceUnsupported");
      return;
    }
    this.follower = new SpeechFollower(text, from);
    this.active = true;
    this.quickEnds = 0;
    this.onStatus("starting");
    this.onPosition(this.follower.position);
    const recognition = new Constructor();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      if (this.recognition !== recognition) return;
      this.sessionStarted = performance.now();
      this.heardInSession = false;
      this.onStatus("listening");
    };
    recognition.onresult = (event) => {
      if (this.recognition !== recognition || !this.follower) return;
      this.heardInSession = true;
      this.quickEnds = 0;
      const parts: string[] = [];
      for (let i = 0; i < event.results.length; i++)
        parts.push(event.results[i][0]?.transcript || "");
      const before = this.follower.position;
      const after = this.follower.match(
        parts.join(" ").replace(/\s+/g, " ").trim(),
        performance.now(),
      );
      if (after !== before) this.onPosition(after);
    };
    recognition.onerror = (event) => {
      if (this.recognition !== recognition) return;
      const error: VoiceError | undefined =
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "voicePermission"
          : event.error === "audio-capture"
            ? "voiceMicrophone"
            : event.error === "network"
              ? "voiceNetwork"
              : event.error === "language-not-supported"
                ? "voiceLanguageError"
                : undefined; // no-speech / aborted: the session just restarts
      if (error) this.fail(error);
    };
    recognition.onend = () => {
      if (this.recognition !== recognition || !this.active) return;
      const short = performance.now() - this.sessionStarted < 1500;
      this.quickEnds = short && !this.heardInSession ? this.quickEnds + 1 : 0;
      if (this.quickEnds > 5) return this.fail("voiceFailed");
      this.onStatus("starting");
      this.restartTimer = setTimeout(
        () => this.begin(recognition),
        Math.min(1500, 200 * (this.quickEnds + 1)),
      );
    };
    this.recognition = recognition;
    this.begin(recognition);
  }

  /** Move the read position (tap or manual scroll) without restarting the microphone. */
  jump(offset: number) {
    if (!this.follower) return;
    this.onPosition(this.follower.jump(offset, performance.now()));
  }

  stop(report = true) {
    this.active = false;
    clearTimeout(this.restartTimer);
    const recognition = this.recognition;
    this.recognition = undefined;
    if (recognition) {
      recognition.onresult = recognition.onerror = null;
      recognition.onend = recognition.onstart = null;
      try {
        recognition.abort();
      } catch {
        /* already stopped */
      }
    }
    if (report) this.onStatus("off");
  }

  private begin(recognition: Recognition) {
    if (this.recognition !== recognition || !this.active) return;
    this.follower?.restart();
    try {
      recognition.start();
    } catch {
      this.fail("voiceFailed");
    }
  }

  private fail(error: VoiceError) {
    this.stop(false);
    this.onStatus("error", error);
  }
}
