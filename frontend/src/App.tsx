import { useContext, useEffect, useState } from "react";
import {
  fetchHealth,
  fetchProcesses,
  fetchSystem,
  type SystemInfo,
} from "./api";
import { SERIES, STATUS } from "./colors";
import { DisksPanel } from "./components/DisksPanel";
import { GaugeCard } from "./components/GaugeCard";
import { LanguageSelect } from "./components/LanguageSelect";
import { LiveChart, type ChartPoint } from "./components/LiveChart";
import { NetworkPanel } from "./components/NetworkPanel";
import { ProcessExplorer } from "./components/ProcessExplorer";
import { SystemInfoPanel } from "./components/SystemInfoPanel";
import { I18nContext, tr } from "./i18n";
import { fmtBytes } from "./format";
import { usePolling } from "./usePolling";

const HISTORY_LIMIT = 60; // ~2 minutes at 2 s refresh

export default function App() {
  const { t } = useContext(I18nContext);
  const system = usePolling<SystemInfo>(fetchSystem, 2000);
  const processes = usePolling(fetchProcesses, 2000);
  const health = usePolling(fetchHealth, 5000);

  const [history, setHistory] = useState<ChartPoint[]>([]);

  useEffect(() => {
    const sys = system.data;
    if (!sys) return;
    const ts = Date.parse(sys.timestamp) || Date.now();
    setHistory((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].t === ts) return prev;
      return [
        ...prev,
        {
          t: ts,
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
            {t.states.backendUnreachable}
          </p>
          <p className="muted">{system.error}</p>
          <p className="muted">{t.states.retrying}</p>
        </div>
      </div>
    );
  }

  if (!sys) {
    return (
      <div className="page">
        <Header hostname={null} osLabel={null} online={health.data?.status === "ok"} />
        <div className="card">
          <p className="loading-pulse">{t.states.loadingSystem}</p>
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
          {tr(t.states.systemRefreshFailed, { error: system.error })}
        </p>
      )}

      <section aria-labelledby="sysinfo-title">
        <h2 id="sysinfo-title" className="section-title">
          {t.sections.systemInfo}
        </h2>
        <div className="card">
          <SystemInfoPanel system={sys} machineUptimeSeconds={machineUptime} />
        </div>
      </section>

      <section aria-labelledby="live-title">
        <h2 id="live-title" className="section-title">
          {t.sections.liveMonitoring}
        </h2>
        <div className="gauge-row">
          <GaugeCard
            label={t.gauges.cpu}
            percent={sys.cpu.usage_percent}
            accent={SERIES.cpu}
            unavailableReason={sys.cpu.error}
            detail={
              <span>
                {tr(t.gauges.cpuDetail, {
                  model: sys.cpu.model ?? t.gauges.unknownModel,
                  threads: sys.cpu.cores_logical ?? "?",
                })}
              </span>
            }
          />
          <GaugeCard
            label={t.gauges.memory}
            percent={sys.memory.percent}
            accent={SERIES.memory}
            unavailableReason={sys.memory.error}
            detail={
              <span>
                {tr(t.gauges.memoryDetail, {
                  used: fmtBytes(sys.memory.used),
                  total: fmtBytes(sys.memory.total),
                  available: fmtBytes(sys.memory.available),
                })}
              </span>
            }
          />
          <GaugeCard
            label={t.gauges.gpu}
            percent={sys.gpu.available ? sys.gpu.utilization_percent : null}
            accent={SERIES.gpu}
            unavailableReason={
              sys.gpu.available ? sys.gpu.reason : sys.gpu.reason ?? t.gauges.noNvidiaGpu
            }
            detail={
              <span>
                {tr(t.gauges.gpuDetail, {
                  name: sys.gpu.name ?? t.gauges.unknownGpu,
                  used: fmtBytes(sys.gpu.memory_used_bytes),
                  total: fmtBytes(sys.gpu.memory_total_bytes),
                })}
              </span>
            }
          />
        </div>
        <div className="card">
          <div className="card-title">{t.chart.title}</div>
          <LiveChart data={history} />
        </div>
        <div className="two-col">
          <div className="card">
            <div className="card-title">{t.network.title}</div>
            <NetworkPanel network={sys.network} />
          </div>
          <div className="card">
            <div className="card-title">{t.disks.title}</div>
            <DisksPanel disks={sys.disks} />
          </div>
        </div>
      </section>

      <section aria-labelledby="proc-title">
        <h2 id="proc-title" className="section-title">
          {t.sections.processExplorer}
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
  const { t } = useContext(I18nContext);
  return (
    <header className="page-header">
      <h1>{t.header.title}</h1>
      <p className="header-meta">
        {hostname ?? t.header.connecting}
        {osLabel ? ` · ${osLabel}` : ""}
      </p>
      <LanguageSelect />
      <span
        className="status-dot"
        style={{ color: online ? STATUS.good : STATUS.critical }}
        role="status"
      >
        ● {online ? t.header.live : t.header.offline}
      </span>
    </header>
  );
}
