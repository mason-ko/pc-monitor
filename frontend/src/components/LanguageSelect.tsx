import { useContext } from "react";
import { I18nContext, type Lang } from "../i18n";

/**
 * Dropdown in the page header. Option labels stay in their own language so a
 * user who cannot read the current UI language can still switch out of it.
 */
export function LanguageSelect() {
  const { lang, t, setLang } = useContext(I18nContext);
  return (
    <select
      className="lang-select"
      aria-label={t.header.languageLabel}
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
    >
      <option value="en">English</option>
      <option value="ko">한국어</option>
    </select>
  );
}
