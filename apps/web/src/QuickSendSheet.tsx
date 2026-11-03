import { useRef, useState } from "react";
import {
  QUICK_SEND_LIMIT,
  type QuickSend,
  type QuickSendAck,
} from "../../../packages/protocol/quick-send";
import type { Key } from "./i18n";
import { Icon, Sheet } from "./ui";
import { readQuickSendFile } from "./quick-send";
import { IMPORT_ACCEPT, ImportFileError } from "./import-file";
export function QuickSendSheet({
  open,
  connected,
  t,
  onClose,
  onSend,
}: {
  open: boolean;
  connected: boolean;
  t: (key: Key) => string;
  onClose: () => void;
  onSend: (message: QuickSend) => Promise<QuickSendAck>;
}) {
  const [body, setBody] = useState("");
  const [destination, setDestination] =
    useState<QuickSend["destination"]>("session");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<QuickSendAck | null>(null);
  const [error, setError] = useState<Key | null>(null);
  const attempt = useRef<QuickSend | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const valid =
    !!body.trim() &&
    body.length <= QUICK_SEND_LIMIT &&
    !body.includes("\u0000");
  const close = () => {
    if (!busy) onClose();
  };
  async function submit() {
    if (!connected || !valid || busy) return;
    const previous = attempt.current;
    const message: QuickSend =
      previous?.body === body && previous.destination === destination
        ? previous
        : { type: "quickSend", id: crypto.randomUUID(), body, destination };
    attempt.current = message;
    setBusy(true);
    setError(null);
    try {
      const ack = await onSend(message);
      if (ack.result !== (destination === "session" ? "delivered" : "saved"))
        throw Error();
      setReceipt(ack);
      setBody("");
      attempt.current = null;
    } catch (e) {
      setError(
        e instanceof Error && e.message === "quickSendUncertain"
          ? "quickSendUncertain"
          : "quickSendFailed",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      open={open}
      title={t(receipt ? "quickSendSuccess" : "quickSendTitle")}
      closeLabel={t("close")}
      onClose={close}
      className={"quick-send-sheet" + (receipt ? " quick-send-success" : "")}
    >
      {receipt ? (
        <div className="quick-send-content">
          <div className="quick-send-check" aria-hidden="true">
            ✓
          </div>
          <h3>{t("quickSendSuccess")}</h3>
          <p role="status">
            {t(
              receipt.result === "saved"
                ? "quickSendSaved"
                : "quickSendDelivered",
            )}
          </p>
          <button
            className="primary"
            onClick={() => {
              setReceipt(null);
              onClose();
            }}
          >
            {t("quickSendContinue")}
          </button>
        </div>
      ) : (
        <div className="quick-send-content">
          <textarea
            aria-label={t("quickSendTitle")}
            placeholder={t("quickSendPlaceholder")}
            value={body}
            disabled={busy}
            onChange={(e) => {
              setBody(e.target.value);
              setError(null);
            }}
          />
          <output className="quick-send-count" aria-live="polite">
            {body.length} / {QUICK_SEND_LIMIT} {t("quickSendCharacters")}
          </output>
          <div className="quick-send-tools">
            <button
              disabled={busy}
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (text.length > QUICK_SEND_LIMIT || text.includes("\u0000"))
                    throw Error();
                  setBody(text);
                  setError(null);
                } catch {
                  setError("quickSendClipboard");
                }
              }}
            >
              <Icon name="copy" />
              {t("quickSendPaste")}
            </button>
            <button disabled={busy} onClick={() => file.current?.click()}>
              <Icon name="documentPlus" />
              {t("quickSendImport")}
            </button>
            <input
              ref={file}
              type="file"
              accept={IMPORT_ACCEPT}
              hidden
              disabled={busy}
              onChange={async (e) => {
                const selected = e.target.files?.[0];
                e.target.value = "";
                if (!selected) return;
                try {
                  setBody(await readQuickSendFile(selected));
                  setError(null);
                } catch (error) {
                  setError(
                    error instanceof ImportFileError
                      ? error.key
                      : "invalidImport",
                  );
                }
              }}
            />
          </div>
          <fieldset disabled={busy}>
            <legend>{t("quickSendDestination")}</legend>
            {(["session", "library"] as const).map((choice) => (
              <label key={choice}>
                <input
                  type="radio"
                  name="quick-send-destination"
                  checked={destination === choice}
                  onChange={() => setDestination(choice)}
                />
                <span>
                  {t(
                    choice === "session"
                      ? "quickSendSession"
                      : "quickSendLibrary",
                  )}
                  <small>
                    {t(
                      choice === "session"
                        ? "quickSendSessionHelp"
                        : "quickSendLibraryHelp",
                    )}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
          {!connected && <p role="status">{t("quickSendPairRequired")}</p>}
          {error && <p role="alert">{t(error)}</p>}
          <button
            className="primary"
            disabled={!connected || !valid || busy}
            onClick={() => void submit()}
          >
            {t(busy ? "quickSendSending" : "quickSendSubmit")}
          </button>
        </div>
      )}
    </Sheet>
  );
}
