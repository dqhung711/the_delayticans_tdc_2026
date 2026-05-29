import { routeIsVisible } from "./visibleRoutes";
import type { Mode } from "../types";

/** Same rule for bus and streetcar: every line segment tagged with this mode in route-shapes.json. */
export function allModeLineFeatures(
  collection: GeoJSON.FeatureCollection,
  activeMode: Mode,
): GeoJSON.Feature[] {
  return collection.features.filter(
    (f) => String(f.properties?.mode ?? "") === activeMode,
  );
}

/** Filtered map: only routes in the visible set (delays, alerts, search, etc.). */
export function filteredModeLineFeatures(
  collection: GeoJSON.FeatureCollection,
  activeMode: Mode,
  visibleRouteIds: Set<string>,
): GeoJSON.Feature[] {
  if (!visibleRouteIds.size) return [];
  return collection.features.filter((f) => {
    if (String(f.properties?.mode ?? "") !== activeMode) return false;
    const route = String(f.properties?.route ?? "");
    return routeIsVisible(route, visibleRouteIds, activeMode);
  });
}

export function selectMapRouteFeatures(options: {
  collection: GeoJSON.FeatureCollection;
  activeMode: Mode;
  showAllRoutes: boolean;
  visibleRouteIds: Set<string> | null;
}): GeoJSON.Feature[] {
  const { collection, activeMode, showAllRoutes, visibleRouteIds } = options;
  if (showAllRoutes) {
    return allModeLineFeatures(collection, activeMode);
  }
  if (!visibleRouteIds) return [];
  return filteredModeLineFeatures(collection, activeMode, visibleRouteIds);
}
