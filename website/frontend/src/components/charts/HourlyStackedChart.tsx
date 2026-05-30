import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
} from "recharts";
import { useTheme } from "../../context/ThemeContext";
import { maxOfSeries, milestoneTicks } from "../../lib/chartAxisUtils";
import { chartPalette } from "../../lib/chartColors";
import {
  CHART_ANIMATION,
  CHART_MARGIN,
  CATEGORY_COLORS,
  chartLegendProps,
  chartTooltipStyle,
  modeLabel,
  stackedHourlyYLabel,
} from "../../lib/chartTheme";
import type { Mode } from "../../types";
import { CustomChartLegend } from "./CustomChartLegend";
import { ChartMilestoneLines, ChartXAxis, ChartYAxis } from "./ChartAxes";
import { ChartPanel } from "./ChartPanel";
import { ChartShell } from "./ChartShell";

export type StackedChartType = "stacked" | "grouped" | "line";

const CHART_OPTIONS = [
  { value: "stacked" as const, label: "Stacked" },
  { value: "line" as const, label: "Line" },
];

interface Row {
  hour: number;
  category: string;
  delay_minutes: number;
}

interface Props {
  rows: Row[];
  title?: string;
  compact?: boolean;
  mode?: Mode;
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

export function HourlyStackedChart({ rows, title, compact, mode = "bus" }: Props) {
  const { theme } = useTheme();
  const [chartType, setChartType] = useState<StackedChartType>("stacked");
  const colors = chartPalette(theme);
  const tooltipProps = chartTooltipStyle(theme);
  const legend = <Legend {...chartLegendProps(theme)} />;
  const margin = { top: 10, right: 30, left: 10, bottom: 10 };
  const anim = CHART_ANIMATION;
  const plotHeight = compact ? 200 : 240;

  const { data, categories } = useMemo(() => {
    const cats = [...new Set((rows ?? []).map((r) => r.category))];
    const byHour = new Map<number, Record<string, number | string>>();
    for (let h = 0; h < 24; h += 1) {
      const entry: Record<string, number | string> = { hour: h, label: formatHour(h) };
      for (const cat of cats) entry[cat] = 0;
      byHour.set(h, entry);
    }
    for (const row of rows ?? []) {
      const entry = byHour.get(row.hour);
      if (entry) entry[row.category] = row.delay_minutes;
    }
    return { data: [...byHour.values()], categories: cats };
  }, [rows]);

  const legendItems = useMemo(() => {
    return categories.map(cat => ({
      label: cat,
      color: CATEGORY_COLORS[cat] ?? "#94a3b8"
    }));
  }, [categories]);

  const stackId = chartType === "stacked" ? "a" : undefined;
  const hasData = rows.length > 0;
  const xLabel = "X-axis: Hour of day (24h clock)";
  const yLabel = stackedHourlyYLabel(mode);

  const yTicks = useMemo(() => {
    let max = 0;
    for (const row of data) {
      if (chartType === "stacked") {
        let sum = 0;
        for (const cat of categories) sum += Number(row[cat]) || 0;
        max = Math.max(max, sum);
      } else {
        max = Math.max(max, ...categories.map((cat) => Number(row[cat]) || 0));
      }
    }
    return milestoneTicks(max);
  }, [data, categories, chartType]);

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
      <ChartMilestoneLines theme={theme} ticks={yTicks} />
      <ChartXAxis 
        theme={theme} 
        tickSmall 
        interval={0} 
        ticks={["6 AM", "12 PM", "6 PM", "11 PM"]}
      />
      <ChartYAxis
        theme={theme}
        ticks={yTicks}
        yMax={yTicks.length ? yTicks[yTicks.length - 1] : undefined}
        width={64}
      />
    </>
  );

  const renderChart = (width: number, h: number) =>
    chartType === "line" ? (
      <LineChart width={width} height={h} data={data} margin={margin}>
        {axes}
        <Tooltip {...tooltipProps} />
        {categories.map((cat) => (
          <Line
            key={cat}
            type="monotone"
            dataKey={cat}
            name={cat}
            stroke={CATEGORY_COLORS[cat] ?? "#94a3b8"}
            strokeWidth={1.5}
            dot={false}
            {...anim}
          />
        ))}
      </LineChart>
    ) : (
      <BarChart width={width} height={h} data={data} margin={margin}>
        {axes}
        <Tooltip {...tooltipProps} />
        {categories.map((cat) => (
          <Bar
            key={cat}
            dataKey={cat}
            name={cat}
            stackId={stackId}
            fill={CATEGORY_COLORS[cat] ?? "#94a3b8"}
            radius={chartType === "stacked" ? [0, 0, 0, 0] : [2, 2, 0, 0]}
            {...anim}
          />
        ))}
      </BarChart>
    );

  return (
    <ChartPanel
      title={title ?? "Delay by hour & category"}
      subtitle={`${modeLabel(mode)} · delay minutes by incident type`}
      chartType={chartType}
      options={CHART_OPTIONS}
      onChartTypeChange={setChartType}
      compact={compact}
      fluid
      empty={!hasData}
      legend={<CustomChartLegend items={legendItems} />}
      className="explorer-chart-cell"
    >
      <ChartShell xAxisLabel={xLabel} yAxisLabel={yLabel} height={plotHeight} empty={!hasData}>
        {({ width, height }) => renderChart(width, height)}
      </ChartShell>
    </ChartPanel>
  );
}
