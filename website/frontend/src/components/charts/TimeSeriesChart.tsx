import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  type TooltipProps,
} from "recharts";
import { useTheme } from "../../context/ThemeContext";
import { showDevUI } from "../../lib/appConfig";
import { milestoneTicks } from "../../lib/chartAxisUtils";
import { fillYearSeries, shouldFillYears, yearRangeFromData } from "../../lib/chartSeriesUtils";
import { chartPalette } from "../../lib/chartColors";
import {
  CHART_ANIMATION,
  CHART_MARGIN,
  bucketAxisLabel,
  chartLegendProps,
  chartTooltipStyle,
  delayGapYLabel,
  formatBucketTick,
} from "../../lib/chartTheme";
import type { Bucket, Mode } from "../../types";
import { ChartMilestoneLines, ChartXAxis, ChartYAxis } from "./ChartAxes";
import { ChartPanel } from "./ChartPanel";
import { ChartShell } from "./ChartShell";

const CHART_HEIGHT = 340;
const CHART_HEIGHT_COMPACT = 240;

interface Point {
  bucket: string;
  delay_minutes: number;
  gap_minutes: number;
}

interface SeriesRow {
  bucket: string;
  year: string;
  label: string;
  delay_minutes: number;
  gap_minutes: number;
}

interface Props {
  data: Point[];
  title?: string;
  compact?: boolean;
  primary?: boolean;
  mode?: Mode;
  bucket?: Bucket;
  rangeStart?: string;
  rangeEnd?: string;
}

function tooltipYearLabel(bucket: Bucket, row: SeriesRow | undefined): string {
  if (!row) return "";
  if (bucket === "year") return `Year ${row.year || row.label}`;
  return row.label || row.bucket;
}

export function TimeSeriesChart({
  data,
  title,
  compact,
  primary,
  mode = "bus",
  bucket = "year",
  rangeStart = "2014",
  rangeEnd = "2026",
}: Props) {
  const { theme } = useTheme();
  const baseTooltip = chartTooltipStyle(theme);
  const legend = <Legend {...chartLegendProps(theme)} />;
  const isPrimary = primary ?? !compact;
  const plotHeight = compact ? CHART_HEIGHT_COMPACT : CHART_HEIGHT;
  const hasData = data.length > 0;
  const margin = CHART_MARGIN.withLegend;
  const anim = CHART_ANIMATION;
  const colors = chartPalette(theme);

  const formatted = useMemo(() => {
    const mapped: SeriesRow[] = data.map((d) => {
      const label = formatBucketTick(bucket, d.bucket);
      return {
        ...d,
        delay_minutes: Number(d.delay_minutes) || 0,
        gap_minutes: Number(d.gap_minutes) || 0,
        label,
        year: bucket === "year" ? label : label,
      };
    });
    if (!shouldFillYears(bucket)) return mapped;
    const parsedStart = parseInt(rangeStart.slice(0, 4), 10);
    const parsedEnd = parseInt(rangeEnd.slice(0, 4), 10);
    const fallback = yearRangeFromData(mapped);
    const start = Number.isFinite(parsedStart) ? parsedStart : fallback.start;
    const end = Number.isFinite(parsedEnd) ? parsedEnd : fallback.end;
    return fillYearSeries(mapped, start, end);
  }, [data, bucket, rangeStart, rangeEnd]);

  const xKey = bucket === "year" ? "year" : "label";

  const yTicks = useMemo(() => {
    const max = Math.max(
      0,
      ...formatted.map((d) => Math.max(d.delay_minutes, d.gap_minutes)),
    );
    return milestoneTicks(max);
  }, [formatted]);

  const yMax = yTicks.length ? yTicks[yTicks.length - 1] : undefined;
  const xLabel = bucketAxisLabel(bucket);
  const yLabel = delayGapYLabel(mode);
  const delayName = "Total delay (minutes)";
  const gapName = "Total schedule gap (minutes)";

  const tooltipLabelFormatter: TooltipProps<number, string>["labelFormatter"] = (
    _label,
    payload,
  ) => tooltipYearLabel(bucket, payload?.[0]?.payload as SeriesRow | undefined);

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
      <ChartMilestoneLines theme={theme} ticks={yTicks} />
      <ChartXAxis theme={theme} dataKey={xKey} type="category" height={48} />
      <ChartYAxis theme={theme} ticks={yTicks} yMax={yMax} width={68} />
    </>
  );

  const renderChart = (width: number, chartHeight: number) => (
    <LineChart width={width} height={chartHeight} data={formatted} margin={margin}>
      {axes}
      <Tooltip {...baseTooltip} labelFormatter={tooltipLabelFormatter} />
      {legend}
      <Line
        type="monotone"
        dataKey="delay_minutes"
        name={delayName}
        stroke={colors.primary}
        strokeWidth={2.5}
        dot={{ r: 4, fill: colors.primary, strokeWidth: 0 }}
        activeDot={{ r: 6 }}
        {...anim}
      />
      <Line
        type="monotone"
        dataKey="gap_minutes"
        name={gapName}
        stroke={colors.secondary}
        strokeWidth={2}
        strokeDasharray="6 4"
        dot={{ r: 3, fill: colors.secondary, strokeWidth: 0 }}
        {...anim}
      />
    </LineChart>
  );

  return (
    <ChartPanel
      title={title ?? "Delay minutes & gap minutes over time"}
      subtitle="Annual totals from TTC open-data delay reports (Min Delay + Min Gap)"
      badge={isPrimary && showDevUI ? "Primary" : undefined}
      compact={compact}
      primary={isPrimary}
      fluid
      empty={!hasData}
      emptyMessage={
        showDevUI
          ? "No delay data. Run: cd website && npm run ingest"
          : "No delay data matches your filters. Try a wider year range or different directions."
      }
      className="main-chart-panel chart-enter"
    >
      <ChartShell
        xAxisLabel={xLabel}
        yAxisLabel={yLabel}
        height={plotHeight}
        empty={!hasData}
        emptyMessage={
          showDevUI
            ? "No delay data. Run: cd website && npm run ingest"
            : "No delay data matches your filters."
        }
      >
        {({ width, height: h }) => renderChart(width, h)}
      </ChartShell>
    </ChartPanel>
  );
}
