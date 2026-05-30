import { normalizeRouteId } from "./mapStyles";
import type { Mode } from "../types";

type SurfaceMode = Extract<Mode, "streetcar" | "bus">;

function asSurfaceMode(mode?: Mode): SurfaceMode | undefined {
  if (mode === "streetcar" || mode === "bus") return mode;
  return undefined;
}

/** Strip branch suffix: 504A → 504, 301B → 301 */
export function routeNumberBase(route: string): string {
  const norm = normalizeRouteId(route.trim().toUpperCase());
  const base = norm.replace(/[A-Z]+$/, "");
  return base || norm;
}

/**
 * TTC live alerts sometimes use bus route numbers for streetcar corridors.
 * Map those to the streetcar route id used in route-shapes.json.
 */
const STREETCAR_LIVE_SHAPE_ALIASES: Record<string, string> = {
  "307": "511",
};

export function expandRouteIdsForMap(route: string, activeMode?: Mode): string[] {
  const trimmed = route.trim();
  if (!trimmed) return [];
  const norm = normalizeRouteId(trimmed);
  const upper = trimmed.toUpperCase();
  const base = routeNumberBase(trimmed);
  const ids = new Set<string>([trimmed, norm, upper, base]);
  const surfaceMode = asSurfaceMode(activeMode);
  if (surfaceMode === "streetcar") {
    const alias = STREETCAR_LIVE_SHAPE_ALIASES[base] ?? STREETCAR_LIVE_SHAPE_ALIASES[upper];
    if (alias) ids.add(alias);
  }
  return [...ids];
}
