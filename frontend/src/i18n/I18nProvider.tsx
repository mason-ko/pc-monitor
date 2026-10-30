import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  I18nContext,
  MESSAGES,
  writeStoredLang,
  initialLang,
  type I18nValue,
  type Lang,
} from "./index";

/**
 * Provides the message catalog + language setter to the whole app and keeps
 * the selection persisted (localStorage) and reflected in `<html lang>` and
 * the document title, so the choice survives reloads.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);

  useEffect(() => {
    const t = MESSAGES[lang];
    document.documentElement.lang = lang;
    document.title = t.header.title;
    writeStoredLang(lang);
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({ lang, t: MESSAGES[lang], setLang }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
