import { useEffect, useId, useRef, useState } from "react";
import { Popover } from "./menus";
import { Sheet } from "./ui";
import type { Locale } from "./i18n";
const options = [
  { value: "en", label: "English" },
  { value: "uk", label: "Українська" },
  { value: "ru", label: "Русский" },
] as const;
const abbreviations = { en: "EN", uk: "UA", ru: "RU" };
export function LanguageControl({
  value,
  onChange,
  label,
  closeLabel,
}: {
  value: Locale;
  onChange: (locale: Locale) => void;
  label: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      document
        .getElementById(id)
        ?.querySelector<HTMLButtonElement>(
          '[role="option"][aria-selected="true"]',
        )
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, id]);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => anchor.current?.focus());
  };
  const items = options.map((option) => (
    <button
      type="button"
      role="option"
      aria-selected={option.value === value}
      data-value={option.value}
      key={option.value}
      tabIndex={-1}
      onClick={() => {
        onChange(option.value);
        close();
      }}
    >
      <span>{option.label}</span>
      {value === option.value && <span aria-hidden="true">✓</span>}
    </button>
  ));
  if (typeof HTMLElement.prototype.showPopover === "function")
    return (
      <Popover
        label={label}
        kind="listbox"
        className="language-control"
        showChevron={false}
        trigger={<span lang="en">{abbreviations[value]}</span>}
      >
        {items}
      </Popover>
    );
  return (
    <div className="teleo-picker language-control">
      <button
        ref={anchor}
        className="picker-trigger"
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {abbreviations[value]}
      </button>
      <Sheet
        id={id}
        className="language-fallback"
        open={open}
        title={label}
        closeLabel={closeLabel}
        onClose={close}
      >
        <div
          role="listbox"
          aria-label={label}
          className="language-options"
          onKeyDown={(event) => {
            const nodes = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
            );
            let index = nodes.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            if (event.key === "ArrowDown") index = (index + 1) % nodes.length;
            else if (event.key === "ArrowUp")
              index = (index - 1 + nodes.length) % nodes.length;
            else if (event.key === "Home") index = 0;
            else if (event.key === "End") index = nodes.length - 1;
            else return;
            event.preventDefault();
            nodes[index]?.focus();
          }}
        >
          {items}
        </div>
      </Sheet>
    </div>
  );
}
