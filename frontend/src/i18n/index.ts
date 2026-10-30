import { createContext } from "react";
import { en, type Messages } from "./en";
import { ko } from "./ko";

export type Lang = "en" | "ko";
export type { Messages } from "./en";

/** Key under which the chosen language is persisted in localStorage. */
export const LANG_STORAGE_KEY = "pc-monitor.lang";

export const LANGS: readonly Lang[] = ["en", "ko"];

export const MESSAGES: Record<Lang, Messages> = { en, ko };

/** Fill `{placeholder}` slots in a translated template. */
export function tr(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

function isLang(value: string | null): value is Lang {
  return value !== null && (LANGS as readonly string[]).includes(value);
}

/** The persisted language, or null when nothing usable is stored. */
export function readStoredLang(): Lang | null {
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    return isLang(stored) ? stored : null;
  } catch {
    return null; // private mode / disabled storage
  }
}

export function writeStoredLang(lang: Lang): void {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Persistence is best-effort; the UI keeps working without it.
  }
}

/** Stored choice wins; otherwise Korean for Korean browsers, else English. */
export function initialLang(): Lang {
  const stored = readStoredLang();
  if (stored) return stored;
  const nav = typeof navigator !== "undefined" ? navigator.language ?? "" : "";
  return nav.toLowerCase().startsWith("ko") ? "ko" : "en";
}

export interface I18nValue {
  lang: Lang;
  t: Messages;
  setLang: (lang: Lang) => void;
}

export const I18nContext = createContext<I18nValue>({
  lang: "en",
  t: en,
  setLang: () => {},
});
