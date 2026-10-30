import { useEffect, useRef } from "react";
import { Sheet } from "./ui";
import type { Key } from "./i18n";
import { macIcons, macIconFile, type MacIconId } from "./mac-icons";

export function MacInstallSheet({
  open,
  selected,
  onSelect,
  onClose,
  t,
}: {
  open: boolean;
  selected: MacIconId;
  onSelect: (id: MacIconId) => void;
  onClose: () => void;
  t: (key: Key) => string;
}) {
  const group = useRef<HTMLDivElement>(null);
  const label = macIcons.find((icon) => icon.id === selected)!.label;
  useEffect(() => {
    const dialog = group.current?.closest("dialog");
    if (!dialog || !open) return;
    const keepFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), a[href]',
      );
      // Include download links even when Safari's default Tab policy skips links.
      const index = Array.from(controls).indexOf(
        document.activeElement as HTMLElement,
      );
      const next =
        (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
      event.preventDefault();
      controls[next]?.focus();
    };
    dialog.addEventListener("keydown", keepFocus);
    return () => dialog.removeEventListener("keydown", keepFocus);
  }, [open]);
  return (
    <Sheet
      open={open}
      title={t("macInstall")}
      closeLabel={t("close")}
      onClose={onClose}
      className="mac-install-sheet"
    >
      <div className="mac-install-content">
        <p className="mac-install-intro">{t("macInstallIntro")}</p>
        <div
          ref={group}
          role="radiogroup"
          aria-label={t("macChooseIcon")}
          className="mac-icon-options"
          onKeyDown={(event) => {
            const index = macIcons.findIndex((icon) => icon.id === selected);
            let next = index;
            if (event.key === "ArrowRight" || event.key === "ArrowDown")
              next = (index + 1) % macIcons.length;
            else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
              next = (index + macIcons.length - 1) % macIcons.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = macIcons.length - 1;
            else return;
            event.preventDefault();
            onSelect(macIcons[next].id);
            group.current
              ?.querySelectorAll<HTMLButtonElement>('button[role="radio"]')
              [next]?.focus();
          }}
        >
          {macIcons.map((icon) => (
            <button
              key={icon.id}
              type="button"
              role="radio"
              aria-checked={selected === icon.id}
              tabIndex={selected === icon.id ? 0 : -1}
              onClick={() => onSelect(icon.id)}
            >
              <img
                src={macIconFile(icon.id, 256)}
                alt=""
                width="256"
                height="256"
              />
              <span>{t(icon.label)}</span>
              <span className="mac-icon-check" aria-hidden="true">
                {selected === icon.id ? "✓" : ""}
              </span>
            </button>
          ))}
        </div>
        <p className="mac-icon-selected" role="status">
          {t("macSelected")}: {t(label)}
        </p>
        <div className="mac-icon-downloads">
          <a
            className="mac-icon-download"
            href={macIconFile(selected, 1024)}
            download={`teleo_${selected}-1024.png`}
          >
            {t("macDownloadPng")}
          </a>
          <a
            href={`/mac-icons/teleo_${selected}.icns`}
            download={`teleo_${selected}.icns`}
          >
            {t("macDownloadIcns")}
          </a>
        </div>
        <ol className="mac-install-steps">
          <li>{t("macInstallStep1")}</li>
          <li>{t("macInstallStep2")}</li>
          <li>{t("macInstallStep3")}</li>
        </ol>
        <p className="mac-install-note">{t("macInstalledNote")}</p>
      </div>
    </Sheet>
  );
}
