import type { Theme } from "../context/ThemeContext";
import { chartPalette } from "./chartColors";
import type { Bucket } from "../types";

export function chartTick(theme: Theme) {
  return { fill: chartPalette(theme).tick, fontSize: 11 };
}

export function chartTickSmall(theme: Theme) {
  return { fill: chartPalette(theme).tick, fontSize: 10 };
}

export function chartTooltipStyle(theme: Theme) {
  const p = chartPalette(theme);
  return {
    contentStyle: {
      background: p.tooltipBg,
      border: `1px solid ${p.tooltipBorder}`,
      borderRadius: "8px",
      color: p.tooltipText,
      fontSize: "12px",
    },
    labelStyle: { color: p.tooltipText, fontWeight: 600 },
    itemStyle: { color: p.tick },
  };
}

export const CATEGORY_COLORS: Record<string, string> = {
  "Operator div.": "#e53935",
  Mechanical: "#5b8def",
  Traffic: "#f59e0b",
  Passenger: "#fb923c",
  Other: "#94a3b8",
};

/** Margins — axis titles sit outside the plot in ChartFrame */
export const CHART_MARGIN = {
  default: { top: 16, right: 20, left: 4, bottom: 12 },
  withLegend: { top: 16, right: 24, left: 4, bottom: 52 },
  horizontalBar: { top: 12, right: 24, left: 4, bottom: 12 },
  categoryVertical: { top: 16, right: 16, left: 4, bottom: 64 },
  categoryHorizontal: { top: 12, right: 28, left: 4, bottom: 12 },
};

export const CHART_ANIMATION = {
  isAnimationActive: true,
  animationDuration: 600,
  animationEasing: "ease-out" as const,
};

export function chartLegendProps(theme: Theme) {
  const p = chartPalette(theme);
  return {
    verticalAlign: "bottom" as const,
    align: "center" as const,
    iconType: "line" as const,
    iconSize: 10,
    wrapperStyle: {
      fontSize: "11px",
      color: p.tick,
      paddingTop: "4px",
    },
  };
}

export function bucketAxisLabel(bucket: Bucket | string): string {
  switch (bucket) {
    case "hour":
      return "X-axis: Date & hour of report";
    case "day":
      return "X-axis: Calendar date";
    case "month":
      return "X-axis: Month (YYYY-MM)";
    case "year":
    default:
      return "X-axis: Year";
  }
}

export function modeLabel(mode: string): string {
  return mode === "bus" ? "Bus" : mode === "streetcar" ? "Streetcar" : "TTC";
}

export function delayGapYLabel(mode: string): string {
  return `Y-axis: Total minutes (${modeLabel(mode)} — delay & gap)`;
}

export function hourlyYLabel(mode: string): string {
  return `Y-axis: Minutes (${modeLabel(mode)} delay & gap)`;
}

export function categoryYLabel(mode: string): string {
  return `Y-axis: Total delay minutes (${modeLabel(mode)})`;
}

export function stackedHourlyYLabel(mode: string): string {
  return `Y-axis: Delay minutes by category (${modeLabel(mode)})`;
}

export function formatBucketTick(bucket: Bucket | string, raw: string): string {
  if (!raw) return "";
  switch (bucket) {
    case "year":
      return raw.slice(0, 4);
    case "month": {
      const m = raw.match(/^(\d{4})-(\d{2})/);
      if (m) {
        const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${names[parseInt(m[2], 10) - 1]} ${m[1]}`;
      }
      return raw.slice(0, 7);
    }
    case "day":
      return raw.slice(0, 10);
    case "hour":
      if (raw.length >= 13) return raw.slice(11, 16);
      return raw;
    default:
      return raw.length > 12 ? raw.slice(0, 12) : raw;
  }
}

