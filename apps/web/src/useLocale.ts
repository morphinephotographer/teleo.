import { useEffect, useRef, useState } from "react";
import { detectLocale, localGet, localSet, type Locale } from "./i18n";
const key = "teleo.locale";
/** Only an actual language choice is persisted; URL hints never override device preference. */
export function useLocale() {
  const manual = useRef(localGet(key));
  const [locale, setLocale] = useState<Locale>(() =>
    detectLocale(
      [...(navigator.languages || []), navigator.language].filter(Boolean),
      manual.current,
    ),
  );
  useEffect(() => {
    const update = () => {
      const saved = localGet(key);
      if (saved === "en" || saved === "uk" || saved === "ru")
        manual.current = saved;
      setLocale(
        detectLocale(
          [...(navigator.languages || []), navigator.language].filter(Boolean),
          manual.current,
        ),
      );
    };
    const storage = (event: StorageEvent) => {
      if (event.key === key) {
        manual.current = event.newValue;
        update();
      }
    };
    window.addEventListener("languagechange", update);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("languagechange", update);
      window.removeEventListener("storage", storage);
    };
  }, []);
  return [
    locale,
    (next: Locale) => {
      manual.current = next;
      localSet(key, next);
      setLocale(next);
      const url = new URL(location.href);
      url.searchParams.set("lang", next);
      history.replaceState({}, "", url);
    },
  ] as const;
}
