import sqlite3
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).resolve().parents[1] / "data" / "delays.db"


def get_conn() -> sqlite3.Connection:
    if not DB_PATH.exists():
        raise FileNotFoundError(
            f"Database not found at {DB_PATH}. "
            "Run: cd website && npm run prepare-data"
        )
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def build_where(
    mode: str,
    interval: dict[str, str],
    directions: list[str],
    routes: list[str],
) -> tuple[str, list[Any]]:
    clauses = ["report_datetime >= ?", "report_datetime <= ?"]
    values: list[Any] = [interval["start"], interval["end"]]

    if mode in ("bus", "streetcar"):
        clauses.append("mode = ?")
        values.append(mode)

    if directions:
        placeholders = ", ".join("?" for _ in directions)
        clauses.append(f"direction IN ({placeholders})")
        values.extend(directions)

    if routes:
        placeholders = ", ".join("?" for _ in routes)
        clauses.append(f"route IN ({placeholders})")
        values.extend(routes)

    return " AND ".join(clauses), values


def get_meta() -> dict[str, Any]:
    with get_conn() as conn:
        overall = conn.execute(
            "SELECT MIN(year) AS min_year, MAX(year) AS max_year, COUNT(*) AS total FROM delays"
        ).fetchone()
        by_mode = conn.execute(
            "SELECT mode, COUNT(*) AS total FROM delays GROUP BY mode ORDER BY mode"
        ).fetchall()
    return {
        "overall": dict(overall),
        "byMode": [dict(row) for row in by_mode],
    }


def get_summary(mode: str, interval: dict[str, str], directions: list[str], routes: list[str]):
    where, values = build_where(mode, interval, directions, routes)
    with get_conn() as conn:
        row = conn.execute(
            f"""
            SELECT COUNT(*) AS incidents,
                   COALESCE(SUM(min_delay), 0) AS total_delay,
                   COALESCE(SUM(min_gap), 0) AS total_gap
            FROM delays WHERE {where}
            """,
            values,
        ).fetchone()
    return dict(row)


def get_routes(mode: str):
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT route, COUNT(*) AS incidents
            FROM delays
            WHERE mode = ? AND route != ''
            GROUP BY route
            ORDER BY incidents DESC
            LIMIT 500
            """,
            (mode,),
        ).fetchall()
    return [dict(row) for row in rows]


def get_time_series(mode: str, interval: dict[str, str], directions: list[str], routes: list[str], bucket: str):
    bucket_expr = {
        "hour": "strftime('%Y-%m-%d %H:00', report_datetime)",
        "day": "report_date",
        "month": "strftime('%Y-%m', report_datetime)",
        "year": "CAST(year AS TEXT)",
    }.get(bucket, "CAST(year AS TEXT)")
    where, values = build_where(mode, interval, directions, routes)
    with get_conn() as conn:
        rows = conn.execute(
            f"""
            SELECT {bucket_expr} AS bucket,
                   COALESCE(SUM(min_delay), 0) AS delay_minutes,
                   COALESCE(SUM(min_gap), 0) AS gap_minutes,
                   COUNT(*) AS incidents
            FROM delays WHERE {where}
            GROUP BY bucket ORDER BY bucket
            """,
            values,
        ).fetchall()
    return [dict(row) for row in rows]


def get_hourly_totals(mode: str, interval: dict[str, str], directions: list[str], routes: list[str]):
    where, values = build_where(mode, interval, directions, routes)
    with get_conn() as conn:
        rows = conn.execute(
            f"""
            SELECT CAST(strftime('%H', report_datetime) AS INTEGER) AS hour,
                   COALESCE(SUM(min_delay), 0) AS delay_minutes,
                   COALESCE(SUM(min_gap), 0) AS gap_minutes
            FROM delays WHERE {where}
            GROUP BY hour ORDER BY hour
            """,
            values,
        ).fetchall()
    return [dict(row) for row in rows]


def get_categories(mode: str, interval: dict[str, str], directions: list[str], routes: list[str]):
    where, values = build_where(mode, interval, directions, routes)
    with get_conn() as conn:
        rows = conn.execute(
            f"""
            SELECT incident_category AS category,
                   COALESCE(SUM(min_delay), 0) AS delay_minutes,
                   COUNT(*) AS incidents
            FROM delays WHERE {where}
            GROUP BY incident_category
            ORDER BY delay_minutes DESC
            """,
            values,
        ).fetchall()
    return [dict(row) for row in rows]


def get_route_delay_totals(
    mode: str,
    interval: dict[str, str],
    directions: list[str],
    routes: list[str],
    limit: int = 400,
):
    where, values = build_where(mode, interval, directions, routes)
    with get_conn() as conn:
        rows = conn.execute(
            f"""
            SELECT route,
                   COALESCE(SUM(min_delay), 0) AS delay_minutes,
                   COALESCE(SUM(min_gap), 0) AS gap_minutes,
                   COUNT(*) AS incidents
            FROM delays
            WHERE {where} AND route != ''
            GROUP BY route
            ORDER BY delay_minutes DESC
            LIMIT ?
            """,
            [*values, limit],
        ).fetchall()
    return [dict(row) for row in rows]


_hotspot_cache: dict[tuple, tuple[float, dict]] = {}


def get_delay_hotspots_geojson(
    mode: str,
    interval: dict[str, str],
    directions: list[str],
    routes: list[str],
    limit: int = 350,
):
    from gtfs_data import in_toronto_bbox, lookup_delay_location, warm_location_geocoder

    warm_location_geocoder()

    cache_key = (
        mode,
        interval["start"],
        interval["end"],
        tuple(sorted(directions)),
        tuple(sorted(routes)),
        limit,
    )
    db_mtime = DB_PATH.stat().st_mtime if DB_PATH.exists() else 0.0
    cached = _hotspot_cache.get(cache_key)
    if cached and cached[0] == db_mtime:
        return cached[1]

    where, values = build_where(mode, interval, directions, routes)
    sql_limit = min(max(limit * 3, 600), 1500)
    with get_conn() as conn:
        rows = conn.execute(
            f"""
            SELECT location,
                   COALESCE(SUM(min_delay), 0) AS delay_minutes,
                   COUNT(*) AS incidents
            FROM delays
            WHERE {where} AND location != ''
            GROUP BY location
            HAVING COUNT(*) >= 2 OR SUM(min_delay) >= 15
            ORDER BY delay_minutes DESC
            LIMIT ?
            """,
            [*values, sql_limit],
        ).fetchall()

    features = []
    weights: list[float] = []
    for row in rows:
        if len(features) >= limit:
            break
        coords = lookup_delay_location(row["location"])
        if not coords:
            continue
        lon, lat = coords
        if not in_toronto_bbox(lon, lat):
            continue
        weight = float(row["delay_minutes"]) or float(row["incidents"])
        weights.append(weight)
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "weight_norm": 0.0,
                },
            }
        )

    if features:
        max_w = max(weights) or 1.0
        for feat, w in zip(features, weights):
            feat["properties"]["weight_norm"] = round(w / max_w, 4)

    result = {"type": "FeatureCollection", "features": features}
    _hotspot_cache[cache_key] = (db_mtime, result)
    return result


def warm_delay_hotspots() -> None:
    """Pre-compute default map heatmaps so the first toggle is instant."""
    from filters import interval_from_granularity
    from gtfs_data import warm_location_geocoder

    warm_location_geocoder()
    interval = interval_from_granularity("year", "2014", "2026")
    for mode in ("streetcar", "bus"):
        try:
            get_delay_hotspots_geojson(mode, interval, [], [])
        except FileNotFoundError:
            break


def get_route_detail(
    mode: str,
    route: str,
    interval: dict[str, str],
    directions: list[str],
):
    where, values = build_where(mode, interval, directions, [])
    with get_conn() as conn:
        summary = conn.execute(
            f"""
            SELECT COUNT(*) AS incidents,
                   COALESCE(SUM(min_delay), 0) AS delay_minutes,
                   COALESCE(SUM(min_gap), 0) AS gap_minutes
            FROM delays WHERE {where} AND route = ?
            """,
            [*values, route],
        ).fetchone()
        categories = conn.execute(
            f"""
            SELECT incident_category AS category,
                   COALESCE(SUM(min_delay), 0) AS delay_minutes,
                   COUNT(*) AS incidents
            FROM delays WHERE {where} AND route = ?
            GROUP BY incident_category
            ORDER BY delay_minutes DESC
            """,
            [*values, route],
        ).fetchall()
    return {
        "route": route,
        "summary": dict(summary) if summary else {},
        "categories": [dict(row) for row in categories],
    }


def get_hourly_by_category(mode: str, interval: dict[str, str], directions: list[str], routes: list[str]):
    where, values = build_where(mode, interval, directions, routes)
    with get_conn() as conn:
        rows = conn.execute(
            f"""
            SELECT CAST(strftime('%H', report_datetime) AS INTEGER) AS hour,
                   incident_category AS category,
                   COALESCE(SUM(min_delay), 0) AS delay_minutes
            FROM delays WHERE {where}
            GROUP BY hour, incident_category
            ORDER BY hour, category
            """,
            values,
        ).fetchall()
    return [dict(row) for row in rows]
