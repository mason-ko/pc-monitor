import type { SystemInfo } from "../api";
import { fmtDuration } from "../format";

interface SystemInfoPanelProps {
  system: SystemInfo;
  machineUptimeSeconds: number | null;
}

export function SystemInfoPanel({
  system,
  machineUptimeSeconds,
}: SystemInfoPanelProps) {
  const items: Array<[string, string]> = [
    ["Hostname", system.hostname],
    ["OS", system.os.version_label ?? "Unknown"],
    ["CPU model", system.cpu.model ?? "Unavailable"],
    [
      "CPU cores",
      system.cpu.cores_logical
        ? `${system.cpu.cores_logical} logical` +
          (system.cpu.cores_physical
            ? ` · ${system.cpu.cores_physical} physical`
            : "")
        : "Unavailable",
    ],
    ["Machine uptime", fmtDuration(machineUptimeSeconds)],
    [
      "GPU",
      system.gpu.available && system.gpu.name
        ? system.gpu.name
        : "Unavailable",
    ],
  ];
  return (
    <dl className="info-grid">
      {items.map(([label, value]) => (
        <div className="info-item" key={label}>
          <dt>{label}</dt>
          <dd title={value}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
