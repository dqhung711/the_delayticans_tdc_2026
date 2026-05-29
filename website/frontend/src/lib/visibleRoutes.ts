import { expandRouteIdsForMap, routeNumberBase } from "./routeNumbers";
import type { LiveAdvisory, Mode } from "../types";

/** Routes from TTC live alerts (route field), with branch bases and streetcar aliases. */
export function collectLiveAdvisoryRouteIds(
  advisories: LiveAdvisory[],
  activeMode: Mode,
): Set<string> {
  const ids = new Set<string>();
  for (const advisory of advisories) {
    if (advisory.mode !== activeMode && advisory.mode !== "unknown") continue;
    for (const r of advisory.routes) {
      for (const id of expandRouteIdsForMap(r, activeMode)) {
        ids.add(id);
      }
    }
  }
  return ids;
}

export function routeIsVisible(
  shapeRoute: string,
  visibleIds: Set<string>,
  activeMode?: Mode,
): boolean {
  if (!shapeRoute || !visibleIds.size) return false;
  const shapeKeys = new Set(expandRouteIdsForMap(shapeRoute, activeMode));
  for (const id of visibleIds) {
    if (shapeKeys.has(id)) return true;
    for (const key of expandRouteIdsForMap(id, activeMode)) {
      if (shapeKeys.has(key)) return true;
    }
    if (routeNumberBase(id) === routeNumberBase(shapeRoute) && routeNumberBase(shapeRoute).length >= 2) {
      return true;
    }
  }
  return false;
}
