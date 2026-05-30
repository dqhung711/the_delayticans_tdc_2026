import type { ReactNode } from "react";
import { ChartTypeSelect, type SelectOption } from "./ChartTypeSelect";

interface Props<T extends string, A extends string = string> {
  title: string;
  subtitle?: string;
  badge?: string;
  chartType?: T;
  options?: SelectOption<T>[];
  onChartTypeChange?: (value: T) => void;
  aggType?: A;
  aggOptions?: SelectOption<A>[];
  onAggTypeChange?: (value: A) => void;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
  height?: number;
  compact?: boolean;
  primary?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  fluid?: boolean;
}

export function ChartPanel<T extends string, A extends string = string>({
  title,
  subtitle,
  badge,
  chartType,
  options,
  onChartTypeChange,
  aggType,
  aggOptions,
  onAggTypeChange,
  legend,
  children,
  className = "",
  height,
  compact,
  primary,
  empty,
  emptyMessage = "No data for the current filters. Adjust the time range or directions.",
  fluid,
}: Props<T, A>) {
  const chartHeight = height ?? (compact ? 240 : primary ? 380 : 280);

  return (
    <section
      className={`chart-panel ${primary ? "chart-panel--primary" : ""} ${fluid ? "chart-panel--fluid" : ""} ${className}`}
    >
      <header className="chart-panel__header">
        <div className="chart-panel__title-row">
          <div className="chart-panel__titles">
            {badge && <span className="chart-panel__badge">{badge}</span>}
            <h3 className="chart-panel__title">{title}</h3>
            {subtitle && <p className="chart-panel__subtitle">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {aggType && aggOptions && onAggTypeChange && (
              <ChartTypeSelect
                value={aggType}
                options={aggOptions}
                onChange={onAggTypeChange}
                ariaLabel={`${title} aggregation type`}
              />
            )}
            {chartType && options && onChartTypeChange && (
              <ChartTypeSelect
                value={chartType}
                options={options}
                onChange={onChartTypeChange}
                ariaLabel={`${title} visualization type`}
              />
            )}
          </div>
        </div>
        {legend && <div className="chart-panel__legend">{legend}</div>}
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
