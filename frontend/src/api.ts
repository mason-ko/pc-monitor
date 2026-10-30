export interface OsInfo {
  system: string;
  version_label: string;
  release: string;
  version: string;
  build: string | null;
  product_name: string | null;
  display_version: string | null;
  error: string | null;
}

export interface CpuSection {
  model: string | null;
  cores_logical: number | null;
  cores_physical: number | null;
  usage_percent: number | null;
  error: string | null;
}

export interface MemorySection {
  total: number | null;
  used: number | null;
  available: number | null;
  percent: number | null;
  error: string | null;
}

export interface DiskPartition {
  mountpoint: string;
  fstype: string;
  total: number | null;
  used: number | null;
  free: number | null;
  percent: number | null;
  error: string | null;
}

export interface DisksSection {
  partitions: DiskPartition[];
  error: string | null;
}

export interface GpuSection {
  available: boolean;
  source: string;
  name: string | null;
  utilization_percent: number | null;
  memory_used_bytes: number | null;
  memory_total_bytes: number | null;
  gpu_count: number | null;
  reason: string | null;
}

export interface NetworkInterface {
  name: string;
  rx_bytes: number;
  tx_bytes: number;
  rx_rate_bps: number | null;
  tx_rate_bps: number | null;
}

export interface NetworkSection {
  interfaces: NetworkInterface[];
  rx_rate_bps: number | null;
  tx_rate_bps: number | null;
  error: string | null;
}

export interface SystemInfo {
  hostname: string;
  timestamp: string;
  os: OsInfo;
  cpu: CpuSection;
  memory: MemorySection;
  disks: DisksSection;
  gpu: GpuSection;
  network: NetworkSection;
  boot_time: string;
}

export interface ProcessRow {
  pid: number;
  name: string | null;
  username: string | null;
  cpu_percent: number | null;
  memory_bytes: number | null;
  error: string | null;
}

export interface ProcessesResponse {
  processes: ProcessRow[];
  count: number;
  returned: number;
  truncated: boolean;
  timestamp: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime_seconds: number;
  python_version: string;
  pid: number;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    // The backend explains *why* an endpoint failed in the JSON body
    // (FastAPI sends {"detail": "..."} for its 500s); without it the UI
    // banners could only ever say "500 Internal Server Error".
    let detail = "";
    try {
      const body: unknown = await res.json();
      if (
        body &&
        typeof body === "object" &&
        "detail" in body &&
        typeof body.detail === "string"
      ) {
        detail = ` — ${body.detail}`;
      }
    } catch {
      // Non-JSON error body (proxy error page etc.): the status line is all
      // we have, and that is still better than swallowing the failure.
    }
    throw new Error(`${path} responded ${res.status} ${res.statusText}${detail}`);
  }
  return (await res.json()) as T;
}

export const fetchHealth = () => getJson<HealthResponse>("/api/health");
export const fetchSystem = () => getJson<SystemInfo>("/api/system");
export const fetchProcesses = () =>
  getJson<ProcessesResponse>("/api/processes?limit=500&sort=memory");
