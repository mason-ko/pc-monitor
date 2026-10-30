import { memo, useContext } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART, SERIES } from "../colors";
import { I18nContext } from "../i18n";
import { timeLabel } from "../format";

export interface ChartPoint {
  t: number;
  cpu: number | null;
  memory: number | null;
  gpu: number | null;
}

interface LiveChartProps {
  data: ChartPoint[];
}

// Rolling time window sized to App's history buffer (60 samples × ~2 s poll
// ≈ 2 minutes). The buffer does not span exactly that: usePolling's in-flight
// guard can stretch the gap between samples (real dt runs 2.0–2.3 s), so a
// full buffer may hold more than WINDOW_MS of history and the oldest samples
// are clipped off the left edge — that clipping is intentional and the window
// width stays constant. The x-domain is this FIXED width rather than
// ["dataMin", "dataMax"]: with a data-derived domain every incoming sample
// changes the x-scale, so all existing points shift and the whole curve is
// re-stretched from the left edge on each poll (that rescale — not the
// animation — is what reads as "redrawn from the left" even with
// isAnimationActive={false}). A fixed-width domain keeps the x-scale
// constant: existing samples hold their pixel positions and each new sample
// simply extends the curve. Once the window is full it rolls forward in one
// clean step per advance (quantized to exact multiples of SAMPLE_STEP_MS —
// see windowStart) instead of rescaling continuously.
const SAMPLE_STEP_MS = 2000;
const WINDOW_MS = 120_000;

/**
 * Memoized: App re-renders on every poll tick, and the system / processes /
 * health timers fire at slightly different moments, so roughly half of those
 * renders carry a new `processes`/`health` payload while `data` (the chart
 * buffer) is the identical array reference. Memoizing lets React skip the
 * whole recharts subtree on those ticks. Language switches still re-render:
 * `I18nContext` is consumed *inside* this component, and context updates
 * bypass memo.
 */
export const LiveChart = memo(function LiveChart({ data }: LiveChartProps) {
  const { t, lang } = useContext(I18nContext);
  if (data.length < 2) {
    return <div className="chart-placeholder">{t.chart.collecting}</div>;
  }
  const first = data[0].t;
  const last = data[data.length - 1].t;
  // Anchored at the first sample while the window is still filling, then it
  // rolls forward in quantized steps. The quantization is epoch-aligned
  // (milliseconds / 2000 rounded up), not aligned to the sample timestamps,
  // so roll timing drifts with poll jitter while each advance stays an exact
  // multiple of SAMPLE_STEP_MS. ceil (not floor) so the right edge always
  // covers `last`: a floor-rounded start leaves the newest sample up to one
  // step past the edge and recharts clips its final segment for ~one poll
  // cycle; the ≤ one step of slack goes off the oldest, off-window end
  // instead.
  const windowStart = Math.max(
    first,
    Math.ceil((last - WINDOW_MS) / SAMPLE_STEP_MS) * SAMPLE_STEP_MS,
  );
  const domain: [number, number] = [windowStart, windowStart + WINDOW_MS];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={domain}
          tickFormatter={(ts: number) => timeLabel(ts, lang)}
          stroke={CHART.axis}
          tick={{ fill: CHART.muted, fontSize: 11 }}
          minTickGap={48}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickFormatter={(v: number) => `${v}%`}
          stroke={CHART.axis}
          tick={{ fill: CHART.muted, fontSize: 11 }}
          width={46}
        />
        <Tooltip
          labelFormatter={(ts) => timeLabel(Number(ts), lang)}
          formatter={(value: number | string, name: string) => [
            typeof value === "number" ? `${value.toFixed(1)}%` : value,
            name,
          ]}
          contentStyle={{
            background: CHART.tooltipBg,
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 8,
            color: CHART.ink,
            fontSize: 12,
          }}
          cursor={{ stroke: CHART.muted, strokeDasharray: "4 4" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART.muted }} />
        {/* Recharts restarts the line-drawing animation whenever the computed
            points change (recharts 2.15.x), so polling would otherwise replay
            it every ~2 s. isAnimationActive={false} suppresses that replay;
            the fixed-width x-domain above is what keeps each new sample from
            re-scaling — and therefore re-drawing — the existing curve. */}
        <Line
          type="monotone"
          dataKey="cpu"
          name={t.chart.seriesCpu}
          stroke={SERIES.cpu}
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="memory"
          name={t.chart.seriesMemory}
          stroke={SERIES.memory}
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="gpu"
          name={t.chart.seriesGpu}
          stroke={SERIES.gpu}
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});
