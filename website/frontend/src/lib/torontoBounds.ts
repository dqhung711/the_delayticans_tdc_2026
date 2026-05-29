/** Greater Toronto transit area — keep in sync with website/api/gtfs_data.py */
export const TORONTO_BBOX = {
  west: -79.65,
  east: -79.11,
  south: 43.58,
  north: 43.86,
} as const;

/** Slightly padded bounds for MapLibre maxBounds (SW, NE). */
export const TORONTO_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-79.72, 43.52],
  [-79.04, 43.92],
];

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
