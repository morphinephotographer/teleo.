import { useEffect, useLayoutEffect, useState } from "react";
import { localGet, localSet } from "./i18n";

export const macIcons = [
  { id: "black_glossy", label: "macBlackGlossy" },
  { id: "black_matte", label: "macBlackMatte" },
  { id: "white_glossy", label: "macWhiteGlossy" },
  { id: "white_matte", label: "macWhiteMatte" },
] as const;
export type MacIconId = (typeof macIcons)[number]["id"];
const key = "teleo.macIcon";
export const validMacIcon = (value: string | null): MacIconId =>
  macIcons.find((icon) => icon.id === value)?.id || "black_matte";
export const macIconFile = (id: MacIconId, size: number) =>
  `/mac-icons/teleo_${id}-${size}.png`;
export const macManifest = (id: MacIconId) => `/mac-icons/${id}.webmanifest`;

function applyIcon(id: MacIconId) {
  document
    .querySelector('link[id="teleo-app-manifest"]')
    ?.setAttribute("href", macManifest(id));
  document
    .querySelector('link[id="teleo-touch-icon"]')
    ?.setAttribute("href", macIconFile(id, 1024));
}
export function useMacIcon() {
  const [selected, setSelected] = useState<MacIconId>(() =>
    validMacIcon(localGet(key)),
  );
  useLayoutEffect(() => applyIcon(selected), [selected]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === key || event.key === null)
        setSelected(validMacIcon(localGet(key)));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return [
    selected,
    (id: MacIconId) => {
      localSet(key, id);
      setSelected(id);
    },
  ] as const;
}
