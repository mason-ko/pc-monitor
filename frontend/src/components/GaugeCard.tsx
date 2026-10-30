import { useContext, type ReactNode } from "react";
import { I18nContext } from "../i18n";
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
  const { t } = useContext(I18nContext);
  const available = percent !== null;
  return (
    <div className="card gauge">
      <div className="card-title">
        <span className="swatch" aria-hidden style={{ background: accent }} />
        {label}
      </div>
      <div className={available ? "gauge-value" : "gauge-value unavailable"}>
        {available ? fmtPercent(percent) : t.states.unavailable}
      </div>
      <div
        className="track"
        role="meter"
        aria-label={label}
        aria-valuenow={available ? percent : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={available ? fmtPercent(percent) : t.states.unavailableLower}
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
            {unavailableReason ?? t.states.metricNotMeasured}
          </span>
        )}
      </div>
    </div>
  );
}
