import type { Lang } from "./i18n";

const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];

export interface DurationUnits {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
}

export function fmtBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  let value = n;
  let i = 0;
  while (value >= 1024 && i < UNITS.length - 1) {
    value /= 1024;
    i++;
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${UNITS[i]}`;
}

export function fmtRate(bps: number | null | undefined): string {
  if (bps === null || bps === undefined) return "—";
  return `${fmtBytes(bps)}/s`;
}

export function fmtPercent(p: number | null | undefined): string {
  if (p === null || p === undefined) return "—";
  return `${p.toFixed(1)}%`;
}

export function fmtDuration(
  seconds: number | null | undefined,
  units: DurationUnits = { days: "d", hours: "h", minutes: "m", seconds: "s" },
): string {
  if (seconds === null || seconds === undefined || seconds < 0) return "—";
  const s = Math.floor(seconds);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}${units.days} ${hours}${units.hours} ${minutes}${units.minutes}`;
  if (hours > 0) return `${hours}${units.hours} ${minutes}${units.minutes}`;
  return `${minutes}${units.minutes} ${s % 60}${units.seconds}`;
}

const LOCALES: Record<Lang, string> = { en: "en-US", ko: "ko-KR" };

export function timeLabel(t: number, lang: Lang = "en"): string {
  return new Date(t).toLocaleTimeString(LOCALES[lang], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
