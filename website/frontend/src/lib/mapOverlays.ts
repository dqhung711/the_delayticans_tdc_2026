import type { Map as MapLibreMap } from "maplibre-gl";
import type { LiveAdvisory } from "../types";

export const STOPS_SOURCE = "ttc-stops";
export const STOPS_LAYER = "ttc-stops-circle";
export const ACCESSIBLE_STOPS_SOURCE = "ttc-accessible-stops";
export const ACCESSIBLE_STOPS_LAYER = "ttc-accessible-stops-circle";

/** GTFS wheelchair_boarding: 1 = step-free boarding available. */
export const WHEELCHAIR_ACCESSIBLE = 1;

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
