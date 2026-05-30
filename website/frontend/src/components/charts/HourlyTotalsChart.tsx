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
  hour?: number;
  day?: number;
  delay_minutes: number;
  gap_minutes: number;
}

interface Props {
  data: Point[];
  dailyData?: Point[];
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

function formatDayLabel(d: number): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[d] ?? "";
}

export function HourlyTotalsChart({
  data,
  dailyData,
  title,
  compact,
  mode = "bus",
}: Props) {
  const { theme } = useTheme();
  const [chartType, setChartType] = useState<HourlyChartType>("bar");
  const [aggType, setAggType] = useState<"hour" | "day">("hour");
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
    if (aggType === "hour") {
      const byHour = new Map<number, Point>();
      for (let h = 0; h < 24; h += 1) {
        byHour.set(h, { hour: h, delay_minutes: 0, gap_minutes: 0 });
      }
      for (const row of data ?? []) {
        if (row.hour !== undefined) {
          byHour.set(row.hour, {
            hour: row.hour,
            delay_minutes: Number(row.delay_minutes) || 0,
            gap_minutes: Number(row.gap_minutes) || 0,
          });
        }
      }
      return [...byHour.values()]
        .sort((a, b) => (a.hour ?? 0) - (b.hour ?? 0))
        .map((d) => ({ ...d, label: formatHourLabel(d.hour ?? 0) }));
    } else {
      const byDay = new Map<number, Point>();
      for (let d = 0; d < 7; d += 1) {
        byDay.set(d, { day: d, delay_minutes: 0, gap_minutes: 0 });
      }
      for (const row of dailyData ?? []) {
        if (row.day !== undefined) {
          byDay.set(row.day, {
            day: row.day,
            delay_minutes: Number(row.delay_minutes) || 0,
            gap_minutes: Number(row.gap_minutes) || 0,
          });
        }
      }
      return [...byDay.values()]
        .sort((a, b) => (a.day ?? 0) - (b.day ?? 0))
        .map((d) => ({ ...d, label: formatDayLabel(d.day ?? 0) }));
    }
  }, [data, dailyData, aggType]);

  const hasData = formatted.some((d) => d.delay_minutes > 0 || d.gap_minutes > 0);
  const xLabel =
    aggType === "hour"
      ? "X-axis: Hour of day (0–23, local time)"
      : "X-axis: Day of week (Sun–Sat)";
  const yLabel = hourlyYLabel(mode);
  const yTicks = useMemo(
    () => milestoneTicks(maxOfSeries(formatted, ["delay_minutes", "gap_minutes"])),
    [formatted],
  );
  const renderChart = (width: number, h: number) => {
    if (chartType === "area") {
      return (
        <AreaChart width={width} height={h} data={formatted} margin={margin}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
          <ChartMilestoneLines theme={theme} ticks={yTicks} />
          <ChartXAxis theme={theme} tickSmall interval={aggType === "hour" ? 2 : 0} />
          <ChartYAxis
            theme={theme}
            ticks={yTicks}
            yMax={yTicks.length ? yTicks[yTicks.length - 1] : undefined}
            width={64}
          />
          <Tooltip {...tooltipProps} />
          <Area
            type="monotone"
            dataKey="delay_minutes"
            name="Delay minutes"
            stroke={colors.primary}
            fill={colors.primary}
            fillOpacity={0.2}
            strokeWidth={2}
            {...anim}
          />
          <Area
            type="monotone"
            dataKey="gap_minutes"
            name="Gap minutes"
            stroke={colors.secondary}
            fill={colors.secondary}
            fillOpacity={0.1}
            strokeWidth={2}
            {...anim}
          />
        </AreaChart>
      );
    }
    if (chartType === "line") {
      return (
        <LineChart width={width} height={h} data={formatted} margin={margin}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
          <ChartMilestoneLines theme={theme} ticks={yTicks} />
          <ChartXAxis theme={theme} tickSmall interval={aggType === "hour" ? 2 : 0} />
          <ChartYAxis
            theme={theme}
            ticks={yTicks}
            yMax={yTicks.length ? yTicks[yTicks.length - 1] : undefined}
            width={64}
          />
          <Tooltip {...tooltipProps} />
          <Line
            type="monotone"
            dataKey="delay_minutes"
            name="Delay minutes"
            stroke={colors.primary}
            strokeWidth={2}
            dot={false}
            {...anim}
          />
          <Line
            type="monotone"
            dataKey="gap_minutes"
            name="Gap minutes"
            stroke={colors.secondary}
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 3"
            {...anim}
          />
        </LineChart>
      );
    }
    return (
      <BarChart width={width} height={h} data={formatted} margin={margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
        <ChartMilestoneLines theme={theme} ticks={yTicks} />
        <ChartXAxis theme={theme} tickSmall interval={aggType === "hour" ? 2 : 0} />
        <ChartYAxis
          theme={theme}
          ticks={yTicks}
          yMax={yTicks.length ? yTicks[yTicks.length - 1] : undefined}
          width={64}
        />
        <Tooltip {...tooltipProps} />
        <Bar
          dataKey="delay_minutes"
          name="Delay minutes"
          fill={colors.primary}
          radius={[2, 2, 0, 0]}
          {...anim}
        />
        <Bar
          dataKey="gap_minutes"
          name="Gap minutes"
          fill={colors.secondary}
          radius={[2, 2, 0, 0]}
          {...anim}
        />
      </BarChart>
    );
  };

  const AGG_OPTIONS = [
    { value: "hour" as const, label: "Hour" },
    { value: "day" as const, label: "Day" },
  ];

  return (
    <ChartPanel
      title={aggType === "hour" ? "Delay / Gap (by hour)" : "Delay / Gap (by day)"}
      subtitle={`${modeLabel(mode)} · summed Min Delay & Min Gap per ${aggType}`}
      chartType={chartType}
      options={CHART_OPTIONS}
      onChartTypeChange={setChartType}
      aggType={aggType}
      aggOptions={AGG_OPTIONS}
      onAggTypeChange={setAggType}
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
