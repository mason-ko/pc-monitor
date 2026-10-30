import type { DisksSection } from "../api";
import { SERIES } from "../colors";
import { fmtBytes, fmtPercent } from "../format";

export function DisksPanel({ disks }: { disks: DisksSection }) {
  if (disks.error) {
    return <p className="unavailable-note">Disk data unavailable: {disks.error}</p>;
  }
  if (disks.partitions.length === 0) {
    return <p className="muted">No mounted disk partitions found.</p>;
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
                aria-label={`Usage of ${part.mountpoint}`}
                aria-valuenow={part.percent ?? undefined}
                aria-valuemin={0}
                aria-valuemax={100}
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
                <span>{fmtPercent(part.percent)} used</span>
                <span className="muted">
                  {fmtBytes(part.used)} / {fmtBytes(part.total)} · {fmtBytes(part.free)} free
                </span>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
