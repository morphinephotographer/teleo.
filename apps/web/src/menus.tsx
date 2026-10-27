import { useId, useRef, useState, useEffect, type ReactNode } from "react";
import { Icon, Sheet } from "./ui";

const supportsPopover = () =>
  typeof HTMLElement !== "undefined" &&
  typeof HTMLElement.prototype.showPopover === "function";
/** Top-layer popover avoids clipping in the editor, scrolling settings and dialogs. */
export function Popover({
  label,
  children,
  kind = "menu",
  trigger,
  selected = false,
  className = "",
}: {
  label: string;
  children: ReactNode;
  kind?: "menu" | "listbox";
  trigger?: ReactNode;
  selected?: boolean;
  className?: string;
}) {
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null),
    popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const focusFirst = useRef(false),
    typeahead = useRef({ text: "", at: 0 });
  const position = () => {
    const el = popup.current,
      button = anchor.current;
    if (!el || !button) return;
    const v = visualViewport,
      r = button.getBoundingClientRect();
    const x = v?.offsetLeft || 0,
      y = v?.offsetTop || 0,
      w = Math.min(v?.width || innerWidth, innerWidth - x),
      h = Math.min(v?.height || innerHeight, innerHeight - y);
    const width = Math.min(Math.max(r.width, 220), w - 24);
    const availableBelow = y + h - r.bottom - 16,
      availableAbove = r.top - y - 16;
    const desired = Math.min(el.scrollHeight, 400, h - 32);
    const above = availableBelow < desired && availableAbove > availableBelow;
    const maxHeight = Math.max(
      80,
      Math.min(400, above ? availableAbove : availableBelow, h - 32),
    );
    el.style.width = width + "px";
    el.style.maxHeight = maxHeight + "px";
    const height = Math.min(el.scrollHeight, maxHeight);
    el.style.left =
      Math.max(x + 12, Math.min(r.left, x + w - width - 12)) + "px";
    el.style.top =
      Math.max(
        y + 12,
        Math.min(
          above ? r.top - height - 8 : r.bottom + 8,
          y + h - height - 12,
        ),
      ) + "px";
  };
  const hide = (restore = true) => {
    popup.current?.hidePopover();
    if (restore) anchor.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const update = () => position();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    visualViewport?.addEventListener("resize", update);
    visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      visualViewport?.removeEventListener("resize", update);
      visualViewport?.removeEventListener("scroll", update);
    };
  }, [open]);
  const items = () =>
    Array.from(
      popup.current?.querySelectorAll<HTMLElement>(
        '[role="option"]:not([disabled]),[role="menuitem"]:not([disabled])',
      ) || [],
    );
  return (
    <div className={"teleo-picker " + className}>
      <button
        ref={anchor}
        type="button"
        className={"picker-trigger" + (selected ? " selected" : "")}
        role={kind === "listbox" ? "combobox" : undefined}
        aria-label={label}
        aria-haspopup={kind}
        aria-expanded={open}
        aria-controls={id}
        popoverTarget={id}
        onClick={(e) => {
          e.preventDefault();
          const el = popup.current;
          if (!el) return;
          if (el.matches(":popover-open")) hide();
          else {
            el.showPopover();
            position();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && popup.current?.matches(":popover-open")) {
            e.preventDefault();
            e.stopPropagation();
            hide();
            return;
          }
          if (["ArrowDown", "ArrowUp"].includes(e.key)) {
            e.preventDefault();
            focusFirst.current = true;
            popup.current?.showPopover();
            position();
          }
        }}
      >
        {trigger || (kind === "menu" ? <Icon name="more" /> : label)}
        {kind === "listbox" && (
          <span className="picker-chevron" aria-hidden="true">
            <Icon name="chevron" />
          </span>
        )}
      </button>
      <div
        id={id}
        ref={popup}
        popover="auto"
        className="teleo-popover"
        role={kind}
        aria-label={label}
        onToggle={(e) => {
          const now = (e.nativeEvent as ToggleEvent).newState === "open";
          setOpen(now);
          if (now) {
            position();
            requestAnimationFrame(() => {
              const options = items();
              (
                options.find(
                  (el) => el.getAttribute("aria-selected") === "true",
                ) || options[0]
              )?.focus();
              focusFirst.current = false;
            });
          }
        }}
        onClick={(e) => {
          if (
            (e.target as HTMLElement).closest(
              '[role="option"],[role="menuitem"]',
            )
          )
            hide();
        }}
        onKeyDown={(e) => {
          const options = items(),
            index = options.indexOf(document.activeElement as HTMLElement);
          let next = index;
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            hide();
            return;
          }
          if (e.key === "Tab") {
            hide();
            return;
          }
          if (e.key === "ArrowDown") next = (index + 1) % options.length;
          else if (e.key === "ArrowUp")
            next = (index - 1 + options.length) % options.length;
          else if (e.key === "Home") next = 0;
          else if (e.key === "End") next = options.length - 1;
          else if (e.key.length === 1 && e.key !== " ") {
            const now = Date.now();
            typeahead.current = {
              text:
                (now - typeahead.current.at < 700
                  ? typeahead.current.text
                  : "") + e.key.toLocaleLowerCase(),
              at: now,
            };
            next = options.findIndex((el) =>
              el.textContent
                ?.trim()
                .toLocaleLowerCase()
                .startsWith(typeahead.current.text),
            );
          } else return;
          e.preventDefault();
          e.stopPropagation();
          options[next]?.focus();
        }}
      >
        {children}
      </div>
    </div>
  );
}
export type SelectOption = { value: string; label: string; disabled?: boolean };
export function TeleoSelect({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  if (!supportsPopover())
    return (
      <select
        className={"teleo-select-native " + className}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    );
  return (
    <Popover
      label={label}
      kind="listbox"
      className={className}
      trigger={
        <span>{options.find((o) => o.value === value)?.label || label}</span>
      }
    >
      {options.map((o) => (
        <button
          type="button"
          role="option"
          aria-selected={o.value === value}
          key={o.value}
          data-value={o.value}
          disabled={o.disabled}
          tabIndex={-1}
          onClick={() => onChange(o.value)}
        >
          <span>{o.label}</span>
          {o.value === value && <span aria-hidden="true">✓</span>}
        </button>
      ))}
    </Popover>
  );
}
type MenuItem = { label: string; action: () => void; disabled?: boolean };
function FallbackMenu({
  label,
  items,
  trigger,
  closeLabel,
}: {
  label: string;
  items: MenuItem[];
  trigger?: ReactNode;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="picker-trigger"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {trigger || <Icon name="more" />}
      </button>
      <Sheet
        className="menu-fallback-sheet"
        open={open}
        title={label}
        closeLabel={closeLabel}
        onClose={() => setOpen(false)}
      >
        <div
          className="fallback-menu-items"
          role="menu"
          aria-label={label}
          onKeyDown={(e) => {
            const nodes = Array.from(
              e.currentTarget.querySelectorAll<HTMLButtonElement>(
                "button:not([disabled])",
              ),
            );
            let i = nodes.indexOf(document.activeElement as HTMLButtonElement);
            if (e.key === "ArrowDown") i = (i + 1) % nodes.length;
            else if (e.key === "ArrowUp")
              i = (i - 1 + nodes.length) % nodes.length;
            else if (e.key === "Home") i = 0;
            else if (e.key === "End") i = nodes.length - 1;
            else return;
            e.preventDefault();
            e.stopPropagation();
            nodes[i]?.focus();
          }}
        >
          {items.map((item, i) => (
            <button
              type="button"
              role="menuitem"
              key={i}
              disabled={item.disabled}
              onClick={() => {
                item.action();
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
export function TeleoMenu({
  label,
  items,
  className = "",
  trigger,
  closeLabel,
}: {
  label: string;
  items: MenuItem[];
  className?: string;
  trigger?: ReactNode;
  closeLabel: string;
}) {
  if (!supportsPopover())
    return (
      <div className={"teleo-picker " + className}>
        <FallbackMenu
          label={label}
          items={items}
          trigger={trigger}
          closeLabel={closeLabel}
        />
      </div>
    );
  return (
    <Popover label={label} className={className} trigger={trigger}>
      {items.map((item, i) => (
        <button
          type="button"
          role="menuitem"
          key={i}
          tabIndex={-1}
          disabled={item.disabled}
          onClick={item.action}
        >
          {item.label}
        </button>
      ))}
    </Popover>
  );
}
