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
  onModeChange: (mode: Mode) => void;
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
  mode,
  onModeChange,
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
    <div className="filter-panel page-enter mb-6">
      {/* Mode Selection */}
      <div className="flex items-center gap-8 mb-6 border-b border-[var(--border)] pb-4">
        <button
          onClick={() => onModeChange("streetcar")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
            mode === "streetcar"
              ? "text-[var(--accent)] border-b-2 border-[var(--accent)] font-bold"
              : "text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m0 0V5a2 2 0 00-2-2H8a2 2 0 00-2 2v2m10 0v2M6 7v2m10 11a2 2 0 01-2 2H8a2 2 0 01-2-2v-3a2 2 0 012-2h6a2 2 0 012 2v3z" />
          </svg>
          Streetcar
        </button>
        <button
          onClick={() => onModeChange("bus")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
            mode === "bus"
              ? "text-[var(--accent)] border-b-2 border-[var(--accent)] font-bold"
              : "text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m0 0V5a2 2 0 00-2-2H8a2 2 0 00-2 2v2m10 0v2M6 7v2m10 11a2 2 0 01-2 2H8a2 2 0 01-2-2v-3a2 2 0 012-2h6a2 2 0 012 2v3z" />
          </svg>
          Bus
        </button>
        <button
          onClick={() => onModeChange("subway")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
            mode === "subway"
              ? "text-[var(--accent)] border-b-2 border-[var(--accent)] font-bold"
              : "text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          Subway
        </button>
      </div>

      <div className="flex flex-wrap items-start gap-x-12 gap-y-6">
        {/* View Selection */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">View</p>
          <div className="flex items-center gap-6">
            <button
              onClick={() => onViewChange("overview")}
              className={`flex items-center gap-2 text-sm font-medium transition-all ${
                view === "overview" ? "text-[var(--accent)]" : "text-[var(--muted)]"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${view === "overview" ? "bg-[var(--accent)]" : "bg-transparent"}`} />
              Overview
            </button>
            <button
              onClick={() => onViewChange("compare")}
              className={`flex items-center gap-2 text-sm font-medium transition-all ${
                view === "compare" ? "text-[var(--accent)]" : "text-[var(--muted)]"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${view === "compare" ? "bg-[var(--accent)]" : "bg-transparent"}`} />
              Compare
            </button>
          </div>
        </div>

        {/* Time Range */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Time Range</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-[var(--control-bg)] rounded-md p-0.5">
              {(["year", "date"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    onTimeToggleChange(t);
                    onGranularityChange(t === "year" ? "year" : granularity === "year" ? "date" : granularity);
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                    timeToggle === t ? "bg-white text-[var(--text)] shadow-sm" : "text-[var(--muted)]"
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <input
                  type={timeToggle === "year" ? "number" : "date"}
                  value={start}
                  onChange={(e) => onStartChange(e.target.value)}
                  className="bg-transparent border-none text-sm font-bold w-20 p-0 focus:ring-0"
                />
                <svg className="w-4 h-4 text-[var(--accent)] ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-[var(--muted)] font-medium">→</span>
              <div className="relative flex items-center">
                <input
                  type={timeToggle === "year" ? "number" : "date"}
                  value={end}
                  onChange={(e) => onEndChange(e.target.value)}
                  className="bg-transparent border-none text-sm font-bold w-20 p-0 focus:ring-0"
                />
                <svg className="w-4 h-4 text-[var(--accent)] ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Direction */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Direction</p>
          <div className="flex gap-4">
            {DIRECTIONS.map((dir) => (
              <button
                key={dir}
                onClick={() => toggleDirection(dir)}
                className={`flex items-center gap-1.5 text-sm font-medium transition-all ${
                  directions.includes(dir) ? "text-[var(--accent)]" : "text-[var(--muted)]"
                }`}
              >
                <span className="text-xs">{dir === "EB" ? "→" : dir === "WB" ? "←" : dir === "NB" ? "↑" : "↓"}</span>
                {dir}
              </button>
            ))}
          </div>
        </div>

        {/* Routes (Optional, keeping it but making it more compact) */}
        <div className="flex flex-col gap-2 ml-auto">
          <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Routes</p>
          <select
            multiple
            value={routes}
            onChange={(e) => onRoutesChange(Array.from(e.target.selectedOptions, (o) => o.value))}
            className="text-xs bg-[var(--control-bg)] border-[var(--border)] rounded-md h-10 w-40"
          >
            {availableRoutes.slice(0, 100).map((r) => (
              <option key={r.route} value={r.route}>
                {r.route} ({r.incidents})
              </option>
            ))}
          </select>
        </div>
      </div>

      {view === "compare" && (
        <div className="mt-6 pt-4 border-t border-[var(--border)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Compare periods</p>
            <button
              type="button"
              onClick={addCompareInterval}
              disabled={compareIntervals.length >= 10}
              className="text-xs font-bold text-[var(--accent)] hover:underline disabled:opacity-40"
            >
              + Add period
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {compareIntervals.map((interval, index) => (
              <div
                key={interval.id}
                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--control-bg)] rounded-md text-xs font-medium"
              >
                <span>P{index + 1}: {interval.start} → {interval.end}</span>
                <button
                  onClick={() => onCompareIntervalsChange(compareIntervals.filter((i) => i.id !== interval.id))}
                  className="text-[var(--accent)] hover:text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
