import type {
  Bucket,
  CompareInterval,
  Direction,
  Granularity,
  Mode,
  ViewMode,
} from "../types";

interface FilterBarProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  timeToggle: "year" | "date";
  onTimeToggleChange: (t: "year" | "date") => void;
  start: string;
  end: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  directions: Direction[];
  onDirectionsChange: (d: Direction[]) => void;
  bucket: Bucket;
  onBucketChange: (b: Bucket) => void;
  routes: string[];
  onRoutesChange: (r: string[]) => void;
  availableRoutes: Array<{ route: string; incidents: number }>;
  compareIntervals: CompareInterval[];
  onCompareIntervalsChange: (intervals: CompareInterval[]) => void;
  mode: Mode;
}

const DIRECTIONS: Direction[] = ["EB", "WB", "NB", "SB"];

export function FilterBar({
  view,
  onViewChange,
  granularity,
  onGranularityChange,
  timeToggle,
  onTimeToggleChange,
  start,
  end,
  onStartChange,
  onEndChange,
  directions,
  onDirectionsChange,
  bucket,
  onBucketChange,
  routes,
  onRoutesChange,
  availableRoutes,
  compareIntervals,
  onCompareIntervalsChange,
}: FilterBarProps) {
  const toggleDirection = (dir: Direction) => {
    if (directions.includes(dir)) {
      onDirectionsChange(directions.filter((d) => d !== dir));
    } else {
      onDirectionsChange([...directions, dir]);
    }
  };

  const addCompareInterval = () => {
    if (compareIntervals.length >= 10) return;
    onCompareIntervalsChange([
      ...compareIntervals,
      {
        id: crypto.randomUUID(),
        start,
        end,
        label: `Period ${compareIntervals.length + 1}`,
      },
    ]);
  };

  return (
    <div className="filter-panel page-enter mb-4">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <p className="filter-panel__label">Analysis mode</p>
          <div className="segmented-control">
            {(["overview", "compare"] as ViewMode[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onViewChange(v)}
                className={`segmented-control__btn capitalize ${
                  view === v ? "segmented-control__btn--active" : ""
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-[280px]">
          <p className="filter-panel__label">Time range</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="segmented-control">
              {(["year", "date"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    onTimeToggleChange(t);
                    onGranularityChange(
                      t === "year" ? "year" : granularity === "year" ? "date" : granularity,
                    );
                  }}
                  className={`segmented-control__btn capitalize ${
                    timeToggle === t ? "segmented-control__btn--active" : ""
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <select
              value={granularity}
              onChange={(e) => onGranularityChange(e.target.value as Granularity)}
              className="filter-input"
            >
              <option value="year">By year</option>
              <option value="month">By month</option>
              <option value="date">By date</option>
              <option value="datetime">By datetime</option>
              <option value="quarter">By quarter</option>
            </select>

            <input
              type={
                granularity === "datetime"
                  ? "datetime-local"
                  : granularity === "month"
                    ? "month"
                    : granularity === "quarter"
                      ? "text"
                      : granularity === "date"
                        ? "date"
                        : "number"
              }
              placeholder={granularity === "quarter" ? "2018-Q1" : undefined}
              value={start}
              onChange={(e) => onStartChange(e.target.value)}
              className="filter-input"
              min={timeToggle === "year" ? 2014 : undefined}
              max={timeToggle === "year" ? 2026 : undefined}
            />
            <span className="text-xs text-[var(--muted)]">→</span>
            <input
              type={
                granularity === "datetime"
                  ? "datetime-local"
                  : granularity === "month"
                    ? "month"
                    : granularity === "quarter"
                      ? "text"
                      : granularity === "date"
                        ? "date"
                        : "number"
              }
              placeholder={granularity === "quarter" ? "2020-Q2" : undefined}
              value={end}
              onChange={(e) => onEndChange(e.target.value)}
              className="filter-input"
              min={timeToggle === "year" ? 2014 : undefined}
              max={timeToggle === "year" ? 2026 : undefined}
            />

            <select
              value={bucket}
              onChange={(e) => onBucketChange(e.target.value as Bucket)}
              className="filter-input"
              title="Primary chart time aggregation"
            >
              <option value="year">Agg. by year</option>
              <option value="month">Agg. by month</option>
              <option value="day">Agg. by day</option>
              <option value="hour">Agg. by hour</option>
            </select>
          </div>
        </div>

        <div>
          <p className="filter-panel__label">Direction</p>
          <div className="flex gap-1.5">
            {DIRECTIONS.map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => toggleDirection(dir)}
                className={`rounded-md border px-2 py-1 text-xs font-semibold transition-all ${
                  directions.includes(dir)
                    ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,var(--card))] text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                {dir}
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-[160px]">
          <p className="filter-panel__label">Routes</p>
          <select
            multiple
            value={routes}
            onChange={(e) =>
              onRoutesChange(Array.from(e.target.selectedOptions, (o) => o.value))
            }
            className="filter-input h-[4.5rem] w-full"
          >
            {availableRoutes.slice(0, 100).map((r) => (
              <option key={r.route} value={r.route}>
                {r.route} ({r.incidents.toLocaleString()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {view === "compare" && (
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="filter-panel__label mb-0">Compare periods (max 10)</p>
            <button
              type="button"
              onClick={addCompareInterval}
              disabled={compareIntervals.length >= 10}
              className="rounded-md bg-[var(--accent)] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
            >
              Add period
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {compareIntervals.map((interval, index) => (
              <span
                key={interval.id}
                className="rounded-md border border-[var(--border)] bg-[var(--control-bg)] px-2 py-1 text-xs text-[var(--text)]"
              >
                P{index + 1}: {interval.start} → {interval.end}
                <button
                  type="button"
                  className="ml-1.5 text-[var(--accent)]"
                  onClick={() =>
                    onCompareIntervalsChange(
                      compareIntervals.filter((i) => i.id !== interval.id),
                    )
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
