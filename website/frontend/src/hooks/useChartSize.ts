import { useLayoutEffect, useRef, useState } from "react";

const DEFAULT_WIDTH = 960;

/** Measure container width so Recharts gets explicit pixel dimensions. */
export function useChartSize(height: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const w = el.getBoundingClientRect().width;
      setWidth(w > 0 ? Math.floor(w) : DEFAULT_WIDTH);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [height]);

  return { ref, width, height, ready: true };
}
