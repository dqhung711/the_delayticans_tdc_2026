import { useMemo } from "react";
import { Cell, Legend, Pie, PieChart, Tooltip } from "recharts";
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

export function CategoryChart({ data, title, compact, mode = "bus" }: Props) {
  const { theme } = useTheme();
  const colors = chartPalette(theme);
  const tooltipProps = chartTooltipStyle(theme);
  const plotHeight = compact ? PLOT_HEIGHT_COMPACT : PLOT_HEIGHT;

  const enriched = useMemo(() => {
    const sorted = [...data]
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

  const renderChart = (width: number, h: number) => (
    <PieChart width={width} height={h}>
      <Pie
        data={enriched}
        dataKey="delay_minutes"
        nameKey="category"
        cx="50%"
        cy="44%"
        innerRadius={compact ? 48 : 62}
        outerRadius={compact ? 78 : 96}
        paddingAngle={2}
        label={({ category, pct }) => `${category} (${pct}%)`}
        labelLine={{ stroke: colors.tick }}
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
      <Legend {...chartLegendProps(theme)} formatter={(value) => String(value)} />
    </PieChart>
  );

  return (
    <ChartPanel
      title={title ?? "Delay by reason (incident category)"}
      subtitle={`${modeLabel(mode)} · Operator, Traffic, Mechanical, Passenger, Other`}
      compact={compact}
      fluid
      empty={!enriched.length}
      emptyMessage="No categorized delay data for the current filters."
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
