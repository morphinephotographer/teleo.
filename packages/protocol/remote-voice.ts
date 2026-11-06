/** Ephemeral transcripts. No audio, script body or voice frames are persisted. */
export const voiceErrors = [
  "voiceUnsupported",
  "voicePermission",
  "voiceMicrophone",
  "voiceNetwork",
  "voiceLanguageError",
  "voiceFailed",
  "voicePaused",
  "voiceNoAudio",
] as const;
export type RemoteVoiceError = (typeof voiceErrors)[number];
export type VoiceOffer = {
  type: "voiceOffer";
  version: 1;
  session: string;
  target: string;
  language: string;
};
export type VoiceFrame =
  | VoiceOffer
  | { type: "voiceStop"; version: 1; session: string }
  | {
      type: "voiceStatus";
      version: 1;
      session: string;
      status: "starting" | "listening" | "error";
      error?: RemoteVoiceError;
    }
  | {
      type: "voiceTranscript";
      version: 1;
      session: string;
      sequence: number;
      restart: boolean;
      text: string;
    };
const uuid = (v: unknown) =>
  typeof v === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export function validVoiceFrame(value: unknown): value is VoiceFrame {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  if (m.version !== 1 || !uuid(m.session)) return false;
  const keys = Object.keys(m).sort().join(",");
  if (m.type === "voiceOffer")
    return (
      keys === "language,session,target,type,version" &&
      uuid(m.target) &&
      typeof m.language === "string" &&
      /^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,2}$/i.test(m.language)
    );
  if (m.type === "voiceStop") return keys === "session,type,version";
  if (m.type === "voiceStatus")
    return (
      (keys === "session,status,type,version" ||
        keys === "error,session,status,type,version") &&
      ["starting", "listening", "error"].includes(String(m.status)) &&
      (m.error === undefined ||
        (m.status === "error" &&
          voiceErrors.includes(m.error as RemoteVoiceError)))
    );
  return (
    m.type === "voiceTranscript" &&
    keys === "restart,sequence,session,text,type,version" &&
    Number.isSafeInteger(m.sequence) &&
    Number(m.sequence) >= 0 &&
    typeof m.restart === "boolean" &&
    typeof m.text === "string" &&
    m.text.length > 0 &&
    m.text.length <= 600 &&
    !!m.text.trim()
  );
}
