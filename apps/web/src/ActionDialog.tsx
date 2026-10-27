import { useEffect, useRef, useState } from "react";
import { Sheet } from "./ui";
import type { Key } from "./i18n";
export function ActionDialog({
  title,
  label,
  initial,
  confirm,
  danger,
  t,
  onClose,
  onSubmit,
}: {
  title: string;
  label?: string;
  initial?: string;
  confirm: string;
  danger?: boolean;
  t: (key: Key) => string;
  onClose: () => void;
  onSubmit: (value: string) => Promise<Key | void>;
}) {
  const [value, setValue] = useState(initial || ""),
    [error, setError] = useState<Key | null>(null),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <Sheet
      open
      title={title}
      closeLabel={t("close")}
      onClose={() => {
        if (!busy) onClose();
      }}
      className="action-dialog"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          if (label && !value.trim()) {
            setError("nameRequired");
            input.current?.focus();
            return;
          }
          setBusy(true);
          setError(null);
          try {
            const failure = await onSubmit(value.trim());
            if (failure) {
              setError(failure);
              setBusy(false);
              input.current?.focus();
            } else onClose();
          } catch {
            setError("saveError");
            setBusy(false);
          }
        }}
      >
        {label && (
          <label>
            {label}
            <input
              ref={input}
              value={value}
              maxLength={256}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              aria-invalid={!!error}
              aria-describedby={error ? "action-dialog-error" : undefined}
            />
          </label>
        )}
        {error && (
          <p id="action-dialog-error" role="alert">
            {t(error)}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            type="submit"
            className={danger ? "primary danger" : "primary"}
            disabled={busy}
          >
            {busy ? t("saving") : confirm}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
