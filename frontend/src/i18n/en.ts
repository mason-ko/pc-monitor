/**
 * English message catalog — the source of truth for every user-facing string.
 * `ko.ts` must have the exact same shape (`Messages`).
 * Placeholders like {error} or {query} are filled by `tr()` in ./index.ts.
 */
export const en = {
  header: {
    title: "PC Monitor",
    connecting: "Connecting…",
    live: "Live",
    offline: "Offline",
    languageLabel: "Language",
  },
  states: {
    backendUnreachable:
      "⚠ Backend unreachable — is the server running on 127.0.0.1:8000?",
    retrying: "Retrying automatically…",
    loadingSystem: "Loading system data…",
    systemRefreshFailed:
      "⚠ System refresh failed: {error} — showing last successful data.",
    unavailable: "Unavailable",
    unavailableLower: "unavailable",
    metricNotMeasured: "This metric could not be measured.",
    unknown: "Unknown",
  },
  sections: {
    systemInfo: "System information",
    liveMonitoring: "Live monitoring",
    processExplorer: "Process explorer",
  },
  gauges: {
    cpu: "CPU utilization",
    memory: "Memory utilization",
    gpu: "GPU utilization",
    unknownModel: "Unknown model",
    unknownGpu: "Unknown GPU",
    noNvidiaGpu: "No NVIDIA GPU detected.",
    cpuDetail: "{model} · {threads} threads",
    memoryDetail: "{used} used of {total} · {available} available",
    gpuDetail: "{name} · VRAM {used} / {total}",
  },
  chart: {
    title: "Utilization history (last ~2 minutes)",
    collecting: "Collecting samples…",
    seriesCpu: "CPU",
    seriesMemory: "Memory",
    seriesGpu: "GPU",
  },
  network: {
    title: "Network transfer rates",
    unavailable: "Network data unavailable: {error}",
    noInterfaces: "No network interfaces found.",
    colInterface: "Interface",
    colRx: "RX",
    colTx: "TX",
    colRxTotal: "RX total",
    colTxTotal: "TX total",
  },
  disks: {
    title: "Disk usage",
    unavailable: "Disk data unavailable: {error}",
    noPartitions: "No mounted disk partitions found.",
    usageOf: "Usage of {mount}",
    percentUsed: "{percent} used",
    detail: "{used} / {total} · {free} free",
  },
  sysinfo: {
    hostname: "Hostname",
    os: "OS",
    cpuModel: "CPU model",
    cpuCores: "CPU cores",
    machineUptime: "Machine uptime",
    gpu: "GPU",
    coresLogical: "{logical} logical",
    coresWithPhysical: "{logical} logical · {physical} physical",
  },
  processes: {
    loading: "Loading process list…",
    refreshFailed: "⚠ Process refresh failed: {error}",
    searchPlaceholder: "Search by name or PID…",
    searchAria: "Search processes",
    sortAria: "Sort processes",
    sortByCpu: "Sort by CPU",
    sortByMemory: "Sort by Memory",
    noMatch: "No processes match “{query}”.",
    noneReported: "No processes were reported.",
    colProcess: "Process",
    colPid: "PID",
    colCpu: "CPU",
    colMemory: "Memory",
    restricted: " restricted",
    pidLabel: "PID {pid}",
    showing: "Showing {shown} of {total}",
    ofRunning: " (of {count} running processes total)",
  },
  duration: {
    days: "d",
    hours: "h",
    minutes: "m",
    seconds: "s",
  },
};

export type Messages = typeof en;
