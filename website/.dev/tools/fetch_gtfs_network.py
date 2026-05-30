#!/usr/bin/env python3
"""Download TTC GTFS and build route lines + stop points for the live map."""

from __future__ import annotations

import csv
import gzip
import hashlib
import io
import json
import math
import zipfile
from collections import defaultdict
from pathlib import Path

import httpx

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
ROUTES_BUS_OUT = DATA_DIR / "route-shapes-bus.json"
ROUTES_STREETCAR_OUT = DATA_DIR / "route-shapes-streetcar.json"
ROUTE_MODES_PATH = DATA_DIR / "route-modes.json"
STOPS_OUT = DATA_DIR / "stops.geojson"
STOPS_LOOKUP_OUT = DATA_DIR / "stops-lookup.json"

GTFS_URLS = [
    "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/bd4809dd-e289-4de8-bbde-c5c00dafbf4f/resource/28514055-d011-4ed7-8bb0-97961dfe2b66/download/SurfaceGTFS.zip",
    "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/7795b45e-e65a-4465-81fc-c36b9dfff169/resource/cfb6b2b8-6191-41e3-bda1-b175c51148cb/download/TTC%20Routes%20and%20Schedules%20Data.zip",
]

SUBWAY_SHORT_NAMES = frozenset({"1", "2", "3", "4", "5", "6"})
# GTFS duplicates of 501–512; keep canonical public route numbers only.
LEGACY_STREETCAR_ROUTES = frozenset({"301", "304", "305", "306", "310", "312"})
SKIP_ROUTE_SHORTS = LEGACY_STREETCAR_ROUTES | frozenset({"705"})
MAX_SHAPES_PER_ROUTE_BUS = 4
MAX_SHAPES_PER_ROUTE_STREETCAR = 24

TORONTO_LON_MIN, TORONTO_LON_MAX = -79.639, -79.115
TORONTO_LAT_MIN, TORONTO_LAT_MAX = 43.581, 43.855
# ~5 m bus / ~3 m streetcar at Toronto latitude — keeps corners while dropping redundant vertices.
SIMPLIFY_EPSILON_BUS = 0.00005
SIMPLIFY_EPSILON_STREETCAR = 0.00003
MAP_COORD_DECIMALS_BUS = 4
MAP_COORD_DECIMALS_STREETCAR = 5


def in_toronto_bbox(lon: float, lat: float) -> bool:
    return (
        TORONTO_LON_MIN <= lon <= TORONTO_LON_MAX
        and TORONTO_LAT_MIN <= lat <= TORONTO_LAT_MAX
    )


def clip_line_coords(coords: list[list[float]], mode: str = "bus") -> list[list[float]] | None:
    clipped = [[lon, lat] for lon, lat in coords if in_toronto_bbox(lon, lat)]
    if len(clipped) < 2:
        return None
    return optimize_line_coords(clipped, mode)


def point_line_distance(
    px: float, py: float, x1: float, y1: float, x2: float, y2: float
) -> float:
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def douglas_peucker(coords: list[list[float]], epsilon: float) -> list[list[float]]:
    """Drop collinear vertices; preserves bends better than fixed-step decimation."""
    if len(coords) <= 2:
        return coords
    start, end = coords[0], coords[-1]
    max_dist = 0.0
    index = 0
    for i in range(1, len(coords) - 1):
        dist = point_line_distance(
            coords[i][0], coords[i][1], start[0], start[1], end[0], end[1]
        )
        if dist > max_dist:
            max_dist = dist
            index = i
    if max_dist > epsilon:
        left = douglas_peucker(coords[: index + 1], epsilon)
        right = douglas_peucker(coords[index:], epsilon)
        return left[:-1] + right
    return [start, end]


def optimize_line_coords(coords: list[list[float]], mode: str = "bus") -> list[list[float]]:
    """Simplify + round — enough detail for zoom 9–16 city map tiles."""
    epsilon = SIMPLIFY_EPSILON_STREETCAR if mode == "streetcar" else SIMPLIFY_EPSILON_BUS
    decimals = MAP_COORD_DECIMALS_STREETCAR if mode == "streetcar" else MAP_COORD_DECIMALS_BUS
    simplified = douglas_peucker(coords, epsilon)
    if len(simplified) < 2:
        simplified = coords[:2]
    return [[round(lon, decimals), round(lat, decimals)] for lon, lat in simplified]


def write_geojson(path: Path, data: dict) -> None:
    text = json.dumps(data, separators=(",", ":"))
    path.write_text(text)
    gzip_path = Path(f"{path}.gz")
    gzip_path.write_bytes(gzip.compress(text.encode(), compresslevel=9))


def parse_csv(text: str) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(text)))


def route_color(route_name: str) -> str:
    digest = hashlib.md5(route_name.encode()).hexdigest()
    hue = int(digest[:8], 16) % 360
    mode_offset = 18 if route_name.isdigit() and int(route_name) >= 300 else 0
    return f"hsl({(hue + mode_offset) % 360}, 62%, 52%)"


def infer_mode(route_short: str, route_type: str, db_route_modes: dict[str, str]) -> str:
    short = route_short.strip()
    from_db = db_route_modes.get(short.upper()) or db_route_modes.get(short)
    if from_db in ("bus", "streetcar"):
        return from_db
    if route_type in {"0", "5"}:
        return "streetcar"
    if route_type == "3":
        return "bus"
    digits = "".join(c for c in short if c.isdigit())
    if digits and int(digits) >= 500:
        return "streetcar"
    return "bus"


def route_mode_for_short(
    short: str,
    route_id: str,
    route_mode_by_id: dict[str, str],
    db_route_modes: dict[str, str],
) -> str:
    return (
        db_route_modes.get(short.upper())
        or db_route_modes.get(short)
        or route_mode_by_id.get(route_id, "bus")
    )


def line_mode_for_route(
    short: str,
    route_id: str,
    route_type: str,
    route_mode_by_id: dict[str, str],
    db_route_modes: dict[str, str],
) -> str:
    """Trust GTFS vehicle type; delay-db cannot turn a bus route into streetcar."""
    rt = str(route_type).strip()
    if rt in {"0", "5"}:
        return "streetcar"
    if rt in {"3", "11", "700", "800"}:
        return "bus"
    gtfs = infer_mode(short, route_type, db_route_modes)
    if gtfs == "bus":
        return "bus"
    if gtfs == "streetcar":
        return "streetcar"
    return route_mode_for_short(short, route_id, route_mode_by_id, db_route_modes)


def max_shapes_for_mode(mode: str) -> int:
    return (
        MAX_SHAPES_PER_ROUTE_STREETCAR
        if mode == "streetcar"
        else MAX_SHAPES_PER_ROUTE_BUS
    )


def load_db_route_modes() -> dict[str, str]:
    if not ROUTE_MODES_PATH.exists():
        return {}
    try:
        return json.loads(ROUTE_MODES_PATH.read_text())
    except json.JSONDecodeError:
        return {}


def download_gtfs(url: str) -> bytes | None:
    try:
        response = httpx.get(url, timeout=180.0, follow_redirects=True)
        if response.status_code == 200 and response.content[:2] == b"PK":
            print(f"Downloaded GTFS from {url}")
            return response.content
    except Exception as exc:
        print(f"Failed {url}: {exc}")
    return None


def shape_length(coords: list[list[float]]) -> float:
    total = 0.0
    for i in range(1, len(coords)):
        lon1, lat1 = coords[i - 1]
        lon2, lat2 = coords[i]
        total += ((lon2 - lon1) ** 2 + (lat2 - lat1) ** 2) ** 0.5
    return total


def merge_routes_from_zip(
    content: bytes,
    db_route_modes: dict[str, str],
    merged_lines: dict[tuple[str, str], dict],
) -> None:
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        names = set(archive.namelist())
        required = {"shapes.txt", "trips.txt", "routes.txt", "stops.txt", "stop_times.txt"}
        if not required.issubset(names):
            print(f"  Skipping zip (missing files): {sorted(required - names)}")
            return

        shapes = parse_csv(archive.read("shapes.txt").decode("utf-8-sig"))
        trips = parse_csv(archive.read("trips.txt").decode("utf-8-sig"))
        routes = parse_csv(archive.read("routes.txt").decode("utf-8-sig"))
        stops = parse_csv(archive.read("stops.txt").decode("utf-8-sig"))
        stop_times = parse_csv(archive.read("stop_times.txt").decode("utf-8-sig"))

    route_short: dict[str, str] = {}
    route_mode: dict[str, str] = {}
    for row in routes:
        rid = row["route_id"]
        short = row.get("route_short_name", "").strip()
        if not short or short in SUBWAY_SHORT_NAMES or short in SKIP_ROUTE_SHORTS:
            continue
        route_short[rid] = short
        route_mode[rid] = line_mode_for_route(
            short,
            rid,
            row.get("route_type", ""),
            route_mode,
            db_route_modes,
        )

    trip_route = {row["trip_id"]: row["route_id"] for row in trips}
    trip_shape = {row["trip_id"]: row.get("shape_id", "") for row in trips if row.get("shape_id")}

    shape_points: dict[str, list[list[float]]] = defaultdict(list)
    for row in shapes:
        shape_id = row["shape_id"]
        try:
            lon = float(row["shape_pt_lon"])
            lat = float(row["shape_pt_lat"])
        except (TypeError, ValueError):
            continue
        shape_points[shape_id].append([lon, lat])

    route_shape_ids: dict[str, set[str]] = defaultdict(set)
    for trip_id, shape_id in trip_shape.items():
        route_id = trip_route.get(trip_id, "")
        short = route_short.get(route_id, "")
        if short and shape_id and shape_id in shape_points:
            route_shape_ids[short].add(shape_id)

    shape_added = 0
    for short, shape_ids in route_shape_ids.items():
        if short in SKIP_ROUTE_SHORTS:
            continue
        rid = next((r for r, s in route_short.items() if s == short), "")
        mode = route_mode.get(rid) or route_mode_for_short(
            short, rid, route_mode, db_route_modes
        )
        cap = max_shapes_for_mode(mode)
        sorted_shapes = sorted(
            shape_ids,
            key=lambda sid: shape_length(shape_points[sid]),
            reverse=True,
        )[:cap]
        color = route_color(short)
        for shape_id in sorted_shapes:
            coords = shape_points[shape_id]
            if len(coords) < 2:
                continue
            key = (short, shape_id)
            prev = merged_lines.get(key)
            if prev and shape_length(prev["coords"]) >= shape_length(coords):
                continue
            clipped = clip_line_coords(coords, mode)
            if not clipped:
                continue
            merged_lines[key] = {
                "coords": clipped,
                "mode": mode,
                "color": color,
                "shape_id": shape_id,
            }
            shape_added += 1

    stop_lookup: dict[str, dict] = {}
    for row in stops:
        stop_id = row["stop_id"]
        try:
            lat = float(row["stop_lat"])
            lon = float(row["stop_lon"])
        except (TypeError, ValueError):
            continue
        stop_lookup[stop_id] = {"lat": lat, "lon": lon}

    stop_times_by_trip: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in stop_times:
        stop_times_by_trip[row["trip_id"]].append(row)

    trip_by_route: dict[str, str] = {}
    for row in trips:
        rid = row["route_id"]
        if rid in trip_by_route:
            continue
        short = route_short.get(rid, "")
        if short:
            trip_by_route[rid] = row["trip_id"]

    fallback_added = 0
    for route_id, trip_id in trip_by_route.items():
        short = route_short.get(route_id, "")
        if not short or short in route_shape_ids or short in SKIP_ROUTE_SHORTS:
            continue
        rows = sorted(
            stop_times_by_trip.get(trip_id, []),
            key=lambda r: int(r.get("stop_sequence") or 0),
        )
        coords: list[list[float]] = []
        for row in rows:
            stop = stop_lookup.get(row.get("stop_id", ""))
            if not stop:
                continue
            point = [stop["lon"], stop["lat"]]
            if not coords or coords[-1] != point:
                coords.append(point)
        if len(coords) < 2:
            continue
        shape_id = f"stops-{trip_id}"
        key = (short, shape_id)
        if key in merged_lines:
            continue
        mode = route_mode.get(route_id, "bus")
        clipped = clip_line_coords(coords, mode)
        if not clipped:
            continue
        merged_lines[key] = {
            "coords": clipped,
            "mode": mode,
            "color": route_color(short),
            "shape_id": shape_id,
        }
        fallback_added += 1

    print(f"  +{shape_added} shape lines, +{fallback_added} stop-sequence fallbacks")


def routes_with_line_mode(merged_lines: dict[tuple[str, str], dict], mode: str) -> set[str]:
    found: set[str] = set()
    for (route, _sid), meta in merged_lines.items():
        if meta.get("mode") != mode:
            continue
        found.add(route)
        found.add(route.lstrip("0") or route)
    return found


def trip_coords_from_stops(
    trip_id: str,
    stop_times_by_trip: dict[str, list[dict[str, str]]],
    stop_lookup: dict[str, dict],
    mode: str = "bus",
) -> list[list[float]] | None:
    rows = sorted(
        stop_times_by_trip.get(trip_id, []),
        key=lambda r: int(r.get("stop_sequence") or 0),
    )
    coords: list[list[float]] = []
    for row in rows:
        stop = stop_lookup.get(row.get("stop_id", ""))
        if not stop:
            continue
        point = [stop["lon"], stop["lat"]]
        if not coords or coords[-1] != point:
            coords.append(point)
    return clip_line_coords(coords, mode)


def backfill_mode_routes(
    content: bytes,
    db_route_modes: dict[str, str],
    merged_lines: dict[tuple[str, str], dict],
    mode: str = "streetcar",
) -> int:
    """Stop-sequence lines for route-modes entries that still have no map geometry."""
    wanted = {k for k, v in db_route_modes.items() if v == mode}
    have = routes_with_line_mode(merged_lines, mode)
    missing = {r for r in wanted if r not in have and (r.lstrip("0") or r) not in have}
    if not missing:
        return 0

    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        trips = parse_csv(archive.read("trips.txt").decode("utf-8-sig"))
        routes = parse_csv(archive.read("routes.txt").decode("utf-8-sig"))
        stops = parse_csv(archive.read("stops.txt").decode("utf-8-sig"))
        stop_times = parse_csv(archive.read("stop_times.txt").decode("utf-8-sig"))

    route_short: dict[str, str] = {}
    route_mode: dict[str, str] = {}
    for row in routes:
        rid = row["route_id"]
        short = row.get("route_short_name", "").strip()
        if not short or short in SUBWAY_SHORT_NAMES or short in SKIP_ROUTE_SHORTS:
            continue
        route_short[rid] = short
        route_mode[rid] = line_mode_for_route(
            short,
            rid,
            row.get("route_type", ""),
            route_mode,
            db_route_modes,
        )

    stop_lookup: dict[str, dict] = {}
    for row in stops:
        try:
            stop_lookup[row["stop_id"]] = {
                "lat": float(row["stop_lat"]),
                "lon": float(row["stop_lon"]),
            }
        except (TypeError, ValueError):
            continue

    stop_times_by_trip: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in stop_times:
        stop_times_by_trip[row["trip_id"]].append(row)

    trips_by_short: dict[str, list[str]] = defaultdict(list)
    for row in trips:
        rid = row["route_id"]
        short = route_short.get(rid, "")
        if short:
            trips_by_short[short].append(row["trip_id"])

    added = 0
    for short in sorted(missing):
        if short in SKIP_ROUTE_SHORTS:
            continue
        best_coords: list[list[float]] | None = None
        best_len = 0.0
        for trip_id in trips_by_short.get(short, []):
            coords = trip_coords_from_stops(trip_id, stop_times_by_trip, stop_lookup, mode)
            if not coords:
                continue
            length = shape_length(coords)
            if length > best_len:
                best_len = length
                best_coords = coords
        if not best_coords:
            continue
        rid = next((r for r, s in route_short.items() if s == short), "")
        line_mode = route_mode.get(rid, "bus")
        if line_mode != mode:
            continue
        shape_id = f"backfill-{short}"
        key = (short, shape_id)
        if key in merged_lines:
            continue
        merged_lines[key] = {
            "coords": best_coords,
            "mode": mode,
            "color": route_color(short),
            "shape_id": shape_id,
        }
        added += 1
    return added


def write_stops_from_zip(content: bytes, db_route_modes: dict[str, str]) -> tuple[list[dict], dict[str, dict]]:
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        trips = parse_csv(archive.read("trips.txt").decode("utf-8-sig"))
        routes = parse_csv(archive.read("routes.txt").decode("utf-8-sig"))
        stop_times = parse_csv(archive.read("stop_times.txt").decode("utf-8-sig"))
        stops = parse_csv(archive.read("stops.txt").decode("utf-8-sig"))

    route_short = {row["route_id"]: row.get("route_short_name", "").strip() for row in routes}
    route_mode_map: dict[str, str] = {}
    for row in routes:
        rid = row["route_id"]
        short = route_short.get(rid, "")
        if not short:
            continue
        gtfs_mode = infer_mode(short, row.get("route_type", ""), db_route_modes)
        route_mode_map[rid] = route_mode_for_short(short, rid, route_mode_map, db_route_modes)

    trip_route = {row["trip_id"]: row["route_id"] for row in trips}
    stop_modes: dict[str, set[str]] = defaultdict(set)
    for row in stop_times:
        trip_id = row.get("trip_id", "")
        stop_id = row.get("stop_id", "")
        route_id = trip_route.get(trip_id)
        if not stop_id or not route_id:
            continue
        stop_modes[stop_id].add(route_mode_map.get(route_id, "bus"))

    stop_lookup: dict[str, dict] = {}
    stop_features = []
    for row in stops:
        stop_id = row["stop_id"]
        name = (row.get("stop_name") or "").strip()
        try:
            lat = float(row["stop_lat"])
            lon = float(row["stop_lon"])
        except (TypeError, ValueError):
            continue
        if not in_toronto_bbox(lon, lat):
            continue
        modes = sorted(stop_modes.get(stop_id, {"bus"}))
        primary_mode = "streetcar" if "streetcar" in modes else modes[0] if modes else "bus"
        wheelchair_raw = (row.get("wheelchair_boarding") or "").strip()
        try:
            wheelchair_boarding = int(wheelchair_raw) if wheelchair_raw else 0
        except ValueError:
            wheelchair_boarding = 0
        stop_lookup[stop_id] = {
            "lat": round(lat, MAP_COORD_DECIMALS_STREETCAR),
            "lon": round(lon, MAP_COORD_DECIMALS_STREETCAR),
            "name": name,
            "modes": modes,
            "wheelchair_boarding": wheelchair_boarding,
        }
        stop_lookup[name.lower()] = stop_lookup[stop_id]
        stop_features.append(
            {
                "type": "Feature",
                "properties": {
                    "stop_id": stop_id,
                    "name": name,
                    "mode": primary_mode,
                    "modes": modes,
                    "wheelchair_boarding": wheelchair_boarding,
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [
                        round(lon, MAP_COORD_DECIMALS_STREETCAR),
                        round(lat, MAP_COORD_DECIMALS_STREETCAR),
                    ],
                },
            }
        )
    return stop_features, stop_lookup


def main() -> None:
    db_route_modes = load_db_route_modes()
    merged_lines: dict[tuple[str, str], dict] = {}
    primary_zip: bytes | None = None

    zip_payloads: list[bytes] = []
    for url in GTFS_URLS:
        content = download_gtfs(url)
        if content:
            if primary_zip is None:
                primary_zip = content
            zip_payloads.append(content)
            merge_routes_from_zip(content, db_route_modes, merged_lines)

    for content in zip_payloads:
        added = backfill_mode_routes(content, db_route_modes, merged_lines, "streetcar")
        if added:
            print(f"  backfilled {added} streetcar routes from stop sequences")

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if not merged_lines:
        write_geojson(ROUTES_BUS_OUT, {"type": "FeatureCollection", "features": []})
        write_geojson(ROUTES_STREETCAR_OUT, {"type": "FeatureCollection", "features": []})
        STOPS_OUT.write_text(json.dumps({"type": "FeatureCollection", "features": []}))
        STOPS_LOOKUP_OUT.write_text("{}")
        print("GTFS download failed; wrote empty map files.")
        return

    by_mode: dict[str, list[dict]] = defaultdict(list)
    for (route, _shape_id), meta in sorted(merged_lines.items()):
        if route in SKIP_ROUTE_SHORTS:
            continue
        feat = {
            "type": "Feature",
            "properties": {
                "route": route,
                "color": meta["color"],
            },
            "geometry": {"type": "LineString", "coordinates": meta["coords"]},
        }
        by_mode[meta["mode"]].append(feat)

    route_features = by_mode["bus"] + by_mode["streetcar"]

    write_geojson(ROUTES_BUS_OUT, {"type": "FeatureCollection", "features": by_mode["bus"]})
    write_geojson(
        ROUTES_STREETCAR_OUT,
        {"type": "FeatureCollection", "features": by_mode["streetcar"]},
    )

    stop_features: list[dict] = []
    stop_lookup: dict[str, dict] = {}
    if primary_zip:
        stop_features, stop_lookup = write_stops_from_zip(primary_zip, db_route_modes)

    write_geojson(STOPS_OUT, {"type": "FeatureCollection", "features": stop_features})
    STOPS_LOOKUP_OUT.write_text(json.dumps(stop_lookup, separators=(",", ":")))

    routes_unique = len({f["properties"]["route"] for f in route_features})
    bus_mb = ROUTES_BUS_OUT.stat().st_size / 1_000_000 if ROUTES_BUS_OUT.exists() else 0
    sc_mb = ROUTES_STREETCAR_OUT.stat().st_size / 1_000_000 if ROUTES_STREETCAR_OUT.exists() else 0
    print(f"Routes: {len(route_features)} lines ({routes_unique} unique route numbers)")
    print(f"  bus {len(by_mode['bus'])} lines ({bus_mb:.2f} MB) -> {ROUTES_BUS_OUT}")
    print(f"  streetcar {len(by_mode['streetcar'])} lines ({sc_mb:.2f} MB) -> {ROUTES_STREETCAR_OUT}")
    print(f"Stops: {len(stop_features)} points -> {STOPS_OUT}")
    print(f"Stop lookup: {len(stop_lookup)} keys -> {STOPS_LOOKUP_OUT}")


if __name__ == "__main__":
    main()
