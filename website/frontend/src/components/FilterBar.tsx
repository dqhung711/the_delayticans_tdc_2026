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

const SubwayIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2c-4.42 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2l2-2h4l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm5.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM18 11h-5V6h5v5z" />
  </svg>
);

const BusIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78A2.99 2.99 0 0020 16V6c0-3.5-3.58-4-8-4S4 2.5 4 6v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h14v5z" />
  </svg>
);

const StreetcarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 16.94V8c0-2.79-2.68-3.98-6.04-3.98h-.03C9.67 4.02 7 5.22 7 8v8.94l-1.45 1.45c-.18.18-.29.43-.29.68V20c0 .55.45 1 1 1h2.58l1.7-1.71h2.92l1.7 1.71H18.74c.55 0 1-.45 1-1v-.93c0-.25-.11-.5-.29-.68L19 16.94zM8.5 15c-.83 0-1.5-.67-1.5-1.5S7.67 12 8.5 12s1.5.67 1.5 1.5S9.33 15 8.5 15zm7 0c-.83 0-1.5-.67-1.5-1.5S14.67 12 15.5 12s1.5.67 1.5 1.5S16.33 15 15.5 15zm1.5-5H9V8h8v2z" />
  </svg>
);

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
        {(
          [
            { key: "streetcar", label: "Streetcar", Icon: StreetcarIcon },
            { key: "bus", label: "Bus", Icon: BusIcon },
            { key: "subway", label: "Subway", Icon: SubwayIcon },
          ] as const
        ).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => onModeChange(key)}
            className={`relative flex items-center gap-2 pb-1.5 transition-all ${
              mode === key
                ? "text-[var(--accent)] font-bold"
                : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
            {mode === key && (
              <span className="absolute bottom-0 left-0 right-0 h-[1px] bg-[var(--accent)] opacity-50 rounded-none" />
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-x-0 gap-y-6">
        {/* View Selection */}
        <div className="flex flex-col gap-2 pr-8">
          <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">View</p>
          <div className="flex items-center gap-5">
            {(["overview", "compare"] as const).map((v) => (
              <button
                key={v}
                onClick={() => onViewChange(v)}
                className={`relative flex items-center gap-2 text-sm font-medium pb-1 transition-all ${
                  view === v ? "text-[var(--text)] font-bold" : "text-[var(--muted)]"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    view === v ? "bg-[var(--accent)]" : "bg-[var(--muted)] opacity-40"
                  }`}
                />
                {v.charAt(0).toUpperCase() + v.slice(1)}
                {view === v && (
                  <span className="absolute bottom-0 left-0 right-0 h-[1px] bg-[var(--accent)] opacity-50" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px self-stretch bg-[var(--border)] opacity-50 mx-2" />

        {/* Time Range */}
        <div className="flex flex-col gap-2 px-8">
          <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Time Range</p>
          <div className="flex items-center gap-4">
            {/* Year / Date toggle */}
            <div className="flex items-center gap-3">
              {(["year", "date"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    onTimeToggleChange(t);
                    onGranularityChange(t === "year" ? "year" : granularity === "year" ? "date" : granularity);
                  }}
                  className={`relative text-xs font-medium pb-0.5 transition-all ${
                    timeToggle === t
                      ? "text-[var(--text)] font-bold"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                  {timeToggle === t && (
                    <span className="absolute bottom-0 left-0 right-0 h-[1px] bg-[var(--accent)] opacity-50" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type={timeToggle === "year" ? "number" : "date"}
                value={start}
                onChange={(e) => onStartChange(e.target.value)}
                min={timeToggle === "year" ? 2000 : undefined}
                max={timeToggle === "year" ? 2099 : undefined}
                className={`bg-transparent border-b-[1px] border-[var(--muted)] border-opacity-40 text-sm font-bold text-center focus:ring-0 focus:outline-none ${
                  timeToggle === "year" ? "w-16" : "w-32"
                }`}
                style={{ colorScheme: "dark" }}
              />
              <span className="text-[var(--muted)] font-medium text-xs">→</span>
              <input
                type={timeToggle === "year" ? "number" : "date"}
                value={end}
                onChange={(e) => onEndChange(e.target.value)}
                min={timeToggle === "year" ? 2000 : undefined}
                max={timeToggle === "year" ? 2099 : undefined}
                className={`bg-transparent border-b-[1px] border-[var(--muted)] border-opacity-40 text-sm font-bold text-center focus:ring-0 focus:outline-none ${
                  timeToggle === "year" ? "w-16" : "w-32"
                }`}
                style={{ colorScheme: "dark" }}
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px self-stretch bg-[var(--border)] opacity-50 mx-2" />

        {/* Direction */}
        <div className="flex flex-col gap-2 px-8">
          <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Direction</p>
          <div className="flex gap-4">
            {DIRECTIONS.map((dir) => (
              <button
                key={dir}
                onClick={() => toggleDirection(dir)}
                className={`relative flex items-center gap-1.5 text-sm font-medium pb-1 transition-all ${
                  directions.includes(dir) ? "text-[var(--accent)] font-bold" : "text-[var(--muted)]"
                }`}
              >
                <span className="text-xs">{dir === "EB" ? "→" : dir === "WB" ? "←" : dir === "NB" ? "↑" : "↓"}</span>
                {dir}
                {directions.includes(dir) && (
                  <span className="absolute bottom-0 left-0 right-0 h-[1px] bg-[var(--accent)] opacity-50" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px self-stretch bg-[var(--border)] opacity-50 mx-2" />

        {/* Routes */}
        <div className="flex flex-col gap-2 px-8 ml-auto">
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
