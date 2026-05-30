import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  ReferenceArea,
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
import { CustomChartLegend } from "./CustomChartLegend";
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
  timestamp: number;
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
  const isPrimary = primary ?? !compact;
  const plotHeight = compact ? CHART_HEIGHT_COMPACT : CHART_HEIGHT;
  const margin = { top: 10, right: 30, left: 10, bottom: 10 };
  const anim = CHART_ANIMATION;
  const colors = chartPalette(theme);
  const legendItems = [
    { label: "Delay min", color: colors.primary },
    { label: "Gap min", color: colors.secondary, dashed: true },
  ];

  const formatted = useMemo(() => {
    const raw = (data ?? []).map((d) => {
      const label = formatBucketTick(bucket, d.bucket);
      let timestamp = 0;
      try {
        if (bucket === "year") {
          timestamp = new Date(`${d.bucket}-01-01T00:00:00`).getTime();
        } else if (bucket === "month") {
          timestamp = new Date(`${d.bucket}-01T00:00:00`).getTime();
        } else if (bucket === "day") {
          timestamp = new Date(`${d.bucket}T00:00:00`).getTime();
        } else {
          // YYYY-MM-DD HH:00
          const iso = d.bucket.includes(" ") 
            ? d.bucket.replace(" ", "T") + ":00"
            : d.bucket.includes("T") ? d.bucket : `${d.bucket}T00:00:00`;
          timestamp = new Date(iso).getTime();
        }
      } catch (e) {
        timestamp = 0;
      }
      if (isNaN(timestamp)) timestamp = 0;

      return {
        ...d,
        timestamp,
        delay_minutes: Number(d.delay_minutes) || 0,
        gap_minutes: Number(d.gap_minutes) || 0,
        label,
        year: bucket === "year" ? label : label,
      };
    });

    if (shouldFillYears(bucket)) {
      const parsedStart = parseInt(rangeStart.slice(0, 4), 10);
      const parsedEnd = parseInt(rangeEnd.slice(0, 4), 10);
      const fallback = yearRangeFromData(raw);
      const start = Number.isFinite(parsedStart) ? parsedStart : fallback.start;
      const end = Number.isFinite(parsedEnd) ? parsedEnd : fallback.end;
      return fillYearSeries(raw, start, end).map(d => ({
        ...d,
        timestamp: new Date(`${d.bucket}-01-01T00:00:00`).getTime(),
        label: formatBucketTick("year", d.bucket),
        year: formatBucketTick("year", d.bucket)
      }));
    }

    return raw.sort((a, b) => a.timestamp - b.timestamp);
  }, [data, bucket, rangeStart, rangeEnd]);

  const hasData = formatted.length > 0;

  const yTicks = useMemo(() => {
    if (!hasData) return milestoneTicks(0);
    const max = Math.max(
      0,
      ...formatted.map((d) => Math.max(d.delay_minutes, d.gap_minutes)),
    );
    return milestoneTicks(max);
  }, [formatted, hasData]);

  const xTicks = useMemo(() => {
    if (!hasData) return [];
    const start = formatted[0].timestamp;
    const end = formatted[formatted.length - 1].timestamp;
    const diff = end - start;

    const ticks: number[] = [];
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    const oneMonth = 30 * oneDay;
    const oneYear = 365 * oneDay;

    if (diff <= oneDay * 2) {
      for (let t = start; t <= end; t += 4 * oneHour) ticks.push(t);
    } else if (diff <= oneDay * 14) {
      for (let t = start; t <= end; t += oneDay) ticks.push(t);
    } else if (diff <= oneMonth * 6) {
      for (let t = start; t <= end; t += 14 * oneDay) ticks.push(t);
    } else if (diff <= oneYear * 2) {
      for (let t = start; t <= end; t += oneMonth) ticks.push(t);
    } else {
      for (let t = start; t <= end; t += oneYear) ticks.push(t);
    }
    return ticks;
  }, [formatted, hasData]);

  const formatXAxis = (ts: number) => {
    const d = new Date(ts);
    const start = formatted[0]?.timestamp || 0;
    const end = formatted[formatted.length - 1]?.timestamp || 0;
    const diff = end - start;

    const oneDay = 24 * 60 * 60 * 1000;
    const oneMonth = 30 * oneDay;

    if (diff <= oneDay * 2) {
      return d.toLocaleTimeString([], { hour: 'numeric', hour12: true });
    }
    if (diff <= oneMonth * 3) {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    if (diff <= oneMonth * 24) {
      return d.toLocaleDateString([], { month: 'short', year: '2-digit' });
    }
    return d.getFullYear().toString();
  };

  const yMax = yTicks.length ? yTicks[yTicks.length - 1] : undefined;
  const xLabel = bucketAxisLabel(bucket);
  const yLabel = delayGapYLabel(mode);
  const delayName = "Total delay (minutes)";
  const gapName = "Total schedule gap (minutes)";

  const tooltipLabelFormatter: TooltipProps<number, string>["labelFormatter"] = (
    _label,
    payload,
  ) => tooltipYearLabel(bucket, payload?.[0]?.payload as SeriesRow | undefined);

  const renderChart = (width: number, chartHeight: number) => (
    <LineChart width={width} height={chartHeight} data={formatted} margin={margin}>
      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
      <ChartMilestoneLines theme={theme} ticks={yTicks} />
      <ChartXAxis 
        theme={theme} 
        dataKey="timestamp" 
        type="number" 
        height={48} 
        domain={['dataMin', 'dataMax']}
        ticks={xTicks}
        tickFormatter={formatXAxis}
      />
      <ChartYAxis theme={theme} ticks={yTicks} yMax={yMax} width={68} />
      {((bucket === "year" && formatted.some(d => d.bucket === "2020")) || 
        (bucket === "month" && formatted.some(d => d.bucket.startsWith("2020")))) && (
        <ReferenceArea 
          x1={new Date("2020-01-01T00:00:00").getTime()} 
          x2={new Date("2020-12-31T23:59:59").getTime()} 
          fill="rgba(220, 38, 38, 0.05)" 
          label={{ position: 'top', value: 'COVID', fill: '#dc2626', fontSize: 10, fontWeight: 700 }}
        />
      )}
      <Tooltip {...baseTooltip} labelFormatter={tooltipLabelFormatter} />
      <Line
        type="monotone"
        dataKey="delay_minutes"
        name={delayName}
        stroke={colors.primary}
        strokeWidth={2.5}
        dot={(props: any) => {
          const { cx, cy, payload } = props;
          const isMax = payload.delay_minutes === Math.max(...formatted.map(d => d.delay_minutes));
          if (isMax && formatted.length > 1) {
            return (
              <g key={`dot-${payload.bucket}`}>
                <circle cx={cx} cy={cy} r={4} fill={colors.primary} />
                <text 
                  x={cx} 
                  y={cy - 10} 
                  textAnchor="middle" 
                  fontSize={10} 
                  fontWeight={700} 
                  fill={colors.primary}
                >
                  {payload.label.split(' ')[0]} peak
                </text>
              </g>
            );
          }
          return <circle key={`dot-${payload.bucket}`} cx={cx} cy={cy} r={3} fill={colors.primary} strokeWidth={0} />;
        }}
        activeDot={{ r: 5 }}
        {...anim}
      />
      <Line
        type="monotone"
        dataKey="gap_minutes"
        name={gapName}
        stroke={colors.secondary}
        strokeWidth={2}
        strokeDasharray="4 4"
        dot={false}
        {...anim}
      />
    </LineChart>
  );

  const dynamicTitle = useMemo(() => {
    if (title) return title;
    const range = rangeStart === rangeEnd ? rangeStart : `${rangeStart}–${rangeEnd}`;
    return `Delay & gap minutes · ${range}`;
  }, [title, rangeStart, rangeEnd]);

  const dynamicSubtitle = useMemo(() => {
    return `${bucket.charAt(0).toUpperCase() + bucket.slice(1)}ly breakdown · auto`;
  }, [bucket]);

  return (
    <ChartPanel
      title={dynamicTitle}
      subtitle={dynamicSubtitle}
      badge={isPrimary && showDevUI ? "Primary" : undefined}
      compact={compact}
      primary={isPrimary}
      fluid
      empty={!hasData}
      legend={<CustomChartLegend items={legendItems} />}
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
