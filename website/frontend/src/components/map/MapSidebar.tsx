import { useMemo, useState } from "react";
import type { RouteDelayRow, RouteDetail } from "../../api";
import type { GeocodeResult } from "../../lib/geoUtils";
import type { LiveAdvisory, LiveSnapshot, Mode } from "../../types";
import { LiveServiceAlerts } from "./LiveServiceAlerts";
import { LiveRouteDetail } from "./LiveRouteDetail";

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
  timeToggle: "year" | "date";
}

interface Props {
  mode: Mode;
  viewMode: "live" | "historical";
  explore: MapExploreState;
  onExploreChange: (patch: Partial<MapExploreState>) => void;
  routeRows: RouteDelayRow[];
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
  const routeOptions = useMemo(
    () => routeRows.map((r) => r.route).filter(Boolean),
    [routeRows],
  );

  return (
    <aside className="map-sidebar panel-scroll card-panel">
      {viewMode === "historical" ? (
        <div className="map-sidebar__section">
          <p className="map-sidebar__heading">Historical delay layer</p>
          <p className="map-sidebar__hint">
            By default the map shows live-alert routes, the top delayed routes in your year range, or
            routes you search — not the full network. Use &quot;Show route on map&quot; to highlight one line.
            Heatmap mode hides route lines unless a live alert route is active or Display all is on.
          </p>
          <div className="map-sidebar__row">
            <label className="map-sidebar__label">
              From year
              <input
                type="number"
                className="filter-input w-full"
                min={2014}
                max={2026}
                value={explore.histStart}
                onChange={(e) => onExploreChange({ histStart: e.target.value })}
              />
            </label>
            <label className="map-sidebar__label">
              To year
              <input
                type="number"
                className="filter-input w-full"
                min={2014}
                max={2026}
                value={explore.histEnd}
                onChange={(e) => onExploreChange({ histEnd: e.target.value })}
              />
            </label>
          </div>
          <label className="map-sidebar__check">
            <input
              type="checkbox"
              checked={explore.showAllRoutes}
              onChange={(e) => onExploreChange({ showAllRoutes: e.target.checked })}
            />
            Display all routes on map
          </label>
          <label className="map-sidebar__check">
            <input
              type="checkbox"
              checked={explore.showHeatmap}
              onChange={(e) => onExploreChange({ showHeatmap: e.target.checked })}
            />
            Show delay heatmap
          </label>

          <p className="map-sidebar__heading">Route search</p>
          <input
            type="text"
            className="filter-input w-full"
            placeholder={`e.g. ${mode === "bus" ? "29" : "501"} (${mode})`}
            value={explore.routeSearch}
            onChange={(e) => onExploreChange({ routeSearch: e.target.value })}
            list="map-route-list"
          />
          <datalist id="map-route-list">
            {routeOptions.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          <button
            type="button"
            className="map-sidebar__btn"
            onClick={() => onSelectRoute(explore.routeSearch.trim())}
          >
            Show route on map
          </button>

          {routeDetail && (
            <div className="map-sidebar__card">
              <strong>Route {routeDetail.route}</strong>
              <p>
                {routeDetail.summary.incidents.toLocaleString()} incidents ·{" "}
                {Math.round(routeDetail.summary.delay_minutes).toLocaleString()} min delay
              </p>
              <ul className="map-sidebar__list">
                {routeDetail.categories.map((c) => (
                  <li key={c.category}>
                    {c.category}: {Math.round(c.delay_minutes).toLocaleString()} min
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="map-sidebar__heading">Compare two routes</p>
          <div className="map-sidebar__row">
            <select
              className="filter-input w-full"
              value={explore.compareA}
              onChange={(e) => onExploreChange({ compareA: e.target.value })}
            >
              <option value="">Route A</option>
              {routeOptions.map((r) => (
                <option key={`a-${r}`} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              className="filter-input w-full"
              value={explore.compareB}
              onChange={(e) => onExploreChange({ compareB: e.target.value })}
            >
              <option value="">Route B</option>
              {routeOptions.map((r) => (
                <option key={`b-${r}`} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {compareDetailA && compareDetailB && (
            <div className="map-sidebar__card">
              <p>
                <strong>{compareDetailA.route}</strong>:{" "}
                {Math.round(compareDetailA.summary.delay_minutes).toLocaleString()} min
              </p>
              <p>
                <strong>{compareDetailB.route}</strong>:{" "}
                {Math.round(compareDetailB.summary.delay_minutes).toLocaleString()} min
              </p>
            </div>
          )}

          <p className="map-sidebar__heading">Address search</p>
          <p className="map-sidebar__hint">
            Search Toronto-area addresses and intersections. Suggestions appear as you type.
          </p>
          <div className="address-search">
            <input
              type="search"
              className="filter-input w-full"
              placeholder="e.g. 1 Front St E, or King and Bathurst"
              value={explore.addressQuery}
              onChange={(e) => onExploreChange({ addressQuery: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && onGeocodeAddress()}
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={addressSuggestions.length > 0}
            />
            {addressSuggestions.length > 0 && (
              <ul className="address-search__suggestions" role="listbox">
                {addressSuggestions.map((hit) => (
                  <li key={`${hit.lon}-${hit.lat}-${hit.display_name}`}>
                    <button
                      type="button"
                      role="option"
                      className="address-search__option"
                      onClick={() => onPickAddressSuggestion?.(hit)}
                    >
                      {hit.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            className="map-sidebar__btn"
            onClick={onGeocodeAddress}
            disabled={geocodeSearching}
          >
            {geocodeSearching ? "Searching…" : "Find on map"}
          </button>
          {geocodeStatus && <p className="map-sidebar__status">{geocodeStatus}</p>}
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
