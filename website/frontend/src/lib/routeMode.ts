import { normalizeRouteId } from "./mapStyles";
import type { Mode } from "../types";

export type RouteModesMap = Record<string, string>;

function lookupRouteMode(route: string, routeModes: RouteModesMap): Mode | null {
  const trimmed = route.trim();
  if (!trimmed) return null;
  const norm = normalizeRouteId(trimmed);
  const digits = norm.replace(/\D/g, "");
  for (const key of [trimmed, norm, digits, trimmed.toUpperCase()]) {
    if (!key) continue;
    const m = routeModes[key];
    if (m === "bus" || m === "streetcar") return m;
  }
  return null;
}

/** Resolve bus vs streetcar from delay DB map, then shape tag, then TTC numbering. */
export function resolveRouteMode(
  route: string,
  routeModes: RouteModesMap,
  shapeMode?: string,
): Mode {
  if (shapeMode === "streetcar" || shapeMode === "bus") {
    const fromDb = lookupRouteMode(route, routeModes);
    if (fromDb && fromDb !== shapeMode) {
      return shapeMode;
    }
    if (fromDb) return fromDb;
    return shapeMode;
  }

  const fromDb = lookupRouteMode(route, routeModes);
  if (fromDb) return fromDb;

  return "bus";
}

export function routeMatchesMode(
  route: string,
  mode: Mode,
  routeModes: RouteModesMap,
): boolean {
  return resolveRouteMode(route, routeModes) === mode;
}
