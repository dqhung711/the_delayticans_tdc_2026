import { useState, useRef, useEffect } from "react";
import type {
  Bucket,
  Direction,
  Mode,
  ViewMode,
} from "../types";

interface FilterBarProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  timeToggle: "year" | "range";
  onTimeToggleChange: (t: "year" | "range") => void;
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
  compLabel?: string;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

const DIRECTIONS: Direction[] = ["EB", "WB", "NB", "SB"];

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
  compLabel,
  mode,
  onModeChange,
}: FilterBarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleDirection = (dir: Direction) => {
    if (directions.includes(dir)) {
      onDirectionsChange(directions.filter((d) => d !== dir));
    } else {
      onDirectionsChange([...directions, dir]);
    }
  };

  const toggleRoute = (route: string) => {
    if (routes.includes(route)) {
      onRoutesChange(routes.filter((r) => r !== route));
    } else {
      onRoutesChange([...routes, route]);
    }
  };

  const filteredRoutes = availableRoutes.filter((r) =>
    r.route.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="filter-panel page-enter mb-6 relative z-30">
      {/* Mode Selection */}
      <div className="flex items-center gap-8 mb-6 border-b border-[var(--border)] pb-4">
        {(
          [
            { key: "streetcar", label: "Streetcar", Icon: StreetcarIcon },
            { key: "bus", label: "Bus", Icon: BusIcon },
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
            {(["overview"] as const).map((v) => (
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
          <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
            Time Range
          </p>
          <div className="flex items-center gap-4">
            {/* Year / Range toggle */}
            <div className="flex items-center gap-3">
              {(["year", "range"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onTimeToggleChange(t)}
                  className={`relative text-xs font-medium pb-0.5 transition-all ${
                    timeToggle === t ? "text-[var(--text)] font-bold" : "text-[var(--muted)]"
                  }`}
                >
                  {t === "year" ? "Year" : "Range"}
                  {timeToggle === t && (
                    <span className="absolute bottom-0 left-0 right-0 h-[1px] bg-[var(--accent)] opacity-50" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {timeToggle === "year" ? (
                <input
                  type="number"
                  value={start}
                  onChange={(e) => {
                    onStartChange(e.target.value);
                    onEndChange(e.target.value);
                  }}
                  min={2014}
                  max={2099}
                  className="bg-transparent border-b-[1px] border-[var(--muted)] border-opacity-40 text-sm font-bold text-center focus:ring-0 focus:outline-none w-16"
                  style={{ colorScheme: "dark" }}
                />
              ) : (
                <>
                  <input
                    type="number"
                    value={start}
                    onChange={(e) => onStartChange(e.target.value)}
                    min={2014}
                    max={2099}
                    className="bg-transparent border-b-[1px] border-[var(--muted)] border-opacity-40 text-sm font-bold text-center focus:ring-0 focus:outline-none w-16"
                    style={{ colorScheme: "dark" }}
                  />
                  <span className="text-[var(--muted)] font-medium text-xs">→</span>
                  <input
                    type="number"
                    value={end}
                    onChange={(e) => onEndChange(e.target.value)}
                    min={2014}
                    max={2099}
                    className="bg-transparent border-b-[1px] border-[var(--muted)] border-opacity-40 text-sm font-bold text-center focus:ring-0 focus:outline-none w-16"
                    style={{ colorScheme: "dark" }}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px self-stretch bg-[var(--border)] opacity-50 mx-2" />

        {/* Comparing Against */}
        {timeToggle === "year" && (
          <>
            <div className="flex flex-col gap-2 px-8">
              <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                Comparing Against
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--text)]">
                  {compLabel || "None"}
                </span>
                {compLabel && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 uppercase tracking-tighter">
                    {start === end ? "auto" : "auto mirror"}
                  </span>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="w-px self-stretch bg-[var(--border)] opacity-50 mx-2" />
          </>
        )}

        {/* Chart Granularity */}
        <div className="flex flex-col gap-2 px-8">
          <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
            Chart Granularity
          </p>
          <div className="flex items-center gap-3">
            {timeToggle === "year" ? (
              <>
                {(["day", "month"] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => onBucketChange(b)}
                    className={`relative text-xs font-medium pb-0.5 transition-all capitalize ${
                      bucket === b ? "text-[var(--text)] font-bold" : "text-[var(--muted)]"
                    }`}
                  >
                    {b}ly
                    {bucket === b && (
                      <span className="absolute bottom-0 left-0 right-0 h-[1px] bg-[var(--accent)] opacity-50" />
                    )}
                  </button>
                ))}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--text)] capitalize">
                  Monthly
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 uppercase tracking-tighter">
                  auto
                </span>
              </div>
            )}
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
        <div className="flex flex-col gap-2 px-8 ml-auto relative" ref={dropdownRef}>
          <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Routes</p>
          <div className="relative">
            <input
              type="text"
              placeholder="Search routes..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              className="text-xs bg-[var(--control-bg)] border border-[var(--border)] rounded-md h-9 w-44 px-3 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            {routes.length > 0 && (
              <div className="absolute -top-2 -right-2 bg-[var(--accent)] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {routes.length}
              </div>
            )}
          </div>

          {isDropdownOpen && (
            <div className="absolute top-full left-8 right-0 mt-1 bg-[var(--control-bg)] border border-[var(--border)] rounded-md shadow-lg z-50 max-h-60 overflow-y-auto min-w-[180px]">
              {filteredRoutes.length > 0 ? (
                filteredRoutes.slice(0, 50).map((r) => (
                  <button
                    key={r.route}
                    onClick={() => toggleRoute(r.route)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--accent)] hover:text-white transition-colors flex items-center justify-between ${
                      routes.includes(r.route) ? "bg-[var(--accent)]/10 text-[var(--accent)] font-bold" : "text-[var(--text)]"
                    }`}
                  >
                    <span>{r.route}</span>
                    <span className="opacity-60 text-[10px]">({r.incidents})</span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-xs text-[var(--muted)]">No routes found</div>
              )}
            </div>
          )}

          {routes.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 max-w-[200px]">
              {routes.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-bold rounded"
                >
                  {r}
                  <button
                    onClick={() => toggleRoute(r)}
                    className="hover:text-red-500"
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                onClick={() => onRoutesChange([])}
                className="text-[10px] text-[var(--muted)] hover:text-[var(--accent)] font-bold ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
