import { useEffect, useState } from "react";
import { fetchRouteModes } from "../../api";
import { routeMatchesMode as routeMatchesModeMap } from "../../lib/routeMode";
import type { RouteModesMap } from "../../lib/routeMode";
import type { LiveAdvisory, LiveSnapshot, Mode } from "../../types";

interface Props {
  snapshot: LiveSnapshot | null;
  mode: Mode;
  advisories: LiveAdvisory[];
  onSelectAdvisory: (a: LiveAdvisory) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

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

const SubwayIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2c-4.42 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2l2-2h4l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm5.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM18 11h-5V6h5v5z" />
  </svg>
);

export function LiveServiceAlerts({
  snapshot,
  mode,
  advisories,
  onSelectAdvisory,
  onRefresh,
  refreshing = false,
}: Props) {
  const [routeModes, setRouteModes] = useState<RouteModesMap>({});

  useEffect(() => {
    fetchRouteModes().then(setRouteModes).catch(() => setRouteModes({}));
  }, []);

  const filteredAdvisories = advisories.filter((a) => {
    if (mode === "subway") return a.mode === "subway";
    return a.mode === "bus" || a.mode === "streetcar" || a.mode === "unknown";
  });

  return (
    <div className="live-panel-v2">
      <header className="flex items-center justify-between mb-6">
        <h2 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Active Delays Now</h2>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-bold">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          Live
        </div>
      </header>

      <div className="space-y-0 border-t border-[var(--border)]">
        {filteredAdvisories.map((a) => {
          const routeNum = a.routes[0] ?? "";
          const routeName = a.title.split(":")[0]?.replace(/Route \d+/, "").trim() || a.title;
          const location = a.description.match(/at (.*?) /)?.[1] || "Near " + (a.stops[0] || "route line");
          
          // Mocking some delay data if not present in description
          const delayMatch = a.description.match(/(\d+) min/);
          const delayVal = delayMatch ? parseInt(delayMatch[1], 10) : 15;
          const delay = delayMatch ? `+${delayMatch[1]} min` : "+15 min";
          const status = a.effect === "DETOUR" ? "detour" : "ongoing";

          let delayColor = "text-red-700";
          if (delayVal >= 15) delayColor = "text-red-700";
          else if (delayVal >= 5) delayColor = "text-orange-600";
          else delayColor = "text-yellow-600";

          const Icon = a.mode === "subway" ? SubwayIcon : a.mode === "bus" ? BusIcon : StreetcarIcon;

          return (
            <button
              key={a.id}
              onClick={() => onSelectAdvisory(a)}
              className="w-full flex items-center gap-3 py-4 border-b border-[var(--border)] hover:bg-[var(--control-bg)] transition-colors text-left group relative"
            >
              <div className="w-10 h-10 flex-shrink-0 bg-red-50 text-red-600 rounded-lg flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-base font-bold text-[var(--text)] truncate">
                    {routeNum} {routeName}
                  </h3>
                  <span className={`text-sm font-semibold ${delayColor} whitespace-nowrap`}>
                    {delay}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs text-[var(--muted)] truncate">
                    {location}
                  </p>
                  <span className="text-[10px] text-[var(--muted)] font-medium uppercase">
                    {status}
                  </span>
                </div>
              </div>

              {/* Hover Tooltip */}
              <div className="absolute z-[100] invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 bg-white/80 backdrop-blur-md border border-[var(--border)] p-3 rounded-xl shadow-xl text-xs text-[var(--text)] right-full mr-4 top-0 w-64 pointer-events-none">
                <div className="font-bold mb-1.5 text-[var(--accent)]">{routeNum} {routeName}</div>
                <div className="leading-relaxed opacity-90">{a.description}</div>
                {/* Arrow pointing to the right */}
                <div className="absolute top-6 -right-1 translate-x-1/2 rotate-45 w-2 h-2 bg-white/80 border-t border-r border-[var(--border)]"></div>
              </div>
            </button>
          );
        })}
      </div>

      {!filteredAdvisories.length && (
        <div className="py-12 text-center">
          <p className="text-sm text-[var(--muted)]">No active delays for {mode === "subway" ? "subway" : "streetcar / bus"}.</p>
        </div>
      )}

      <footer className="mt-6 text-center">
        <p className="text-xs text-[var(--muted)] font-medium">Search a route to see full details</p>
      </footer>
    </div>
  );
}
