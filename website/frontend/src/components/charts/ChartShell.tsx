import type { ReactNode } from "react";
import { MeasuredChartBody } from "./MeasuredChartBody";

interface Props {
  xAxisLabel: string;
  yAxisLabel: string;
  height: number;
  empty?: boolean;
  emptyMessage?: string;
  children: (size: { width: number; height: number }) => ReactNode;
}

/** Fixed-size chart area with X/Y labels — not resizable */
export function ChartShell({
  xAxisLabel,
  yAxisLabel,
  height,
  empty,
  emptyMessage,
  children,
}: Props) {
  if (empty) {
    return (
      <div className="chart-shell">
        <div className="chart-shell__empty" style={{ minHeight: height }}>
          {emptyMessage ?? "No data for the current filters."}
        </div>
      </div>
    );
  }

  return (
    <div className="chart-shell">
      <div className="chart-shell__row">
        <p className="chart-shell__y-label">{yAxisLabel}</p>
        <div className="chart-shell__plot">
          <MeasuredChartBody height={height}>{children}</MeasuredChartBody>
        </div>
      </div>
      <p className="chart-shell__x-label">{xAxisLabel}</p>
    </div>
  );
}
