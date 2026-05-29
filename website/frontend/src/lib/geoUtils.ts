import { apiUrl } from "./appConfig";

/** Haversine distance in km between two WGS84 points */
export function distanceKm(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function filterStopsWithinRadius(
  collection: GeoJSON.FeatureCollection,
  centerLon: number,
  centerLat: number,
  radiusKm: number,
): GeoJSON.FeatureCollection {
  const features = collection.features.filter((f) => {
    if (f.geometry?.type !== "Point") return false;
    const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates;
    return distanceKm(centerLon, centerLat, lon, lat) <= radiusKm;
  });
  return { type: "FeatureCollection", features };
}

export interface GeocodeResult {
  lat: number;
  lon: number;
  display_name: string;
  type?: string;
}

export async function searchAddresses(query: string): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const res = await fetch(apiUrl(`/api/geocode/search?${new URLSearchParams({ q })}`));
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: GeocodeResult[] };
  return data.results ?? [];
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const results = await searchAddresses(query);
  return results[0] ?? null;
}
