const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];

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

export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds < 0) return "—";
  const s = Math.floor(seconds);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${s % 60}s`;
}

export function timeLabel(t: number): string {
  return new Date(t).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
