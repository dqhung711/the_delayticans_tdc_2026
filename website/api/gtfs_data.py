"""Load GTFS-derived stops and routes for map geocoding."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
STOPS_LOOKUP_PATH = DATA_DIR / "stops-lookup.json"
ROUTE_SHAPES_PATH = DATA_DIR / "route-shapes.json"

# Greater Toronto surface transit area (exclude bad geocodes outside the city)
TORONTO_LON_MIN, TORONTO_LON_MAX = -79.65, -79.11
TORONTO_LAT_MIN, TORONTO_LAT_MAX = 43.58, 43.86


def in_toronto_bbox(lon: float, lat: float) -> bool:
    return (
        TORONTO_LON_MIN <= lon <= TORONTO_LON_MAX
        and TORONTO_LAT_MIN <= lat <= TORONTO_LAT_MAX
    )


@lru_cache(maxsize=1)
def get_stops_lookup() -> dict:
    if not STOPS_LOOKUP_PATH.exists():
        return {}
    try:
        return json.loads(STOPS_LOOKUP_PATH.read_text())
    except json.JSONDecodeError:
        return {}


def lookup_stop(stop_id: str) -> tuple[float, float] | None:
    entry = get_stops_lookup().get(stop_id)
    if not entry or "lat" not in entry:
        return None
    return float(entry["lon"]), float(entry["lat"])


def lookup_stop_name(text: str) -> tuple[float, float] | None:
    key = text.strip().lower()
    if not key:
        return None
    lookup = get_stops_lookup()
    if key in lookup and "lat" in lookup[key]:
        e = lookup[key]
        return float(e["lon"]), float(e["lat"])
    for name, entry in lookup.items():
        if len(name) < 4 or "lat" not in entry:
            continue
        if name in key or key in name:
            return float(entry["lon"]), float(entry["lat"])
    return None


def _street_tokens(text: str) -> list[str]:
    """Parse intersection / street strings from delay CSV Location column."""
    cleaned = re.sub(r"\s+", " ", (text or "").strip().upper())
    if not cleaned:
        return []
    cleaned = re.sub(
        r"\b(STN|STATION|LOOP|YARD|CARHOUSE|CAR HOUSE|BARN|BARNS|SEL)\b",
        "",
        cleaned,
    )
    parts = re.split(r"\s+AND\s+|\s*&\s*|\s+AT\s+|/", cleaned)
    tokens: list[str] = []
    for part in parts:
        p = re.sub(
            r"\b(N|S|E|W|NB|SB|EB|WB|N/B|S/B|E/B|W/B|NORTH|SOUTH|EAST|WEST)\b",
            "",
            part,
        ).strip()
        p = re.sub(r"[^A-Z0-9\s'-]", "", p).strip().lower()
        if len(p) >= 3:
            tokens.append(p)
    return tokens


def _street_matches_stop_name(name: str, street: str) -> bool:
    return bool(re.search(rf"\b{re.escape(street)}\b", name, re.I))


def _median_centroid(points: list[tuple[float, float]]) -> tuple[float, float] | None:
    if not points:
        return None
    if len(points) > 48:
        points = sorted(points, key=lambda p: (p[0], p[1]))
        mid = len(points) // 2
        points = points[mid - 24 : mid + 24]
    lons = sorted(p[0] for p in points)
    lats = sorted(p[1] for p in points)
    return lons[len(lons) // 2], lats[len(lats) // 2]


def lookup_intersection(text: str) -> tuple[float, float] | None:
    streets = _street_tokens(text)
    if len(streets) < 2:
        return None
    lookup = get_stops_lookup()
    points: list[tuple[float, float]] = []
    for name, entry in lookup.items():
        if len(name) < 6 or "lat" not in entry:
            continue
        if not all(_street_matches_stop_name(name, s) for s in streets[:2]):
            continue
        lon, lat = float(entry["lon"]), float(entry["lat"])
        if not in_toronto_bbox(lon, lat):
            continue
        points.append((lon, lat))
    return _median_centroid(points)


def lookup_street_corridor(text: str) -> tuple[float, float] | None:
    streets = _street_tokens(text)
    if len(streets) != 1:
        return None
    street = streets[0]
    lookup = get_stops_lookup()
    points: list[tuple[float, float]] = []
    for name, entry in lookup.items():
        if len(name) < 5 or "lat" not in entry:
            continue
        if not _street_matches_stop_name(name, street):
            continue
        lon, lat = float(entry["lon"]), float(entry["lat"])
        if not in_toronto_bbox(lon, lat):
            continue
        points.append((lon, lat))
    return _median_centroid(points)


def lookup_delay_location(text: str) -> tuple[float, float] | None:
    """Resolve delay CSV Location to coordinates using GTFS stop names."""
    if not (text or "").strip():
        return None
    coords = lookup_stop_name(text)
    if coords and in_toronto_bbox(coords[0], coords[1]):
        return coords
    coords = lookup_intersection(text)
    if coords:
        return coords
    coords = lookup_street_corridor(text)
    if coords and in_toronto_bbox(coords[0], coords[1]):
        return coords
    return None


def geocode_station_names(names: list[str]) -> tuple[float | None, float | None]:
    """Resolve TTC station names from live alerts (stopIDList) to coordinates."""
    points: list[tuple[float, float]] = []
    for raw in names:
        name = (raw or "").strip()
        if not name:
            continue
        for candidate in (
            name,
            f"{name} station",
            name.replace(" Station", ""),
            f"{name.replace(' Station', '')} station",
        ):
            coords = lookup_stop_name(candidate)
            if coords:
                points.append(coords)
                break
    if not points:
        return None, None
    if len(points) == 1:
        return points[0]
    lon = sum(p[0] for p in points) / len(points)
    lat = sum(p[1] for p in points) / len(points)
    return lon, lat


def geocode_advisory_text(
    header: str,
    description: str,
    stop_ids: list[str],
) -> tuple[float | None, float | None]:
    station_coords = geocode_station_names(stop_ids)
    if station_coords[0] is not None:
        return station_coords

    for stop_id in stop_ids:
        coords = lookup_stop(stop_id)
        if coords:
            return coords

    haystack = f"{header} {description}"
    lower = haystack.lower()

    coords = lookup_stop_name(haystack)
    if coords:
        return coords

    # Longest stop-name substring match in advisory text (GTFS stop names).
    best: tuple[float, float] | None = None
    best_len = 0
    for name, entry in get_stops_lookup().items():
        if len(name) < 6 or "lat" not in entry:
            continue
        if name in lower and len(name) > best_len:
            best_len = len(name)
            best = (float(entry["lon"]), float(entry["lat"]))
    if best:
        return best

    STATION_ALIASES = {
        "finch station": "finch station",
        "finch stn": "finch station",
        "union station": "union station",
        "bloor station": "bloor station",
        "spadina station": "spadina station",
        "pape station": "pape station",
        "kennedy station": "kennedy station",
        "dundas station": "dundas station",
        "queen station": "queen station",
        "college station": "college station",
        "davisville station": "davisville station",
    }
    for needle, canonical in STATION_ALIASES.items():
        if needle in lower:
            coords = lookup_stop_name(canonical)
            if coords:
                return coords

    match = re.search(r"at\s+([A-Za-z0-9][A-Za-z0-9\s&'.-]{3,40})", haystack, re.I)
    if match:
        coords = lookup_stop_name(match.group(1))
        if coords:
            return coords

    return None, None


@lru_cache(maxsize=1)
def get_route_shapes() -> dict[str, list[tuple[float, float]]]:
    """Route id -> line coordinates (lon, lat)."""
    if not ROUTE_SHAPES_PATH.exists():
        return {}
    try:
        data = json.loads(ROUTE_SHAPES_PATH.read_text())
    except json.JSONDecodeError:
        return {}
    out: dict[str, list[tuple[float, float]]] = {}
    for feature in data.get("features", []):
        geom = feature.get("geometry") or {}
        if geom.get("type") != "LineString":
            continue
        route = str((feature.get("properties") or {}).get("route", "")).strip()
        if not route:
            continue
        coords = [(float(c[0]), float(c[1])) for c in geom.get("coordinates", []) if len(c) >= 2]
        if coords:
            key = route.upper()
            out[key] = coords
            norm = route.lstrip("0").upper() or key
            out.setdefault(norm, coords)
    return out


def geocode_route_center(route: str) -> tuple[float | None, float | None]:
    """Midpoint of GTFS route shape for bus/streetcar lines."""
    raw = (route or "").strip().upper()
    if not raw:
        return None, None
    shapes = get_route_shapes()
    coords = shapes.get(raw)
    if not coords:
        digits = re.sub(r"\D", "", raw)
        if digits:
            coords = shapes.get(digits) or shapes.get(digits.lstrip("0") or digits)
    if not coords and re.search(r"[A-Z]+$", raw):
        base = re.sub(r"[A-Z]+$", "", raw)
        coords = shapes.get(base) or shapes.get(re.sub(r"\D", "", base))
    if not coords:
        return None, None
    mid = coords[len(coords) // 2]
    return mid[0], mid[1]


def geocode_from_title_stations(title: str) -> tuple[float | None, float | None]:
    """Find coordinates from '… Station' mentions in alert titles."""
    points: list[tuple[float, float]] = []
    for match in re.finditer(
        r"([A-Za-z][A-Za-z\s'-]{1,40}?)\s+Station\b",
        title,
        re.I,
    ):
        name = match.group(1).strip()
        coords = geocode_station_names([name, f"{name} Station"])
        if coords[0] is not None:
            points.append(coords)
    if not points:
        return None, None
    if len(points) == 1:
        return points[0]
    lon = sum(p[0] for p in points) / len(points)
    lat = sum(p[1] for p in points) / len(points)
    return lon, lat


def resolve_alert_coordinates(
    header: str,
    description: str,
    stops: list[str],
    routes: list[str],
) -> tuple[float | None, float | None]:
    """Best-effort exact location: stops → text → stations in title → route shape."""
    lon, lat = geocode_advisory_text(header, description, stops)
    if lon is not None and lat is not None:
        return lon, lat

    lon, lat = geocode_from_title_stations(f"{header} {description}")
    if lon is not None and lat is not None:
        return lon, lat

    for route in routes:
        lon, lat = geocode_route_center(route)
        if lon is not None and lat is not None:
            return lon, lat
    return None, None
