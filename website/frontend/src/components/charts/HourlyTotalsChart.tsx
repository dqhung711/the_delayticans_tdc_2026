import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
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
  chartLegendProps,
  chartTooltipStyle,
  hourlyYLabel,
  modeLabel,
} from "../../lib/chartTheme";
import type { Mode } from "../../types";
import { CustomChartLegend } from "./CustomChartLegend";
import { ChartMilestoneLines, ChartXAxis, ChartYAxis } from "./ChartAxes";
import { ChartPanel } from "./ChartPanel";
import { ChartShell } from "./ChartShell";

export type HourlyChartType = "bar" | "line" | "area";

const CHART_OPTIONS = [
  { value: "bar" as const, label: "Bar" },
  { value: "line" as const, label: "Line" },
  { value: "area" as const, label: "Area" },
];

interface Point {
  hour: number;
  delay_minutes: number;
  gap_minutes: number;
}

interface Props {
  data: Point[];
  title?: string;
  compact?: boolean;
  mode?: Mode;
}

function formatHourLabel(h: number): string {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  if (h < 12) return `${h}a`;
  return `${h - 12}p`;
}

export function HourlyTotalsChart({ data, title, compact, mode = "bus" }: Props) {
  const { theme } = useTheme();
  const [chartType, setChartType] = useState<HourlyChartType>("bar");
  const colors = chartPalette(theme);
  const tooltipProps = chartTooltipStyle(theme);
  const legend = <Legend {...chartLegendProps(theme)} />;
  const margin = CHART_MARGIN.withLegend;
  const anim = CHART_ANIMATION;
  const plotHeight = compact ? 200 : 240;

  const legendItems = [
    { label: "Delay minutes", color: colors.primary },
    { label: "Gap minutes", color: colors.secondary },
  ];

  const formatted = useMemo(() => {
    const byHour = new Map<number, Point>();
    for (let h = 0; h < 24; h += 1) {
      byHour.set(h, { hour: h, delay_minutes: 0, gap_minutes: 0 });
    }
    for (const row of data ?? []) {
      byHour.set(row.hour, {
        hour: row.hour,
        delay_minutes: Number(row.delay_minutes) || 0,
        gap_minutes: Number(row.gap_minutes) || 0,
      });
    }
    return [...byHour.values()]
      .sort((a, b) => a.hour - b.hour)
      .map((d) => ({ ...d, label: formatHourLabel(d.hour) }));
  }, [data]);

  const hasData = formatted.some((d) => d.delay_minutes > 0 || d.gap_minutes > 0);
  const xLabel = "X-axis: Hour of day (0–23, local time)";
  const yLabel = hourlyYLabel(mode);
  const yTicks = useMemo(
    () => milestoneTicks(maxOfSeries(formatted, ["delay_minutes", "gap_minutes"])),
    [formatted],
  );
  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
      <ChartMilestoneLines theme={theme} ticks={yTicks} />
      <ChartXAxis theme={theme} tickSmall interval={2} />
      <ChartYAxis
        theme={theme}
        ticks={yTicks}
        yMax={yTicks.length ? yTicks[yTicks.length - 1] : undefined}
        width={64}
      />
    </>
  );

  const renderChart = (width: number, h: number) => {
    if (chartType === "area") {
      return (
        <AreaChart width={width} height={h} data={formatted} margin={margin}>
          {axes}
          <Tooltip {...tooltipProps} />
          <Area type="monotone" dataKey="delay_minutes" name="Delay minutes" stroke={colors.primary} fill={colors.primary} fillOpacity={0.2} strokeWidth={2} {...anim} />
          <Area type="monotone" dataKey="gap_minutes" name="Gap minutes" stroke={colors.secondary} fill={colors.secondary} fillOpacity={0.1} strokeWidth={2} {...anim} />
        </AreaChart>
      );
    }
    if (chartType === "line") {
      return (
        <LineChart width={width} height={h} data={formatted} margin={margin}>
          {axes}
          <Tooltip {...tooltipProps} />
          <Line type="monotone" dataKey="delay_minutes" name="Delay minutes" stroke={colors.primary} strokeWidth={2} dot={false} {...anim} />
          <Line type="monotone" dataKey="gap_minutes" name="Gap minutes" stroke={colors.secondary} strokeWidth={2} dot={false} strokeDasharray="5 3" {...anim} />
        </LineChart>
      );
    }
    return (
      <BarChart width={width} height={h} data={formatted} margin={margin}>
        {axes}
        <Tooltip {...tooltipProps} />
        <Bar dataKey="delay_minutes" name="Delay minutes" fill={colors.primary} radius={[2, 2, 0, 0]} {...anim} />
        <Bar dataKey="gap_minutes" name="Gap minutes" fill={colors.secondary} radius={[2, 2, 0, 0]} {...anim} />
      </BarChart>
    );
  };

  return (
    <ChartPanel
      title={title ?? "Delay & gap by hour of day"}
      subtitle={`${modeLabel(mode)} · summed Min Delay & Min Gap per hour`}
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
