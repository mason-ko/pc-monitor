import { useContext } from "react";
import type { DisksSection } from "../api";
import { SERIES } from "../colors";
import { I18nContext, tr } from "../i18n";
import { fmtBytes, fmtPercent } from "../format";

export function DisksPanel({ disks }: { disks: DisksSection }) {
  const { t } = useContext(I18nContext);
  if (disks.error) {
    return (
      <p className="unavailable-note">
        {tr(t.disks.unavailable, { error: disks.error })}
      </p>
    );
  }
  if (disks.partitions.length === 0) {
    return <p className="muted">{t.disks.noPartitions}</p>;
  }
  return (
    <div className="disk-list">
      {disks.partitions.map((part) => (
        <div className="disk-row" key={part.mountpoint}>
          <div className="disk-head">
            <span className="disk-mount">{part.mountpoint}</span>
            <span className="muted">{part.fstype}</span>
          </div>
          {part.error ? (
            <p className="unavailable-note">{part.error}</p>
          ) : (
            <>
              <div
                className="track"
                role="meter"
                aria-label={tr(t.disks.usageOf, { mount: part.mountpoint })}
                aria-valuenow={part.percent ?? undefined}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={fmtPercent(part.percent)}
              >
                <div
                  className="fill"
                  style={{
                    width: `${Math.min(100, Math.max(0, part.percent ?? 0))}%`,
                    background: SERIES.cpu,
                  }}
                />
              </div>
              <div className="disk-detail">
                <span>{tr(t.disks.percentUsed, { percent: fmtPercent(part.percent) })}</span>
                <span className="muted">
                  {tr(t.disks.detail, {
                    used: fmtBytes(part.used),
                    total: fmtBytes(part.total),
                    free: fmtBytes(part.free),
                  })}
                </span>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
