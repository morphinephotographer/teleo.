import type { Preferences } from "../../../packages/protocol/domain";
import type { Key } from "./i18n";
import { Icon } from "./ui";

export type Alignment = Preferences["alignment"];
const choices = ["left", "center", "right"] as const;
const labels = {
  left: "alignLeft",
  center: "alignCenter",
  right: "alignRight",
} as const;
/** One controlled component: the caller supplies the actual host-authoritative value. */
export function AlignmentControl({
  value,
  onChange,
  t,
  disabled = false,
}: {
  value: Alignment | undefined;
  onChange: (value: Alignment) => void;
  t: (key: Key) => string;
  disabled?: boolean;
}) {
  return (
    <div
      className="segmented alignment-control"
      role="group"
      aria-label={t("alignment")}
      style={
        {
          "--segments": 3,
          "--selected": value ? choices.indexOf(value) : 0,
        } as React.CSSProperties
      }
    >
      {value && <span className="segment-selection" aria-hidden="true" />}
      {choices.map((choice) => (
        <button
          key={choice}
          type="button"
          aria-label={t(labels[choice])}
          title={t(labels[choice])}
          aria-pressed={value === choice}
          disabled={disabled}
          onClick={() => onChange(choice)}
        >
          <Icon name={labels[choice]} />
        </button>
      ))}
    </div>
  );
}
