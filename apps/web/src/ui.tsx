import { useEffect, useId, useRef, type ReactNode } from "react";

export type IconName =
  | "gear"
  | "chevron"
  | "size"
  | "spacing"
  | "width"
  | "paragraphPrevious"
  | "paragraphNext"
  | "monitor"
  | "library"
  | "settings"
  | "remote"
  | "more"
  | "close"
  | "play"
  | "pause"
  | "minus"
  | "plus"
  | "restart"
  | "mirror"
  | "focus"
  | "fullscreen"
  | "previous"
  | "next"
  | "text";
const paths: Record<IconName, ReactNode> = {
  gear: (
    <>
      <path d="m10 3-.7 2.1-2 .9-2-.8-2 3.5 1.5 1.6v2.4l-1.5 1.6 2 3.5 2-.8 2 .9.7 2.1h4l.7-2.1 2-.9 2 .8 2-3.5-1.5-1.6v-2.4L21 8.8l-2-3.5-2 .8-2-.9L14 3Z" />
      <circle cx="12" cy="11.5" r="3" />
    </>
  ),
  chevron: <path d="m7 10 5 5 5-5" />,
  size: (
    <>
      <path d="m4 20 8-16 8 16M7 14h10" />
    </>
  ),
  spacing: (
    <>
      <path d="M4 5h16M4 12h16M4 19h16M8 2v6m-2-2 2 2 2-2M16 16v6m-2-2 2 2 2-2" />
    </>
  ),
  width: (
    <>
      <path d="M3 12h18M7 8l-4 4 4 4m10-8 4 4-4 4" />
    </>
  ),
  paragraphPrevious: (
    <>
      <path d="M5 5v14m13-14L7 12l11 7Z" fill="currentColor" />
    </>
  ),
  paragraphNext: (
    <>
      <path d="M19 5v14M6 5l11 7-11 7Z" fill="currentColor" />
    </>
  ),
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="13" rx="1" />
      <path d="M9 21h6m-3-4v4" />
    </>
  ),
  library: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M9 4v16M5.5 8h1M5.5 12h1" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="3" />
      <circle cx="15" cy="17" r="3" />
    </>
  ),
  remote: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="3" />
      <path d="M10 18h4M10 6h4M12 4v4" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  play: <path d="m8 4 12 8-12 8Z" fill="currentColor" strokeLinejoin="round" />,
  pause: <path d="M9 5v14M15 5v14" strokeWidth="3.5" />,
  minus: <path d="M5 12h14" />,
  plus: <path d="M5 12h14M12 5v14" />,
  restart: (
    <>
      <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" />
    </>
  ),
  mirror: (
    <>
      <path d="M12 3v18M8 6l-5 12h5ZM16 6l5 12h-5Z" />
    </>
  ),
  focus: (
    <>
      <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3M5 12h14" />
    </>
  ),
  fullscreen: <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" />,
  previous: <path d="m6 14 6-6 6 6" />,
  next: <path d="m6 10 6 6 6-6" />,
  text: <path d="m3 19 6-14 6 14M5 14h8M16 9h6M19 9v10" />,
};
export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function IconButton({
  name,
  label,
  onClick,
  active,
  disabled,
  className = "",
}: {
  name: IconName;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={"icon-button " + className}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={name} />
    </button>
  );
}
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div
      className="segmented"
      role="group"
      aria-label={label}
      style={
        {
          "--segments": options.length,
          "--selected": index,
        } as React.CSSProperties
      }
    >
      <span className="segment-selection" aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
/** Native dialog supplies modal focus containment, Escape and restoration. */
export function Sheet({
  open,
  title,
  closeLabel,
  onClose,
  children,
  className = "",
}: {
  open: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const headingId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (!el || !open) {
      if (el?.open) el.close();
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    if (!el.open) el.showModal();
    return () => {
      if (el.open) el.close();
      requestAnimationFrame(() => {
        if (previous?.isConnected && !document.querySelector("dialog[open]"))
          previous.focus();
      });
    };
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className={"settings-sheet " + className}
      aria-labelledby={headingId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="sheet-heading">
        <div>
          <span className="eyebrow">teleo.</span>
          <h2 id={headingId}>{title}</h2>
        </div>
        <IconButton name="close" label={closeLabel} onClick={onClose} />
      </div>
      {children}
    </dialog>
  );
}
