import { useMemo, useState } from "react";
import type { RouteDelayRow, RouteDetail } from "../../api";
import type { GeocodeResult } from "../../lib/geoUtils";
import type { LiveAdvisory, LiveSnapshot, Mode } from "../../types";
import { LiveServiceAlerts } from "./LiveServiceAlerts";
import { LiveRouteDetail } from "./LiveRouteDetail";
import { getRouteName } from "../../lib/routeNames";
import { getModeColors } from "../../lib/colorPalettes";
import { useAccessibility } from "../../context/AccessibilityContext";

export interface MapExploreState {
  histStart: string;
  histEnd: string;
  showHeatmap: boolean;
  showAllRoutes: boolean;
  routeSearch: string;
  compareA: string;
  compareB: string;
  addressQuery: string;
  nearbyKm: number;
  timeToggle: "year" | "range";
}

interface Props {
  mode: Mode;
  viewMode: "live" | "historical";
  explore: MapExploreState;
  onExploreChange: (patch: Partial<MapExploreState>) => void;
  routeRows: RouteDelayRow[];
  rankedRoutes?: RouteDelayRow[];
  routeDetail: RouteDetail | null;
  compareDetailA: RouteDetail | null;
  compareDetailB: RouteDetail | null;
  onSelectRoute: (route: string) => void;
  onGeocodeAddress: () => void;
  geocodeStatus: string | null;
  geocodeSearching?: boolean;
  addressSuggestions?: GeocodeResult[];
  onPickAddressSuggestion?: (hit: GeocodeResult) => void;
  liveSnapshot: LiveSnapshot | null;
  advisories: LiveAdvisory[];
  selectedAdvisory: LiveAdvisory | null;
  onSelectAdvisory: (a: LiveAdvisory) => void;
  onSelectLiveRoute?: (route: string, categoryName: string) => void;
  onSelectAlert?: (alertId: string) => void;
  onRefreshLive?: () => void;
  liveRefreshing?: boolean;
  onClearRouteDetail?: () => void;
}

export function MapSidebar({
  mode,
  viewMode,
  explore,
  onExploreChange,
  routeRows,
  rankedRoutes = [],
  routeDetail,
  compareDetailA,
  compareDetailB,
  onSelectRoute,
  onGeocodeAddress,
  geocodeStatus,
  geocodeSearching = false,
  addressSuggestions = [],
  onPickAddressSuggestion,
  liveSnapshot,
  advisories,
  selectedAdvisory,
  onSelectAdvisory,
  onSelectLiveRoute,
  onSelectAlert,
  onRefreshLive,
  liveRefreshing = false,
  onClearRouteDetail,
}: Props) {
  const { colorblindType } = useAccessibility();
  const [activeMetric, setActiveMetric] = useState<"delay_minutes" | "gap_minutes" | "incidents" | "avg_delay">("delay_minutes");
  
  const metrics = [
    { id: "delay_minutes", label: "Delay min" },
    { id: "gap_minutes", label: "Gap min" },
    { id: "incidents", label: "Incidents" },
    { id: "avg_delay", label: "Avg delay" },
  ] as const;

  const routeOptions = useMemo(
    () => routeRows.map((r) => r.route).filter(Boolean),
    [routeRows],
  );

  return (
    <aside className="map-sidebar panel-scroll card-panel">
      {viewMode === "historical" ? (
        <div className="map-sidebar__section">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--muted)]" />
              <h2 className="text-sm font-bold">Historical</h2>
            </div>
            <span className="text-[11px] text-[var(--muted)] font-medium">
              {explore.histStart === explore.histEnd ? explore.histStart : `${explore.histStart} — ${explore.histEnd}`}
            </span>
          </div>

          <div className="mb-6">
            <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-3">
              Summary · {explore.histStart === explore.histEnd ? explore.histStart : `${explore.histStart}–${explore.histEnd}`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[var(--control-bg)] border border-[var(--border)] rounded-lg p-3">
                <p className="text-[10px] text-[var(--muted)] font-medium mb-1">Total incidents</p>
                <p className="text-lg font-bold leading-tight">
                  {(routeRows.reduce((sum, r) => sum + r.incidents, 0)).toLocaleString()}
                </p>
              </div>
              <div className="bg-[var(--control-bg)] border border-[var(--border)] rounded-lg p-3">
                <p className="text-[10px] text-[var(--muted)] font-medium mb-1">Total delay</p>
                <p className="text-lg font-bold leading-tight">
                  {(() => {
                    const total = routeRows.reduce((sum, r) => sum + r.delay_minutes, 0);
                    return total >= 1000000 ? `${(total / 1000000).toFixed(1)}M` : `${Math.round(total / 1000)}k`;
                  })()}
                  <span className="text-[10px] ml-1 font-medium text-[var(--muted)]">min</span>
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Routes Ranked</p>
            </div>
            
            <div className="flex items-center gap-3 border-b border-[var(--border)] mb-4">
              {metrics.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setActiveMetric(m.id)}
                  className={`text-[11px] font-bold pb-1.5 transition-all relative ${
                    activeMetric === m.id ? "text-[var(--accent)]" : "text-[var(--muted)]"
                  }`}
                >
                  {m.label}
                  {activeMetric === m.id && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent)]" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1">
              {rankedRoutes
                .sort((a, b) => {
                  if (activeMetric === "avg_delay") {
                    const avgA = a.incidents ? a.delay_minutes / a.incidents : 0;
                    const avgB = b.incidents ? b.delay_minutes / b.incidents : 0;
                    return avgB - avgA;
                  }
                  return b[activeMetric] - a[activeMetric];
                })
                .slice(0, 6)
                .map((r, idx) => {
                  const val = activeMetric === "avg_delay" 
                    ? (r.incidents ? r.delay_minutes / r.incidents : 0)
                    : r[activeMetric];
                  const prevVal = activeMetric === "avg_delay"
                    ? (r.prev_incidents ? (r.prev_delay_minutes ?? 0) / r.prev_incidents : 0)
                    : (activeMetric === "delay_minutes" ? r.prev_delay_minutes : 
                       activeMetric === "gap_minutes" ? r.prev_gap_minutes : 
                       r.prev_incidents) ?? 0;
                  
                  const pct = prevVal > 0 ? ((val - prevVal) / prevVal) * 100 : 0;
                  const maxVal = Math.max(...rankedRoutes.map(rr => 
                    activeMetric === "avg_delay" 
                      ? (rr.incidents ? rr.delay_minutes / rr.incidents : 0)
                      : rr[activeMetric]
                  ));

                  return (
                    <div 
                      key={r.route} 
                      className="flex items-center gap-3 py-2 px-1 hover:bg-[var(--accent)]/5 rounded-md cursor-pointer transition-colors group"
                      onClick={() => onSelectRoute(r.route)}
                    >
                      <span className="text-[11px] font-bold text-[var(--muted)] w-3">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getModeColors(colorblindType)[mode] }} />
                            <span className="text-xs font-bold truncate">
                              {r.route} {getRouteName(r.route)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs font-bold">
                              {val >= 1000 ? `${Math.round(val / 1000)}k` : Math.round(val)}
                            </span>
                            {pct !== 0 && (
                              <span className={`text-[10px] font-bold ${pct > 0 ? "text-red-500" : "text-green-500"}`}>
                                {pct > 0 ? "↑" : "↓"}{Math.abs(Math.round(pct))}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[var(--accent)] opacity-60 rounded-full transition-all duration-500"
                            style={{ width: `${(val / maxVal) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <a 
            href="/explorer"
            className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-bold rounded-lg hover:bg-[var(--accent)]/20 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18" />
              <path d="M18 9l-6 6-2-2-4 4" />
            </svg>
            Explore in Data Explorer
            <span className="text-sm">→</span>
          </a>
        </div>
      ) : (
        <div className="map-sidebar__live">
          {routeDetail && viewMode === "live" ? (
            <LiveRouteDetail
              routeDetail={routeDetail}
              mode={mode}
              onBack={onClearRouteDetail}
            />
          ) : (
            <LiveServiceAlerts
              snapshot={liveSnapshot}
              mode={mode}
              advisories={advisories}
              onSelectAdvisory={onSelectAdvisory}
              onRefresh={onRefreshLive}
              refreshing={liveRefreshing}
            />
          )}
        </div>
      )}
    </aside>
  );
}
