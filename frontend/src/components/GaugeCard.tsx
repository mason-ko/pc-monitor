import type { ReactNode } from "react";
import { fmtPercent } from "../format";

interface GaugeCardProps {
  label: string;
  percent: number | null;
  accent: string;
  detail: ReactNode;
  unavailableReason?: string | null;
}

export function GaugeCard({
  label,
  percent,
  accent,
  detail,
  unavailableReason,
}: GaugeCardProps) {
  const available = percent !== null;
  return (
    <div className="card gauge">
      <div className="card-title">
        <span className="swatch" aria-hidden style={{ background: accent }} />
        {label}
      </div>
      <div className={available ? "gauge-value" : "gauge-value unavailable"}>
        {available ? fmtPercent(percent) : "Unavailable"}
      </div>
      <div
        className="track"
        role="meter"
        aria-label={label}
        aria-valuenow={available ? percent : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={available ? fmtPercent(percent) : "unavailable"}
      >
        <div
          className="fill"
          style={{
            width: available ? `${Math.min(100, Math.max(0, percent))}%` : "0%",
            background: accent,
          }}
        />
      </div>
      <div className="gauge-detail">
        {available ? (
          detail
        ) : (
          <span className="muted">
            {unavailableReason ?? "This metric could not be measured."}
          </span>
        )}
      </div>
    </div>
  );
}
