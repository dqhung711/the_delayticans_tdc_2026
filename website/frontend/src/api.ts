import { apiUrl } from "./lib/appConfig";
import type { CompareInterval, LiveSnapshot, Meta, Mode, OverviewCharts } from "./types";
import type { Bucket, Direction, Granularity, ViewMode } from "./types";

export interface QueryParams {
  mode: Mode;
  view: ViewMode;
  granularity: Granularity;
  timeToggle: "year" | "month";
  start: string;
  end: string;
  directions: Direction[];
  routes: string[];
  bucket: Bucket;
  intervals?: CompareInterval[];
}

function buildSearch(params: QueryParams): string {
  const search = new URLSearchParams();
  search.set("mode", params.mode);
  search.set("view", params.view);
  search.set("granularity", params.granularity);
  search.set("bucket", params.bucket);
  search.set("start", params.start);
  search.set("end", params.end);
  if (params.directions.length) {
    search.set("directions", params.directions.join(","));
  }
  if (params.routes.length) {
    search.set("routes", params.routes.join(","));
  }
  if (params.view === "compare" && params.intervals?.length) {
    search.set(
      "intervals",
      JSON.stringify(
        params.intervals.map(({ start, end }) => ({ start, end })),
      ),
    );
  }
  return search.toString();
}

export async function fetchMeta(): Promise<Meta> {
  const res = await fetch(apiUrl("/api/meta"));
  if (!res.ok) throw new Error("Failed to load metadata");
  return res.json();
}

export async function fetchOverview(params: QueryParams): Promise<OverviewCharts> {
  const res = await fetch(apiUrl(`/api/charts/overview?${buildSearch(params)}`));
  if (!res.ok) throw new Error("Failed to load chart data");
  return res.json();
}

export async function fetchSummary(params: QueryParams) {
  const res = await fetch(apiUrl(`/api/summary?${buildSearch(params)}`));
  if (!res.ok) throw new Error("Failed to load summary");
  return res.json();
}

export async function fetchLive(): Promise<LiveSnapshot> {
  const res = await fetch(apiUrl("/api/live"));
  if (!res.ok) throw new Error("Failed to load live advisories");
  return res.json();
}

export async function refreshLive(): Promise<LiveSnapshot> {
  const res = await fetch(apiUrl("/api/live/refresh"), { method: "POST" });
  if (!res.ok) throw new Error("Failed to refresh live advisories");
  return res.json();
}

export async function fetchRouteModes(): Promise<Record<string, string>> {
  const res = await fetch(apiUrl("/api/route-modes"));
  if (!res.ok) return {};
  return res.json();
}

export async function fetchRouteShapes(
  mode: "streetcar" | "bus",
): Promise<GeoJSON.FeatureCollection> {
  const hit = routeShapesCache.get(mode);
  if (hit?.features?.length) return hit;
  const res = await fetch(apiUrl(`/api/route-shapes?mode=${mode}`));
  if (!res.ok) return { type: "FeatureCollection", features: [] };
  const data = (await res.json()) as GeoJSON.FeatureCollection;
  if (!Array.isArray(data?.features)) {
    routeShapesCache.delete(mode);
    return { type: "FeatureCollection", features: [] };
  }
  routeShapesCache.set(mode, data);
  return data;
}

/** Load the other mode in the background so tab switches feel instant. */
export function prefetchRouteShapes(mode: "streetcar" | "bus"): void {
  if (routeShapesCache.get(mode)?.features?.length) return;
  void fetchRouteShapes(mode);
}

const routeShapesCache = new Map<string, GeoJSON.FeatureCollection>();

export function clearRouteShapesCache(): void {
  routeShapesCache.clear();
}
const mapStopsCache = new Map<string, GeoJSON.FeatureCollection>();

export function clearMapStopsCache(): void {
  mapStopsCache.clear();
}

export async function fetchMapStops(mode: Mode): Promise<GeoJSON.FeatureCollection> {
  if (mode !== "bus" && mode !== "streetcar") {
    return { type: "FeatureCollection", features: [] };
  }
  const res = await fetch(apiUrl(`/api/map/stops?mode=${mode}`));
  if (!res.ok) return { type: "FeatureCollection", features: [] };
  const data = (await res.json()) as GeoJSON.FeatureCollection;
  mapStopsCache.set(mode, data);
  return data;
}

export interface RouteDelayRow {
  route: string;
  delay_minutes: number;
  gap_minutes: number;
  incidents: number;
  prev_delay_minutes?: number;
  prev_gap_minutes?: number;
  prev_incidents?: number;
}

export async function fetchRankedRoutes(params: QueryParams): Promise<RouteDelayRow[]> {
  const res = await fetch(apiUrl(`/api/map/ranked-routes?${buildSearch(params)}`));
  if (!res.ok) return [];
  return res.json();
}

export interface RouteDetail {
  route: string;
  summary: { incidents: number; delay_minutes: number; gap_minutes: number };
  categories: Array<{ category: string; delay_minutes: number; incidents: number }>;
}

export async function fetchRouteDelays(params: QueryParams): Promise<RouteDelayRow[]> {
  const res = await fetch(apiUrl(`/api/map/route-delays?${buildSearch(params)}`));
  if (!res.ok) return [];
  return res.json();
}

const delayHotspotsCache = new Map<string, GeoJSON.FeatureCollection>();

function delayHotspotsCacheKey(params: QueryParams): string {
  return buildSearch(params);
}

export function getCachedDelayHotspots(
  params: QueryParams,
): GeoJSON.FeatureCollection | undefined {
  const hit = delayHotspotsCache.get(delayHotspotsCacheKey(params));
  if (hit?.features?.length) return hit;
  return undefined;
}

/** Load heatmap in the background so toggling the layer feels instant. */
export function prefetchDelayHotspots(params: QueryParams): void {
  if (getCachedDelayHotspots(params)) return;
  void fetchDelayHotspots(params);
}

export async function fetchDelayHotspots(
  params: QueryParams,
): Promise<GeoJSON.FeatureCollection> {
  const key = delayHotspotsCacheKey(params);
  const hit = delayHotspotsCache.get(key);
  if (hit?.features?.length) return hit;
  const res = await fetch(apiUrl(`/api/map/delay-hotspots?${key}`));
  if (!res.ok) return { type: "FeatureCollection", features: [] };
  const data = (await res.json()) as GeoJSON.FeatureCollection;
  if (Array.isArray(data?.features) && data.features.length) {
    delayHotspotsCache.set(key, data);
  }
  return data;
}

export async function fetchRouteDetail(
  route: string,
  params: QueryParams,
): Promise<RouteDetail | null> {
  const search = buildSearch(params);
  const res = await fetch(apiUrl(`/api/map/route/${encodeURIComponent(route)}?${search}`));
  if (!res.ok) return null;
  return res.json();
}

export async function fetchRoutes(mode: Mode) {
  const search = new URLSearchParams({ mode });
  const res = await fetch(apiUrl(`/api/routes?${search}`));
  if (!res.ok) return [];
  return res.json() as Promise<Array<{ route: string; incidents: number }>>;
}
