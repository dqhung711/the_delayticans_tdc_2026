import type { ReactNode } from "react";
import { ChartTypeSelect, type SelectOption } from "./ChartTypeSelect";

interface Props<T extends string> {
  title: string;
  subtitle?: string;
  badge?: string;
  chartType?: T;
  options?: SelectOption<T>[];
  onChartTypeChange?: (value: T) => void;
  children: ReactNode;
  className?: string;
  height?: number;
  compact?: boolean;
  primary?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  fluid?: boolean;
}

export function ChartPanel<T extends string>({
  title,
  subtitle,
  badge,
  chartType,
  options,
  onChartTypeChange,
  children,
  className = "",
  height,
  compact,
  primary,
  empty,
  emptyMessage = "No data for the current filters. Adjust the time range or directions.",
  fluid,
}: Props<T>) {
  const chartHeight = height ?? (compact ? 240 : primary ? 380 : 280);

  return (
    <section
      className={`chart-panel ${primary ? "chart-panel--primary" : ""} ${fluid ? "chart-panel--fluid" : ""} ${className}`}
    >
      <header className="chart-panel__header">
        <div className="chart-panel__titles">
          {badge && <span className="chart-panel__badge">{badge}</span>}
          <h3 className="chart-panel__title">{title}</h3>
          {subtitle && <p className="chart-panel__subtitle">{subtitle}</p>}
        </div>
        {chartType && options && onChartTypeChange && (
          <ChartTypeSelect
            value={chartType}
            options={options}
            onChange={onChartTypeChange}
            ariaLabel={`${title} visualization type`}
          />
        )}
      </header>
      <div
        className="chart-panel__body"
        style={fluid ? undefined : { height: chartHeight, minHeight: chartHeight }}
      >
        {empty ? (
          <div className="chart-panel__empty" style={{ minHeight: chartHeight }}>
            {emptyMessage}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
