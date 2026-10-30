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

export function LiveChart({ data }: LiveChartProps) {
  if (data.length < 2) {
    return <div className="chart-placeholder">Collecting samples…</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={timeLabel}
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
          labelFormatter={(t) => timeLabel(Number(t))}
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
        <Line
          type="monotone"
          dataKey="cpu"
          name="CPU"
          stroke={SERIES.cpu}
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="memory"
          name="Memory"
          stroke={SERIES.memory}
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="gpu"
          name="GPU"
          stroke={SERIES.gpu}
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
