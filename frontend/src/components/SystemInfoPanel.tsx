import { useContext } from "react";
import type { SystemInfo } from "../api";
import { I18nContext, tr } from "../i18n";
import { fmtDuration } from "../format";

interface SystemInfoPanelProps {
  system: SystemInfo;
  machineUptimeSeconds: number | null;
}

export function SystemInfoPanel({
  system,
  machineUptimeSeconds,
}: SystemInfoPanelProps) {
  const { t } = useContext(I18nContext);
  const cores = system.cpu.cores_logical
    ? system.cpu.cores_physical
      ? tr(t.sysinfo.coresWithPhysical, {
          logical: system.cpu.cores_logical,
          physical: system.cpu.cores_physical,
        })
      : tr(t.sysinfo.coresLogical, { logical: system.cpu.cores_logical })
    : t.states.unavailable;
  const items: Array<[string, string]> = [
    [t.sysinfo.hostname, system.hostname],
    [t.sysinfo.os, system.os.version_label ?? t.states.unknown],
    [t.sysinfo.cpuModel, system.cpu.model ?? t.states.unavailable],
    [t.sysinfo.cpuCores, cores],
    [t.sysinfo.machineUptime, fmtDuration(machineUptimeSeconds, t.duration)],
    [
      t.sysinfo.gpu,
      system.gpu.available && system.gpu.name
        ? system.gpu.name
        : t.states.unavailable,
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
