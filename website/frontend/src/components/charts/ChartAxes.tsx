import { ReferenceLine, XAxis, YAxis } from "recharts";
import type { Theme } from "../../context/ThemeContext";
import { formatDelayTick } from "../../lib/chartAxisUtils";
import { chartPalette } from "../../lib/chartColors";
import { chartTick, chartTickSmall } from "../../lib/chartTheme";

interface XProps {
  theme: Theme;
  dataKey?: string;
  type?: "category" | "number";
  tickSmall?: boolean;
  interval?: number | "preserveStartEnd";
  angle?: number;
  textAnchor?: "end" | "middle" | "start";
  height?: number;
  tickFormatter?: (v: string) => string;
  ticks?: Array<string | number>;
}

interface YProps {
  theme: Theme;
  width?: number;
  type?: "category" | "number";
  dataKey?: string;
  tickFormatter?: (v: number) => string;
  ticks?: number[];
  yMax?: number;
}

interface MilestoneLinesProps {
  theme: Theme;
  ticks: number[];
}

export function ChartXAxis({
  theme,
  dataKey = "label",
  type,
  tickSmall,
  interval = 0,
  angle,
  textAnchor,
  height,
  tickFormatter,
  ticks,
}: XProps) {
  const p = chartPalette(theme);
  const tick = { 
    ...(tickSmall ? chartTickSmall(theme) : chartTick(theme)), 
    fill: p.tick,
    fontSize: 10,
    fontWeight: 500
  };
  return (
    <XAxis
      dataKey={dataKey}
      type={type}
      tick={tick}
      ticks={ticks}
      interval={ticks ? 0 : interval}
      minTickGap={0}
      angle={angle}
      textAnchor={textAnchor ?? "middle"}
      height={height ?? 40}
      tickFormatter={tickFormatter}
      tickLine={{ stroke: p.grid, strokeWidth: 1 }}
      axisLine={{ stroke: p.grid, strokeWidth: 1 }}
      dy={8}
    />
  );
}

export function ChartYAxis({
  theme,
  width = 56,
  type,
  dataKey,
  tickFormatter = formatDelayTick,
  ticks,
  yMax,
}: YProps) {
  const p = chartPalette(theme);
  const tick = { 
    ...chartTick(theme), 
    fill: p.tick,
    fontSize: 10,
    fontWeight: 500
  };
  const top = yMax ?? (ticks?.length ? ticks[ticks.length - 1] : undefined);

  return (
    <YAxis
      type={type}
      dataKey={dataKey}
      tick={tick}
      width={width}
      ticks={ticks}
      domain={top != null ? [0, top] : [0, "auto"]}
      allowDecimals={false}
      tickFormatter={tickFormatter}
      tickLine={{ stroke: p.grid, strokeWidth: 1 }}
      axisLine={{ stroke: p.grid, strokeWidth: 1 }}
      dx={-4}
    />
  );
}

export function ChartMilestoneLines({ theme, ticks }: MilestoneLinesProps) {
  const stroke = chartPalette(theme).grid;
  return (
    <>
      {ticks
        .filter((t) => t > 0)
        .map((t) => (
          <ReferenceLine
            key={t}
            y={t}
            stroke={stroke}
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
          />
        ))}
    </>
  );
}
