import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
} from "recharts";
import { useTheme } from "../../context/ThemeContext";
import { milestoneTicks } from "../../lib/chartAxisUtils";
import { chartPalette } from "../../lib/chartColors";
import {
  CHART_ANIMATION,
  CATEGORY_COLORS,
  chartTooltipStyle,
  modeLabel,
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
  route: string;
  category: string;
  delay_minutes: number;
}

interface Props {
  rows: Row[];
  title?: string;
  compact?: boolean;
  mode?: Mode;
}

export function RouteStackedChart({ rows, title, compact, mode = "bus" }: Props) {
  const { theme } = useTheme();
  const [chartType, setChartType] = useState<StackedChartType>("stacked");
  const colors = chartPalette(theme);
  const tooltipProps = chartTooltipStyle(theme);
  const margin = { top: 10, right: 30, left: 10, bottom: 10 };
  const anim = CHART_ANIMATION;
  const plotHeight = compact ? 200 : 240;

  const { data, categories, routeMainCauses } = useMemo(() => {
    const cats = [...new Set((rows ?? []).map((r) => r.category))];
    const rts = [...new Set((rows ?? []).map((r) => r.route))];
    
    const byRoute = new Map<string, Record<string, number | string>>();
    const mainCauses = new Map<string, string>();

    for (const route of rts) {
      const entry: Record<string, number | string> = { route };
      let maxDelay = -1;
      let topCat = "Other";
      let total = 0;

      for (const cat of cats) {
        const row = rows.find(r => r.route === route && r.category === cat);
        const delay = row ? row.delay_minutes : 0;
        entry[cat] = delay;
        total += delay;
        if (delay > maxDelay) {
          maxDelay = delay;
          topCat = cat;
        }
      }
      entry.total_delay = total;
      entry.main_category = topCat;
      entry.display_label = `${route} (${topCat})`;
      byRoute.set(route, entry);
      mainCauses.set(route, topCat);
    }
    
    return { 
      data: [...byRoute.values()]
        .sort((a, b) => (b.total_delay as number) - (a.total_delay as number))
        .slice(0, 5), 
      categories: cats,
      routeMainCauses: mainCauses
    };
  }, [rows]);

  const legendItems = useMemo(() => {
    return categories.map(cat => ({
      label: cat,
      color: CATEGORY_COLORS[cat] ?? "#94a3b8"
    }));
  }, [categories]);

  const stackId = chartType === "stacked" ? "a" : undefined;
  const hasData = rows.length > 0;
  const xLabel = "X-axis: Delay minutes";
  const yLabel = "Y-axis: Route (Main cause)";

  const xTicks = useMemo(() => {
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

  const renderChart = (width: number, h: number) =>
    chartType === "line" ? (
      <LineChart width={width} height={h} data={data} margin={margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
        <ChartMilestoneLines theme={theme} ticks={xTicks} />
        <ChartXAxis 
          theme={theme} 
          tickSmall 
          interval={0} 
          dataKey="route"
          tickFormatter={(v) => {
            const entry = data.find(d => d.route === v);
            return entry?.display_label ? String(entry.display_label) : String(v);
          }}
        />
        <ChartYAxis
          theme={theme}
          ticks={xTicks}
          yMax={xTicks.length ? xTicks[xTicks.length - 1] : undefined}
          width={64}
        />
        <Tooltip 
          {...tooltipProps} 
          labelFormatter={(v) => {
            const entry = data.find(d => d.route === v);
            return entry?.display_label ? String(entry.display_label) : String(v);
          }}
        />
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
      <BarChart 
        width={width} 
        height={h} 
        data={data} 
        margin={margin}
        layout="vertical"
      >
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} horizontal={false} />
        <ChartXAxis 
          theme={theme} 
          type="number"
          tickSmall 
          ticks={xTicks}
          domain={[0, xTicks[xTicks.length - 1] || "auto"]}
        />
        <ChartYAxis
          theme={theme}
          type="category"
          dataKey="route"
          width={140}
          tickFormatter={(v) => {
            const entry = data.find(d => d.route === v);
            return entry?.display_label ? String(entry.display_label) : String(v);
          }}
        />
        <Tooltip 
          {...tooltipProps} 
          labelFormatter={(v) => {
            const entry = data.find(d => d.route === v);
            return entry?.display_label ? String(entry.display_label) : String(v);
          }}
        />
        {categories.map((cat) => (
          <Bar
            key={cat}
            dataKey={cat}
            name={cat}
            stackId="a"
            fill={CATEGORY_COLORS[cat] ?? "#94a3b8"}
            radius={[0, 0, 0, 0]}
            {...anim}
          />
        ))}
      </BarChart>
    );

  return (
    <ChartPanel
      title={title ?? "Top 5 most delayed routes"}
      subtitle={`${modeLabel(mode)} · total delay minutes with primary incident cause`}
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
