import { Icon } from "./ui";
import type { Key } from "./i18n";
/** Inert composition only: never mounts RemoteController or allocates a socket. */
export function RemoteIllustration({ t }: { t: (key: Key) => string }) {
  return (
    <div className="phone-illustration" aria-hidden="true">
      <div className="illustration-header">
        <span className="brand">teleo.</span>
        <Icon name="monitor" />
        <Icon name="gear" />
      </div>
      <div className="illustration-text">
        <p>{t("tagline")}</p>
        <p>{t("description")}</p>
      </div>
      <div className="illustration-track" />
      <div className="illustration-play">
        <span>
          <Icon name="minus" />
        </span>
        <span>
          <Icon name="play" />
        </span>
        <span>
          <Icon name="plus" />
        </span>
      </div>
      <div className="illustration-speed">1.0×</div>
      <div className="illustration-paragraphs">
        <span>
          <Icon name="paragraphPrevious" />
        </span>
        <span>
          <Icon name="paragraphNext" />
        </span>
      </div>
      <div className="illustration-quick">
        <Icon name="settings" />
      </div>
    </div>
  );
}
