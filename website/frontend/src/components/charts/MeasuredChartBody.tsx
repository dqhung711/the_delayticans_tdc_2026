import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  height: number;
  empty?: boolean;
  emptyMessage?: string;
  children: (size: { width: number; height: number }) => ReactNode;
}

/** Gives Recharts explicit pixel width/height from the panel body. */
export function MeasuredChartBody({ height, empty, emptyMessage, children }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setWidth(w);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [height, empty]);

  if (empty) {
    return (
      <div className="chart-panel__empty" style={{ minHeight: height }}>
        {emptyMessage ?? "No data for the current filters."}
      </div>
    );
  }

  return (
    <div
      ref={bodyRef}
      className="chart-measure chart-measure--visible"
      style={{ width: "100%", height, minHeight: height }}
    >
      {children({ width, height })}
    </div>
  );
}
