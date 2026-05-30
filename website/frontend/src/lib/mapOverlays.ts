import type { Map as MapLibreMap } from "maplibre-gl";
import type { LiveAdvisory } from "../types";

export const STOPS_SOURCE = "ttc-stops";
export const STOPS_LAYER = "ttc-stops-circle";
export const ACCESSIBLE_STOPS_SOURCE = "ttc-accessible-stops";
export const ACCESSIBLE_STOPS_LAYER = "ttc-accessible-stops-circle";
export const CONSTRUCTION_SOURCE = "construction-advisories";
export const CONSTRUCTION_LAYER = "construction-circle";

/** GTFS wheelchair_boarding: 1 = step-free boarding available. */
export const WHEELCHAIR_ACCESSIBLE = 1;

const CONSTRUCTION_TEXT =
  /construction|detour|bypass|roadwork|road work|lane closure|track work|watermain|water main|paving|repair/i;

export function isAccessibleStop(feature: GeoJSON.Feature): boolean {
  const boarding = Number(feature.properties?.wheelchair_boarding ?? 0);
  return boarding === WHEELCHAIR_ACCESSIBLE;
}

export function accessibleStopFeatures(
  collection: GeoJSON.FeatureCollection,
): GeoJSON.FeatureCollection {
  const features = collection.features.filter(isAccessibleStop);
  return { type: "FeatureCollection", features };
}

export function isConstructionAdvisory(advisory: LiveAdvisory): boolean {
  const effect = (advisory.effect ?? "").toLowerCase();
  if (effect.includes("detour") || effect.includes("bypass")) return true;
  const text = `${advisory.title} ${advisory.description}`.toLowerCase();
  return CONSTRUCTION_TEXT.test(text);
}

export function constructionAdvisoriesToGeoJSON(
  advisories: LiveAdvisory[],
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const advisory of advisories) {
    if (!isConstructionAdvisory(advisory)) continue;
    if (advisory.lon == null || advisory.lat == null) continue;
    features.push({
      type: "Feature",
      id: advisory.id,
      geometry: { type: "Point", coordinates: [advisory.lon, advisory.lat] },
      properties: {
        id: advisory.id,
        title: advisory.title,
        routes: advisory.routes.join(", "),
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function setOverlayVisibility(
  map: MapLibreMap,
  layerId: string,
  visible: boolean,
): void {
  if (!map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
}

export function accessibleStopLabel(feature: GeoJSON.Feature): string {
  const name = String(feature.properties?.name ?? "Stop");
  const boarding = Number(feature.properties?.wheelchair_boarding ?? 0);
  if (boarding === WHEELCHAIR_ACCESSIBLE) {
    return `${name} — step-free boarding`;
  }
  return name;
}
