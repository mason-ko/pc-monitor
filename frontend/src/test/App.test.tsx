import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
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

function errorJson(status: number, detail: string): Response {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("backend failure surfacing", () => {
  it("shows the unreachable banner with the underlying error while retrying", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.reject(new TypeError("connect ECONNREFUSED 127.0.0.1:8000")),
      ),
    );
    renderApp();
    const alert = await screen.findByRole("alert");
    expect((alert.textContent ?? "").includes("Backend unreachable")).toBe(true);
    // The raw failure string is surfaced so the user can diagnose the cause.
    expect(screen.getByText(/ECONNREFUSED/)).toBeTruthy();
    expect(screen.getByText("Retrying automatically…")).toBeTruthy();
  });

  it("keeps the last good data and warns when a later system refresh fails", async () => {
    let systemCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/api/system")) {
          systemCalls += 1;
          if (systemCalls === 1) return jsonResponse(systemFixture);
          return errorJson(500, "system metrics collection failed: cpu sensor exploded");
        }
        if (url.startsWith("/api/processes")) return jsonResponse(processesFixture);
        return jsonResponse(healthFixture);
      }),
    );
    renderApp();
    expect(await screen.findByRole("heading", { name: "Live monitoring" })).toBeTruthy();

    // The system poll fires again after its 2 s interval; the failure banner
    // appears while the healthy dashboard stays rendered.
    const alert = await screen.findByRole("alert", undefined, { timeout: 5000 });
    expect((alert.textContent ?? "").includes("System refresh failed")).toBe(true);
    expect((alert.textContent ?? "").includes("cpu sensor exploded")).toBe(true);
    // Last successful data is retained, not blanked out.
    expect(screen.getByRole("columnheader", { name: "Process" })).toBeTruthy();
    expect(screen.getAllByText("Test CPU 8-Core").length).toBeGreaterThan(0);
  });

  it("shows the process refresh failure banner without losing the table", async () => {
    let processCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/api/processes")) {
          processCalls += 1;
          if (processCalls === 1) return jsonResponse(processesFixture);
          return errorJson(500, "process collection failed: enumeration exploded");
        }
        if (url.startsWith("/api/system")) return jsonResponse(systemFixture);
        return jsonResponse(healthFixture);
      }),
    );
    renderApp();
    expect(await screen.findByText("test.exe")).toBeTruthy();

    const alert = await screen.findByRole("alert", undefined, { timeout: 5000 });
    expect((alert.textContent ?? "").includes("Process refresh failed")).toBe(true);
    expect((alert.textContent ?? "").includes("enumeration exploded")).toBe(true);
    expect(screen.getByText("test.exe")).toBeTruthy(); // stale rows kept
  });
});

describe("process explorer behavior", () => {
  const explorerFixture: ProcessesResponse = {
    processes: [
      { pid: 10, name: "heavy.exe", username: "tester", cpu_percent: 5, memory_bytes: 900_000_000, error: null },
      { pid: 20, name: "busy.exe", username: "tester", cpu_percent: 40, memory_bytes: 50_000_000, error: null },
      { pid: 30, name: "idle.exe", username: "tester", cpu_percent: 0.5, memory_bytes: 1_000_000, error: null },
    ],
    count: 300,
    returned: 3,
    truncated: true,
    timestamp: systemFixture.timestamp,
  };

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/api/processes")) return jsonResponse(explorerFixture);
        if (url.startsWith("/api/system")) return jsonResponse(systemFixture);
        return jsonResponse(healthFixture);
      }),
    );
  });

  // The dashboard renders two tables (network + processes); anchor queries to
  // the process explorer section so row assertions only see process rows.
  function procSection(): HTMLElement {
    const heading = screen.getByRole("heading", { name: "Process explorer" });
    const section = heading.closest("section");
    if (!section) throw new Error("process explorer section is not rendered");
    return section as HTMLElement;
  }

  function firstCellTexts(): string[] {
    return within(procSection())
      .queryAllByRole("row")
      .slice(1) // drop the header row
      .map((row) => row.querySelector("td")?.textContent ?? "");
  }

  it("sorts by memory by default and re-sorts by CPU on demand", async () => {
    const user = userEvent.setup();
    renderApp();
    expect(await screen.findByText("heavy.exe")).toBeTruthy();
    expect(firstCellTexts()).toEqual(["heavy.exe", "busy.exe", "idle.exe"]);

    await user.click(screen.getByRole("button", { name: "Sort by CPU" }));
    expect(firstCellTexts()).toEqual(["busy.exe", "heavy.exe", "idle.exe"]);
    expect(
      screen.getByRole("button", { name: "Sort by CPU" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("filters by name and by exact PID, and says so when nothing matches", async () => {
    const user = userEvent.setup();
    renderApp();
    const search = await screen.findByRole("searchbox", { name: "Search processes" });

    await user.type(search, "busy");
    expect(firstCellTexts()).toEqual(["busy.exe"]);
    // The counter describes the filtered set: 1 shown of 1 match.
    expect(screen.getByText("Showing 1 of 1")).toBeTruthy();

    await user.clear(search);
    await user.type(search, "20");
    expect(firstCellTexts()).toEqual(["busy.exe"]); // PID hit, not a name substring

    await user.clear(search);
    await user.type(search, "nosuchproc");
    expect(screen.getByText("No processes match “nosuchproc”.")).toBeTruthy();
    expect(within(procSection()).queryAllByRole("row")).toHaveLength(0);
  });

  it("states how many rows are shown of the truncated process total", async () => {
    renderApp();
    expect(
      await screen.findByText(/Showing 3 of 3 \(of 300 running processes total\)/),
    ).toBeTruthy();
  });
});

describe("semantic markup", () => {
  it("associates table headers with columns and gives disk meters readable values", async () => {
    renderApp();
    for (const name of ["Process", "PID", "Interface"]) {
      const header = await screen.findByRole("columnheader", { name });
      expect(header.getAttribute("scope")).toBe("col");
    }
    const meter = screen.getByRole("meter", { name: "Usage of C:\\" });
    expect(meter.getAttribute("aria-valuetext")).toBe("50.0%");
  });

  it("marks the system loading message as a polite live region", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/api/system") || url.startsWith("/api/processes")) {
          return new Promise<Response>(() => {}); // never settles: stays loading
        }
        return jsonResponse(healthFixture);
      }),
    );
    renderApp();
    const sysMsg = await screen.findByText("Loading system data…");
    expect(sysMsg.getAttribute("role")).toBe("status");
  });

  it("marks the process list loading message as a polite live region", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/api/system")) return jsonResponse(systemFixture);
        if (url.startsWith("/api/processes")) return new Promise<Response>(() => {});
        return jsonResponse(healthFixture);
      }),
    );
    renderApp();
    const procMsg = await screen.findByText("Loading process list…");
    expect(procMsg.getAttribute("role")).toBe("status");
  });
});
