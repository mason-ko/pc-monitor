import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { I18nProvider } from "../i18n/I18nProvider";
import { LANG_STORAGE_KEY } from "../i18n";
import type { HealthResponse, ProcessesResponse, SystemInfo } from "../api";

const GiB = 1024 ** 3;

const systemFixture: SystemInfo = {
  hostname: "TESTBOX",
  timestamp: new Date("2026-01-01T12:00:00Z").toISOString(),
  os: {
    system: "Windows",
    version_label: "Windows 11 Home",
    release: "11",
    version: "",
    build: "26200",
    product_name: null,
    display_version: null,
    error: null,
  },
  cpu: {
    model: "Test CPU 8-Core",
    cores_logical: 8,
    cores_physical: 4,
    usage_percent: 42.5,
    error: null,
  },
  memory: {
    total: 16 * GiB,
    used: 8 * GiB,
    available: 8 * GiB,
    percent: 50,
    error: null,
  },
  disks: {
    partitions: [
      {
        mountpoint: "C:\\",
        fstype: "NTFS",
        total: 500 * GiB,
        used: 250 * GiB,
        free: 250 * GiB,
        percent: 50,
        error: null,
      },
    ],
    error: null,
  },
  gpu: {
    available: false,
    source: "nvidia-smi",
    name: null,
    utilization_percent: null,
    memory_used_bytes: null,
    memory_total_bytes: null,
    gpu_count: null,
    reason: null,
  },
  network: {
    interfaces: [
      { name: "Ethernet", rx_bytes: 1000, tx_bytes: 2000, rx_rate_bps: 500, tx_rate_bps: 600 },
    ],
    rx_rate_bps: 500,
    tx_rate_bps: 600,
    error: null,
  },
  boot_time: new Date("2026-01-01T11:00:00Z").toISOString(),
};

const processesFixture: ProcessesResponse = {
  processes: [
    {
      pid: 1234,
      name: "test.exe",
      username: "tester",
      cpu_percent: 1.5,
      memory_bytes: 123456,
      error: null,
    },
  ],
  count: 1,
  returned: 1,
  truncated: false,
  timestamp: systemFixture.timestamp,
};

const healthFixture: HealthResponse = {
  status: "ok",
  timestamp: systemFixture.timestamp,
  uptime_seconds: 10,
  python_version: "3.12.0",
  pid: 1,
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

function renderApp() {
  return render(
    <I18nProvider>
      <App />
    </I18nProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/health")) return jsonResponse(healthFixture);
      if (url.startsWith("/api/processes")) return jsonResponse(processesFixture);
      if (url.startsWith("/api/system")) return jsonResponse(systemFixture);
      return new Response("not found", { status: 404 });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("language switching", () => {
  it("renders the UI in English by default", async () => {
    renderApp();
    expect(await screen.findByRole("heading", { name: "System information" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Live monitoring" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Process explorer" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "PC Monitor" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Process" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sort by CPU" })).toBeTruthy();
    expect(screen.getByText("Collecting samples…")).toBeTruthy();
    // GPU is unavailable in the fixture — its strings must be translated too
    // ("Unavailable" appears in both the gauge and the sysinfo GPU row).
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.getByText("No NVIDIA GPU detected.")).toBeTruthy();
  });

  it("switches the whole UI to Korean and persists the choice", async () => {
    const user = userEvent.setup();
    renderApp();
    const select = await screen.findByLabelText("Language");
    await user.selectOptions(select, "ko");

    expect(await screen.findByRole("heading", { name: "시스템 정보" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "실시간 모니터링" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "프로세스 탐색기" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "PC 모니터" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "프로세스" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "CPU순 정렬" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "메모리순 정렬" })).toBeTruthy();
    expect(screen.getByLabelText("프로세스 검색")).toBeTruthy();
    expect(screen.getByText("메모리 사용률")).toBeTruthy();
    expect(screen.getAllByText("사용 불가").length).toBeGreaterThan(0);
    expect(screen.getByText("NVIDIA GPU를 감지할 수 없습니다.")).toBeTruthy();
    expect(screen.getByText("샘플 수집 중…")).toBeTruthy();

    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe("ko");
    expect(document.documentElement.lang).toBe("ko");
    expect(document.title).toBe("PC 모니터");

    // No English UI strings remain (system-provided values like hostname stay).
    expect(screen.queryByText("Collecting samples…")).toBeNull();
    expect(screen.queryByText("Sort by CPU")).toBeNull();
    expect(screen.queryByText("No NVIDIA GPU detected.")).toBeNull();
  });

  it("switches back to English", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(LANG_STORAGE_KEY, "ko");
    renderApp();
    const select = await screen.findByLabelText("언어");
    await user.selectOptions(select, "en");

    expect(await screen.findByRole("heading", { name: "System information" })).toBeTruthy();
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });
});

describe("language persistence across reloads", () => {
  it("restores the stored Korean choice on a fresh render without interaction", async () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, "ko");
    renderApp(); // a fresh render stands in for a page reload
    expect(await screen.findByRole("heading", { name: "시스템 정보" })).toBeTruthy();
    expect(document.documentElement.lang).toBe("ko");
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe("ko");
  });

  it("restores the stored English choice even in a Korean browser", async () => {
    Object.defineProperty(navigator, "language", { value: "ko-KR", configurable: true });
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, "en");
      renderApp();
      expect(await screen.findByRole("heading", { name: "System information" })).toBeTruthy();
    } finally {
      Object.defineProperty(navigator, "language", {
        value: "en-US",
        configurable: true,
      });
    }
  });

  it("falls back to the browser locale when nothing is stored", async () => {
    Object.defineProperty(navigator, "language", { value: "ko-KR", configurable: true });
    try {
      renderApp();
      expect(await screen.findByRole("heading", { name: "시스템 정보" })).toBeTruthy();
    } finally {
      Object.defineProperty(navigator, "language", {
        value: "en-US",
        configurable: true,
      });
    }
  });

  it("ignores a corrupt stored value and falls back to English", async () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, "klingon");
    renderApp();
    expect(await screen.findByRole("heading", { name: "System information" })).toBeTruthy();
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe("en");
  });
});
