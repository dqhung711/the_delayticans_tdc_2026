import { useMemo, useState } from "react";
import { Cell, Legend, Pie, PieChart, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { useTheme } from "../../context/ThemeContext";
import { chartPalette } from "../../lib/chartColors";
import {
  CATEGORY_COLORS,
  categoryYLabel,
  chartLegendProps,
  chartTooltipStyle,
  modeLabel,
} from "../../lib/chartTheme";
import type { Mode } from "../../types";
import { CustomChartLegend } from "./CustomChartLegend";
import { ChartPanel } from "./ChartPanel";
import { ChartShell } from "./ChartShell";

interface Item {
  category: string;
  delay_minutes: number;
  incidents: number;
}

interface Props {
  data: Item[];
  title?: string;
  compact?: boolean;
  mode?: Mode;
}

const PLOT_HEIGHT = 300;
const PLOT_HEIGHT_COMPACT = 240;

const CHART_OPTIONS = [
  { value: "bar" as const, label: "Bar" },
  { value: "pie" as const, label: "Pie" },
];

export function CategoryChart({ data, title, compact, mode = "bus" }: Props) {
  const { theme } = useTheme();
  const [chartType, setChartType] = useState<"bar" | "pie">("pie");
  const colors = chartPalette(theme);
  const tooltipProps = chartTooltipStyle(theme);
  const plotHeight = compact ? PLOT_HEIGHT_COMPACT : PLOT_HEIGHT;

  const legendItems = useMemo(() => {
    const sorted = [...(data ?? [])]
      .filter((d) => Number(d.delay_minutes) > 0)
      .sort((a, b) => b.delay_minutes - a.delay_minutes)
      .slice(0, 5);
    return sorted.map(d => ({
      label: d.category,
      color: CATEGORY_COLORS[d.category] ?? "#94a3b8"
    }));
  }, [data]);

  const enriched = useMemo(() => {
    const sorted = [...(data ?? [])]
      .map((d) => ({
        ...d,
        delay_minutes: Number(d.delay_minutes) || 0,
        incidents: Number(d.incidents) || 0,
      }))
      .filter((d) => d.delay_minutes > 0)
      .sort((a, b) => b.delay_minutes - a.delay_minutes);
    const total = sorted.reduce((sum, d) => sum + d.delay_minutes, 0) || 1;
    return sorted.map((d) => ({
      ...d,
      pct: Math.round((d.delay_minutes / total) * 100),
    }));
  }, [data]);

  const renderChart = (width: number, h: number) => {
    if (chartType === "bar") {
      return (
        <BarChart width={width} height={h} data={enriched} layout="vertical" margin={{ left: 20, right: 40, top: 10, bottom: 10 }}>
          <XAxis type="number" hide />
          <YAxis 
            dataKey="category" 
            type="category" 
            width={100} 
            tick={{ fontSize: 11, fill: colors.tick }} 
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            {...tooltipProps}
            formatter={(value: number) => [`${value.toLocaleString()} min`, "Delay"]}
          />
          <Bar dataKey="delay_minutes" radius={[0, 4, 4, 0]}>
            {enriched.map((entry) => (
              <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? "#94a3b8"} />
            ))}
          </Bar>
        </BarChart>
      );
    }
    return (
      <PieChart width={width} height={h}>
        <Pie
          data={enriched}
          dataKey="delay_minutes"
          nameKey="category"
          cx="50%"
          cy="50%"
          innerRadius={compact ? 48 : 70}
          outerRadius={compact ? 78 : 100}
          paddingAngle={2}
          label={false}
        >
          {enriched.map((entry) => (
            <Cell
              key={entry.category}
              fill={CATEGORY_COLORS[entry.category] ?? "#94a3b8"}
            />
          ))}
        </Pie>
        <Tooltip
          {...tooltipProps}
          formatter={(value: number, _name, item) => {
            const row = item?.payload as Item & { pct?: number };
            return [
              `${Number(value).toLocaleString()} min (${row?.pct ?? 0}%)`,
              "Delay",
            ];
          }}
        />
      </PieChart>
    );
  };

  return (
    <ChartPanel
      title={title ?? "Delay by event category"}
      subtitle={`${modeLabel(mode)} · Operator, Traffic, Mechanical, Passenger, Other`}
      chartType={chartType}
      options={CHART_OPTIONS}
      onChartTypeChange={setChartType}
      compact={compact}
      fluid
      empty={!enriched.length}
      emptyMessage="No categorized delay data for the current filters."
      legend={<CustomChartLegend items={legendItems} />}
      className="explorer-chart-cell"
    >
      <ChartShell
        xAxisLabel="Share of total delay minutes by incident reason"
        yAxisLabel={categoryYLabel(mode)}
        height={plotHeight}
        empty={!enriched.length}
      >
        {({ width, height }) => renderChart(width, height)}
      </ChartShell>
    </ChartPanel>
  );
}
