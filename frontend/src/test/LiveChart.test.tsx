import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LiveChart, type ChartPoint } from "../components/LiveChart";

// Recharts is replaced with prop-recording stubs: the re-draw artifact lives
// in the props LiveChart hands recharts (a data-derived x-domain re-scales
// every existing point on each poll, and recharts restarts the draw animation
// whenever computed points change unless isAnimationActive === false), so the
// observable contract here is the props each <XAxis>/<Line> receives on every
// render.
const { capturedLineProps, capturedAxisProps } = vi.hoisted(() => ({
  capturedLineProps: [] as Record<string, unknown>[],
  capturedAxisProps: [] as Record<string, unknown>[],
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
  LineChart: ({ children }: { children: ReactNode }) => children,
  Line: (props: Record<string, unknown>) => {
    capturedLineProps.push(props);
    return null;
  },
  XAxis: (props: Record<string, unknown>) => {
    capturedAxisProps.push(props);
    return null;
  },
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  CartesianGrid: () => null,
}));

const T0 = 1760000000000; // grid-aligned (multiple of the 2 s poll step)

function points(count: number, start = 0): ChartPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    t: T0 + (start + i) * 2000,
    cpu: 10 + start + i,
    memory: 40 + start + i,
    gpu: null,
  }));
}

function xDomains(): Array<[number, number]> {
  return capturedAxisProps.map((p) => p.domain as [number, number]);
}

beforeEach(() => {
  capturedLineProps.length = 0;
  capturedAxisProps.length = 0;
});

describe("LiveChart line animation", () => {
  it("keeps the 'collecting' placeholder while there are fewer than 2 points", () => {
    const { container } = render(<LiveChart data={points(1)} />);
    expect(container.textContent).toBe("Collecting samples…");
    expect(capturedLineProps).toHaveLength(0);
  });

  it("renders three lines, each with animation disabled", () => {
    render(<LiveChart data={points(2)} />);
    expect(capturedLineProps.map((p) => p.dataKey)).toEqual([
      "cpu",
      "memory",
      "gpu",
    ]);
    for (const props of capturedLineProps) {
      expect(props.isAnimationActive).toBe(false);
    }
  });

  it("keeps animation disabled when new data extends the chart", () => {
    const { rerender } = render(<LiveChart data={points(2)} />);
    rerender(<LiveChart data={points(3)} />);
    rerender(<LiveChart data={points(4)} />);

    // Three lines × three renders: every render after a data update must
    // still carry isAnimationActive={false}, otherwise recharts would
    // restart the draw animation from the left edge.
    expect(capturedLineProps).toHaveLength(9);
    expect(capturedLineProps.every((p) => p.isAnimationActive === false)).toBe(
      true,
    );
  });
});

describe("LiveChart stable time-domain window", () => {
  it("uses a fixed 2-minute window instead of [dataMin, dataMax]", () => {
    render(<LiveChart data={points(2)} />);
    const domain = xDomains()[0];
    expect(domain[1] - domain[0]).toBe(120_000);
    // While the buffer is still filling, the window is anchored at the first
    // sample so the curve extends rightward instead of re-stretching.
    expect(domain[0]).toBe(T0);
  });

  it("keeps the x-domain identical across polls while samples extend the curve", () => {
    const { rerender } = render(<LiveChart data={points(2)} />);
    rerender(<LiveChart data={points(3)} />);
    rerender(<LiveChart data={points(10)} />);

    const domains = xDomains();
    expect(domains).toHaveLength(3);
    // If the domain changed, every existing point's pixel position would
    // move on every tick — the "redrawn from the left" artifact.
    expect(domains[1]).toEqual(domains[0]);
    expect(domains[2]).toEqual(domains[0]);
  });

  it("rolls the window forward in poll-aligned steps once it is full", () => {
    const { rerender } = render(<LiveChart data={points(61)} />);
    rerender(<LiveChart data={points(62)} />);
    rerender(<LiveChart data={points(63)} />);

    const domains = xDomains();
    for (const d of domains) {
      expect(d[1] - d[0]).toBe(120_000);
    }
    // Past the window the left edge advances — but only in whole ~2 s steps,
    // so the existing curve translates rigidly rather than re-scaling.
    const lefts = domains.map((d) => d[0]);
    for (let i = 1; i < lefts.length; i++) {
      expect(lefts[i]).toBeGreaterThanOrEqual(lefts[i - 1]);
      expect((lefts[i] - lefts[i - 1]) % 2000).toBe(0);
    }
    expect(lefts[2]).toBeGreaterThan(lefts[0]);
  });

  it("keeps the newest sample inside the domain once jitter stretches the buffer past the window", () => {
    // Real dt runs 2.0–2.3 s (usePolling's in-flight guard), so a full
    // buffer can span more than the 120 s window and its timestamps land
    // off the 2 s grid. The domain's right edge must still cover the newest
    // sample: a floor-quantized window start puts `last` up to 2 s past the
    // edge and recharts clips the final segment of the most recent reading.
    const jittered: ChartPoint[] = Array.from({ length: 60 }, (_, i) => ({
      t: T0 + i * 2300, // 59 × 2300 ms = 135.7 s span > the 120 s window
      cpu: 10 + i,
      memory: 40 + i,
      gpu: null,
    }));
    render(<LiveChart data={jittered} />);
    const domain = xDomains()[0];
    // Still exactly the fixed width, but wide enough on the right that the
    // newest sample renders in full instead of being clipped.
    expect(domain[1] - domain[0]).toBe(120_000);
    expect(domain[1]).toBeGreaterThanOrEqual(jittered[jittered.length - 1].t);
  });
});

describe("LiveChart memoization", () => {
  it("skips the chart re-render when the parent re-renders with the same data array", () => {
    const data = points(5);
    const { rerender } = render(<LiveChart data={data} />);
    // The processes/health polls re-render App while the chart buffer is the
    // identical array reference; re-rendering the recharts subtree for those
    // ticks is pure churn, so memo must bail out.
    rerender(<LiveChart data={data} />);
    rerender(<LiveChart data={data} />);
    expect(capturedAxisProps).toHaveLength(1);
    expect(capturedLineProps).toHaveLength(3);

    // A poll that appends a new sample (fresh array) must still re-render.
    rerender(<LiveChart data={points(6)} />);
    expect(capturedAxisProps).toHaveLength(2);
    expect(capturedLineProps).toHaveLength(6);
  });
});
