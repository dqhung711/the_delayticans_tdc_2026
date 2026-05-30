"""Load GTFS-derived stops and routes for map geocoding."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
STOPS_LOOKUP_PATH = DATA_DIR / "stops-lookup.json"
ROUTE_SHAPES_BUS_PATH = DATA_DIR / "route-shapes-bus.json"
ROUTE_SHAPES_STREETCAR_PATH = DATA_DIR / "route-shapes-streetcar.json"
STOPS_GEOJSON_PATH = DATA_DIR / "stops.geojson"

_shapes_cache: dict[str, dict] = {}
_shapes_bytes: dict[str, tuple[bytes, str, bool]] = {}
_shape_file_mtimes: dict[str, float] = {}
_stops_cache: dict | None = None
_stops_bytes: tuple[bytes, str] | None = None
_stops_file_mtime: float = 0.0


def _load_stops_from_disk() -> dict:
    """Load stops.geojson; reload when the file changes on disk."""
    global _stops_cache, _stops_bytes, _stops_file_mtime
    if not STOPS_GEOJSON_PATH.exists():
        _stops_cache = {"type": "FeatureCollection", "features": []}
        _stops_file_mtime = 0.0
        return _stops_cache
    mtime = STOPS_GEOJSON_PATH.stat().st_mtime
    if _stops_cache is not None and _stops_file_mtime == mtime:
        return _stops_cache
    _stops_cache = filter_stops_geojson(json.loads(STOPS_GEOJSON_PATH.read_text()))
    _stops_file_mtime = mtime
    _stops_bytes = None
    return _stops_cache

# City of Toronto — keep in sync with frontend/src/lib/torontoBounds.ts
TORONTO_LON_MIN, TORONTO_LON_MAX = -79.639, -79.115
TORONTO_LAT_MIN, TORONTO_LAT_MAX = 43.581, 43.855


def in_toronto_bbox(lon: float, lat: float) -> bool:
    return (
        TORONTO_LON_MIN <= lon <= TORONTO_LON_MAX
        and TORONTO_LAT_MIN <= lat <= TORONTO_LAT_MAX
    )


def clip_linestring_to_bbox(coords: list) -> list | None:
    """Keep in-bbox vertices only; drop lines with fewer than 2 points."""
    if not coords:
        return None
    clipped: list = []
    for pt in coords:
        if len(pt) < 2:
            continue
        lon, lat = float(pt[0]), float(pt[1])
        if in_toronto_bbox(lon, lat):
            clipped.append([lon, lat])
    return clipped if len(clipped) >= 2 else None


def filter_route_shapes_geojson(data: dict) -> dict:
    features = []
    for feat in data.get("features") or []:
        geom = feat.get("geometry") or {}
        if geom.get("type") != "LineString":
            continue
        clipped = clip_linestring_to_bbox(geom.get("coordinates") or [])
        if not clipped:
            continue
        features.append(
            {
                **feat,
                "geometry": {"type": "LineString", "coordinates": clipped},
            }
        )
    return {"type": "FeatureCollection", "features": features}


def filter_stops_geojson(data: dict) -> dict:
    features = []
    for feat in data.get("features") or []:
        geom = feat.get("geometry") or {}
        if geom.get("type") != "Point":
            continue
        coords = geom.get("coordinates") or []
        if len(coords) < 2:
            continue
        lon, lat = float(coords[0]), float(coords[1])
        if not in_toronto_bbox(lon, lat):
            continue
        features.append(feat)
    return {"type": "FeatureCollection", "features": features}


def route_shapes_path_for_mode(mode: str | None) -> Path:
    if mode == "streetcar":
        return ROUTE_SHAPES_STREETCAR_PATH
    return ROUTE_SHAPES_BUS_PATH


def _load_route_shapes_from_disk(mode: str) -> dict:
    path = route_shapes_path_for_mode(mode)
    if not path.exists():
        return {"type": "FeatureCollection", "features": []}
    return json.loads(path.read_text())


def get_route_shapes_geojson(mode: str | None = None) -> dict:
    """Cached route lines from per-mode files built by fetch-network."""
    if mode not in ("bus", "streetcar"):
        return {"type": "FeatureCollection", "features": []}

    cache_key = mode
    path = route_shapes_path_for_mode(mode)
    mtime = path.stat().st_mtime if path.exists() else 0.0
    if cache_key in _shapes_cache and _shape_file_mtimes.get(cache_key) == mtime:
        cached = _shapes_cache[cache_key]
        if cached.get("features") or not path.exists() or path.stat().st_size <= 64:
            return cached
        del _shapes_cache[cache_key]
        _shapes_bytes.pop(mode, None)

    if not path.exists():
        empty = {"type": "FeatureCollection", "features": []}
        _shapes_cache[cache_key] = empty
        _shape_file_mtimes[cache_key] = 0.0
        return empty

    data = _load_route_shapes_from_disk(mode)
    _shapes_cache[cache_key] = data
    _shape_file_mtimes[cache_key] = mtime
    return data


def warm_map_payloads() -> None:
    """Pre-load and serialize map GeoJSON once at startup for fast responses."""
    global _stops_bytes
    warm_location_geocoder()
    for mode in ("bus", "streetcar"):
        get_route_shapes_response(mode)

    _load_stops_from_disk()
    stops = get_stops_geojson()
    if STOPS_GEOJSON_PATH.exists():
        etag = f'"{int(STOPS_GEOJSON_PATH.stat().st_mtime)}"'
    else:
        etag = '"0"'
    _stops_bytes = (
        json.dumps(stops, separators=(",", ":")).encode(),
        etag,
    )


def _gzip_path_for(path: Path) -> Path:
    return Path(f"{path}.gz")


def get_route_shapes_response(mode: str | None = None) -> tuple[bytes, str, bool] | None:
    """Return (body, etag, is_precompressed). Reloads when data files change."""
    if mode not in ("bus", "streetcar"):
        return None

    path = route_shapes_path_for_mode(mode)
    if not path.exists():
        return None

    mtime = path.stat().st_mtime
    etag = f'"{int(mtime)}"'
    prev = _shapes_bytes.get(mode)
    if prev and _shape_file_mtimes.get(mode) == mtime:
        return prev

    get_route_shapes_geojson(mode)
    gz_path = _gzip_path_for(path)
    if gz_path.exists() and gz_path.stat().st_mtime >= mtime:
        packed: tuple[bytes, str, bool] = (gz_path.read_bytes(), etag, True)
    else:
        data = _shapes_cache[mode]
        packed = (json.dumps(data, separators=(",", ":")).encode(), etag, False)

    _shapes_bytes[mode] = packed
    _shape_file_mtimes[mode] = mtime
    return packed


def get_stops_response(mode: str | None = None) -> tuple[bytes, str] | None:
    global _stops_bytes
    if mode and mode in ("bus", "streetcar"):
        data = get_stops_geojson(mode)
        if STOPS_GEOJSON_PATH.exists():
            etag = f'"{int(STOPS_GEOJSON_PATH.stat().st_mtime)}"'
        else:
            etag = '"0"'
        return json.dumps(data, separators=(",", ":")).encode(), etag
    if _stops_bytes:
        return _stops_bytes
    data = get_stops_geojson()
    etag = f'"{int(STOPS_GEOJSON_PATH.stat().st_mtime)}"' if STOPS_GEOJSON_PATH.exists() else '"0"'
    body = json.dumps(data, separators=(",", ":")).encode()
    _stops_bytes = (body, etag)
    return body, etag


def get_stops_geojson(mode: str | None = None) -> dict:
    data = _load_stops_from_disk()

    if not mode or mode not in ("bus", "streetcar"):
        return data

    features = [
        f
        for f in data.get("features", [])
        if mode
        in (f.get("properties") or {}).get(
            "modes", [(f.get("properties") or {}).get("mode")]
        )
    ]
    return {"type": "FeatureCollection", "features": features}


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


_STOP_TOKEN_INDEX: dict[str, list[tuple[float, float, str]]] | None = None


def _build_stop_token_index() -> dict[str, list[tuple[float, float, str]]]:
    """Word → stops on that street; speeds up intersection / corridor geocoding."""
    index: dict[str, list[tuple[float, float, str]]] = defaultdict(list)
    lookup = get_stops_lookup()
    for name, entry in lookup.items():
        if len(name) < 5 or "lat" not in entry:
            continue
        lon, lat = float(entry["lon"]), float(entry["lat"])
        if not in_toronto_bbox(lon, lat):
            continue
        for token in set(re.findall(r"[a-z0-9']{3,}", name)):
            index[token].append((lon, lat, name))
    return dict(index)


def _stop_token_index() -> dict[str, list[tuple[float, float, str]]]:
    global _STOP_TOKEN_INDEX
    if _STOP_TOKEN_INDEX is None:
        _STOP_TOKEN_INDEX = _build_stop_token_index()
    return _STOP_TOKEN_INDEX


def warm_location_geocoder() -> None:
    """Build stop token index once for fast heatmap geocoding."""
    _stop_token_index()


@lru_cache(maxsize=8192)
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
    index = _stop_token_index()
    candidates = index.get(streets[0], [])
    if not candidates:
        return None
    points: list[tuple[float, float]] = []
    for lon, lat, name in candidates:
        if not all(_street_matches_stop_name(name, s) for s in streets[:2]):
            continue
        points.append((lon, lat))
    return _median_centroid(points)


def lookup_street_corridor(text: str) -> tuple[float, float] | None:
    streets = _street_tokens(text)
    if len(streets) != 1:
        return None
    street = streets[0]
    index = _stop_token_index()
    points = [
        (lon, lat)
        for lon, lat, name in index.get(street, [])
        if _street_matches_stop_name(name, street)
    ]
    return _median_centroid(points)


@lru_cache(maxsize=8192)
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
    """Route id -> line coordinates (lon, lat) from split bus/streetcar files."""
    out: dict[str, list[tuple[float, float]]] = {}
    for mode in ("bus", "streetcar"):
        path = route_shapes_path_for_mode(mode)
        if not path.exists():
            continue
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError:
            continue
        for feature in data.get("features", []):
            geom = feature.get("geometry") or {}
            if geom.get("type") != "LineString":
                continue
            route = str((feature.get("properties") or {}).get("route", "")).strip()
            if not route:
                continue
            coords = [
                (float(c[0]), float(c[1]))
                for c in geom.get("coordinates", [])
                if len(c) >= 2
            ]
            if not coords:
                continue
            key = route.upper()
            if key not in out or len(coords) > len(out[key]):
                out[key] = coords
            norm = route.lstrip("0").upper() or key
            if norm not in out or len(coords) > len(out[norm]):
                out[norm] = coords
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
