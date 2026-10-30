import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LiveChart, type ChartPoint } from "../components/LiveChart";

// Recharts is replaced with prop-recording stubs: the animation-restart we
// guard against lives in recharts' Line internals (it re-runs the draw
// animation whenever the computed points change, unless
// isAnimationActive === false), so the observable contract here is the prop
// each <Line> receives on every render.
const { capturedLineProps } = vi.hoisted(() => ({
  capturedLineProps: [] as Record<string, unknown>[],
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
  LineChart: ({ children }: { children: ReactNode }) => children,
  Line: (props: Record<string, unknown>) => {
    capturedLineProps.push(props);
    return null;
  },
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  CartesianGrid: () => null,
}));

function points(count: number): ChartPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    t: 1760000000000 + i * 2000,
    cpu: 10 + i,
    memory: 40 + i,
    gpu: null,
  }));
}

beforeEach(() => {
  capturedLineProps.length = 0;
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
