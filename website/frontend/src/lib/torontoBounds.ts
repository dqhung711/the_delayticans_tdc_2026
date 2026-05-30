/** City of Toronto — keep in sync with website/api/gtfs_data.py and fetch_gtfs_network.py */
export const TORONTO_BBOX = {
  west: -79.639,
  east: -79.115,
  south: 43.581,
  north: 43.855,
} as const;

/** Tight maxBounds so the map cannot pan outside Toronto. */
export const TORONTO_MAX_BOUNDS: [[number, number], [number, number]] = [
  [TORONTO_BBOX.west - 0.015, TORONTO_BBOX.south - 0.015],
  [TORONTO_BBOX.east + 0.015, TORONTO_BBOX.north + 0.015],
];

/** Prevent zooming out to empty areas outside the city. */
export const TORONTO_MIN_ZOOM = 9.5;

export function inTorontoBbox(lon: number, lat: number): boolean {
  return (
    lon >= TORONTO_BBOX.west &&
    lon <= TORONTO_BBOX.east &&
    lat >= TORONTO_BBOX.south &&
    lat <= TORONTO_BBOX.north
  );
}

function clipLineString(coords: [number, number][]): [number, number][] | null {
  const clipped = coords.filter(([lon, lat]) => inTorontoBbox(lon, lat));
  return clipped.length >= 2 ? clipped : null;
}

export function filterRouteShapesToToronto(
  collection: GeoJSON.FeatureCollection,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const feat of collection.features) {
    if (feat.geometry?.type !== "LineString") continue;
    const clipped = clipLineString(feat.geometry.coordinates as [number, number][]);
    if (!clipped) continue;
    features.push({
      ...feat,
      geometry: { type: "LineString", coordinates: clipped },
    });
  }
  return { type: "FeatureCollection", features };
}

export function filterPointsToToronto(
  collection: GeoJSON.FeatureCollection,
): GeoJSON.FeatureCollection {
  const features = collection.features.filter((feat) => {
    if (feat.geometry?.type !== "Point") return false;
    const [lon, lat] = feat.geometry.coordinates as [number, number];
    return inTorontoBbox(lon, lat);
  });
  return { type: "FeatureCollection", features };
}
