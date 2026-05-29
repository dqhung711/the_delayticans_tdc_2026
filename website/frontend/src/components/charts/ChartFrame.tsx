import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Size {
  width: number;
  height: number;
}

interface Props {
  xAxisLabel: string;
  yAxisLabel: string;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  resizable?: boolean;
  fullscreenTitle?: string;
  empty?: boolean;
  emptyMessage?: string;
  children: (size: Size) => ReactNode;
}

export function ChartFrame({
  xAxisLabel,
  yAxisLabel,
  defaultHeight = 400,
  minHeight = 280,
  maxHeight = 720,
  resizable = true,
  fullscreenTitle = "Chart",
  empty,
  emptyMessage = "No data for the current filters.",
  children,
}: Props) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotHeight, setPlotHeight] = useState(defaultHeight);
  const [width, setWidth] = useState(900);
  const [fullscreen, setFullscreen] = useState(false);

  const measure = useCallback(() => {
    const el = plotRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0) setWidth(Math.floor(rect.width));
    if (rect.height > 0) setPlotHeight(Math.floor(rect.height));
  }, []);

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  const plotBody = empty ? (
    <div className="chart-frame__empty">{emptyMessage}</div>
  ) : (
    children({ width, height: plotHeight })
  );

  const frame = (tall?: boolean) => (
    <div className={`chart-frame ${tall ? "chart-frame--fullscreen" : ""}`}>
      <div className="chart-frame__plot-row">
        <div className="chart-frame__y-title" aria-hidden>
          <span>{yAxisLabel}</span>
        </div>
        <div
          ref={plotRef}
          className={`chart-frame__plot ${resizable && !tall ? "chart-frame__plot--resize" : ""}`}
          style={
            tall
              ? { height: "100%", minHeight: 360 }
              : {
                  height: plotHeight,
                  minHeight,
                  maxHeight,
                }
          }
        >
          {plotBody}
        </div>
      </div>
      <p className="chart-frame__x-title">{xAxisLabel}</p>
    </div>
  );

  return (
    <>
      <div className="chart-frame-wrap">
        {!empty && (
          <div className="chart-frame__tools">
            {resizable && <span className="chart-frame__hint">Drag corner to resize</span>}
            <button
              type="button"
              className="chart-frame__expand"
              onClick={() => setFullscreen(true)}
              aria-label="Expand chart fullscreen"
            >
              Fullscreen
            </button>
          </div>
        )}
        {frame()}
      </div>

      {fullscreen &&
        createPortal(
          <div
            className="chart-fullscreen"
            role="dialog"
            aria-modal="true"
            aria-label={fullscreenTitle}
          >
            <div className="chart-fullscreen__backdrop" onClick={() => setFullscreen(false)} />
            <div className="chart-fullscreen__panel">
              <header className="chart-fullscreen__header">
                <div>
                  <h2 className="chart-fullscreen__title">{fullscreenTitle}</h2>
                  <p className="chart-fullscreen__axes">
                    <strong>Y:</strong> {yAxisLabel}
                    <span className="chart-fullscreen__sep">·</span>
                    <strong>X:</strong> {xAxisLabel}
                  </p>
                </div>
                <button
                  type="button"
                  className="chart-fullscreen__close"
                  onClick={() => setFullscreen(false)}
                >
                  Close
                </button>
              </header>
              {frame(true)}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
