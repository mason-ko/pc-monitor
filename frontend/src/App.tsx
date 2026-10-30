import { useEffect, useState } from "react";
import {
  fetchHealth,
  fetchProcesses,
  fetchSystem,
  type SystemInfo,
} from "./api";
import { SERIES, STATUS } from "./colors";
import { DisksPanel } from "./components/DisksPanel";
import { GaugeCard } from "./components/GaugeCard";
import { LiveChart, type ChartPoint } from "./components/LiveChart";
import { NetworkPanel } from "./components/NetworkPanel";
import { ProcessExplorer } from "./components/ProcessExplorer";
import { SystemInfoPanel } from "./components/SystemInfoPanel";
import { fmtBytes } from "./format";
import { usePolling } from "./usePolling";

const HISTORY_LIMIT = 60; // ~2 minutes at 2 s refresh

export default function App() {
  const system = usePolling<SystemInfo>(fetchSystem, 2000);
  const processes = usePolling(fetchProcesses, 2000);
  const health = usePolling(fetchHealth, 5000);

  const [history, setHistory] = useState<ChartPoint[]>([]);

  useEffect(() => {
    const sys = system.data;
    if (!sys) return;
    const t = Date.parse(sys.timestamp) || Date.now();
    setHistory((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].t === t) return prev;
      return [
        ...prev,
        {
          t,
          cpu: sys.cpu.usage_percent,
          memory: sys.memory.percent,
          gpu: sys.gpu.available ? sys.gpu.utilization_percent : null,
        },
      ].slice(-HISTORY_LIMIT);
    });
  }, [system.data]);

  const sys = system.data;
  const backendDown = system.error !== null && sys === null;
  const machineUptime = sys
    ? Math.max(0, Date.now() - Date.parse(sys.boot_time)) / 1000
    : null;

  if (backendDown) {
    return (
      <div className="page">
        <Header hostname={null} osLabel={null} online={false} />
        <div className="card">
          <p className="banner banner-error" role="alert">
            ⚠ Backend unreachable — is the server running on 127.0.0.1:8000?
          </p>
          <p className="muted">{system.error}</p>
          <p className="muted">Retrying automatically…</p>
        </div>
      </div>
    );
  }

  if (!sys) {
    return (
      <div className="page">
        <Header hostname={null} osLabel={null} online={health.data?.status === "ok"} />
        <div className="card">
          <p className="loading-pulse">Loading system data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Header
        hostname={sys.hostname}
        osLabel={sys.os.version_label}
        online={system.error === null && health.data?.status === "ok"}
      />
      {system.error && (
        <p className="banner banner-error" role="alert">
          ⚠ System refresh failed: {system.error} — showing last successful data.
        </p>
      )}

      <section aria-labelledby="sysinfo-title">
        <h2 id="sysinfo-title" className="section-title">
          System information
        </h2>
        <div className="card">
          <SystemInfoPanel system={sys} machineUptimeSeconds={machineUptime} />
        </div>
      </section>

      <section aria-labelledby="live-title">
        <h2 id="live-title" className="section-title">
          Live monitoring
        </h2>
        <div className="gauge-row">
          <GaugeCard
            label="CPU utilization"
            percent={sys.cpu.usage_percent}
            accent={SERIES.cpu}
            unavailableReason={sys.cpu.error}
            detail={
              <span>
                {sys.cpu.model ?? "Unknown model"} ·{" "}
                {sys.cpu.cores_logical ?? "?"} threads
              </span>
            }
          />
          <GaugeCard
            label="Memory utilization"
            percent={sys.memory.percent}
            accent={SERIES.memory}
            unavailableReason={sys.memory.error}
            detail={
              <span>
                {fmtBytes(sys.memory.used)} used of {fmtBytes(sys.memory.total)} ·{" "}
                {fmtBytes(sys.memory.available)} available
              </span>
            }
          />
          <GaugeCard
            label="GPU utilization"
            percent={sys.gpu.available ? sys.gpu.utilization_percent : null}
            accent={SERIES.gpu}
            unavailableReason={
              sys.gpu.available ? sys.gpu.reason : sys.gpu.reason ?? "No NVIDIA GPU detected."
            }
            detail={
              <span>
                {sys.gpu.name ?? "Unknown GPU"} · VRAM{" "}
                {fmtBytes(sys.gpu.memory_used_bytes)} /{" "}
                {fmtBytes(sys.gpu.memory_total_bytes)}
              </span>
            }
          />
        </div>
        <div className="card">
          <div className="card-title">Utilization history (last ~2 minutes)</div>
          <LiveChart data={history} />
        </div>
        <div className="two-col">
          <div className="card">
            <div className="card-title">Network transfer rates</div>
            <NetworkPanel network={sys.network} />
          </div>
          <div className="card">
            <div className="card-title">Disk usage</div>
            <DisksPanel disks={sys.disks} />
          </div>
        </div>
      </section>

      <section aria-labelledby="proc-title">
        <h2 id="proc-title" className="section-title">
          Process explorer
        </h2>
        <div className="card">
          <ProcessExplorer
            response={processes.data}
            loading={processes.loading}
            error={processes.error}
          />
        </div>
      </section>
    </div>
  );
}

function Header({
  hostname,
  osLabel,
  online,
}: {
  hostname: string | null;
  osLabel: string | null;
  online: boolean;
}) {
  return (
    <header className="page-header">
      <h1>PC Monitor</h1>
      <p className="header-meta">
        {hostname ?? "Connecting…"}
        {osLabel ? ` · ${osLabel}` : ""}
      </p>
      <span
        className="status-dot"
        style={{ color: online ? STATUS.good : STATUS.critical }}
        role="status"
      >
        ● {online ? "Live" : "Offline"}
      </span>
    </header>
  );
}
