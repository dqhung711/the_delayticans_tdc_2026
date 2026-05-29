import { useMemo, useState } from "react";
import type { RouteDelayRow, RouteDetail } from "../../api";
import type { GeocodeResult } from "../../lib/geoUtils";
import type { LiveAdvisory, LiveSnapshot, Mode } from "../../types";
import { LiveServiceAlerts } from "./LiveServiceAlerts";

export interface MapExploreState {
  histStart: string;
  histEnd: string;
  showHeatmap: boolean;
  routeSearch: string;
  compareA: string;
  compareB: string;
  addressQuery: string;
  nearbyKm: number;
}

interface Props {
  mode: Mode;
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
}

export function MapSidebar({
  mode,
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
}: Props) {
  const [tab, setTab] = useState<"explore" | "live">("explore");

  const routeOptions = useMemo(
    () => routeRows.map((r) => r.route).filter(Boolean),
    [routeRows],
  );

  const liveTotal =
    liveSnapshot?.categories.reduce((n, c) => n + c.totalCount, 0) ?? advisories.length;

  return (
    <aside className="map-sidebar panel-scroll card-panel">
      <div className="map-sidebar__tabs">
        <button
          type="button"
          className={tab === "explore" ? "map-sidebar__tab--active" : ""}
          onClick={() => setTab("explore")}
        >
          Routes & delays
        </button>
        <button
          type="button"
          className={tab === "live" ? "map-sidebar__tab--active" : ""}
          onClick={() => setTab("live")}
        >
          Live ({liveTotal})
        </button>
      </div>

      {tab === "explore" && (
        <div className="map-sidebar__section">
          <p className="map-sidebar__heading">Historical delay layer</p>
          <p className="map-sidebar__hint">
            Route line thickness reflects total delay minutes in the selected year range.
            Heatmap plots delay totals at each CSV location (matched to TTC stop/intersection coordinates).
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
              checked={explore.showHeatmap}
              onChange={(e) => onExploreChange({ showHeatmap: e.target.checked })}
            />
            Show delay heatmap
          </label>

          <p className="map-sidebar__heading">Route search</p>
          <input
            type="text"
            className="filter-input w-full"
            placeholder={`e.g. 501 (${mode})`}
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
      )}

      {tab === "live" && (
        <div className="map-sidebar__live">
          <LiveServiceAlerts
            snapshot={liveSnapshot}
            mode={mode}
            onSelectRoute={onSelectLiveRoute}
            onSelectAlert={onSelectAlert}
            onRefresh={onRefreshLive}
            refreshing={liveRefreshing}
          />
          {advisories.length > 0 && (
            <>
              <p className="map-sidebar__heading map-sidebar__heading--spaced">
                Map pins ({advisories.length} exact locations)
              </p>
              <ul className="map-sidebar__advisories">
                {advisories.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => onSelectAdvisory(a)}
                      className={`advisory-card w-full text-left ${selectedAdvisory?.id === a.id ? "advisory-card--selected" : ""}`}
                    >
                      <span className="advisory-card__category">{a.category ?? a.effect}</span>
                      <p className="mt-1 font-medium leading-snug">{a.title}</p>
                      {a.routes.length > 0 && (
                        <p className="mt-1 text-xs text-[var(--accent)]">
                          Routes {a.routes.join(", ")}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
