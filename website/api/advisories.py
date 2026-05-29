"""
Live bus & streetcar service alerts from the TTC website.

Source: https://www.ttc.ca/ttcapi/routedetail/getallroutesandstopsalerts
"""

import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import httpx

from gtfs_data import in_toronto_bbox, resolve_alert_coordinates

TTC_ALERTS_URL = "https://www.ttc.ca/ttcapi/routedetail/getallroutesandstopsalerts"
CACHE_PATH = Path(__file__).resolve().parents[1] / "data" / "live-advisories.json"
ROUTE_MODES_PATH = Path(__file__).resolve().parents[1] / "data" / "route-modes.json"

_route_modes_cache: dict[str, str] | None = None

SUBWAY_LINE_NUMBERS = frozenset({"1", "2", "3", "4", "5", "6"})

WIDGET_CATEGORIES = [
    "Delays",
    "Service changes",
    "Detours",
    "Bypass",
    "No service",
    "Replaced by bus",
]

snapshot: dict = {
    "updatedAt": datetime(1970, 1, 1, tzinfo=timezone.utc).isoformat(),
    "sourceUpdatedAt": None,
    "categories": [],
    "advisories": [],
    "highlightedRoutes": [],
    "refreshIntervalMinutes": 10,
    "source": TTC_ALERTS_URL,
}


def load_cache() -> None:
    global snapshot
    if CACHE_PATH.exists():
        try:
            snapshot = json.loads(CACHE_PATH.read_text())
        except json.JSONDecodeError:
            pass


def save_cache() -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(snapshot, indent=2))


def clean_text(value: str) -> str:
    if not value:
        return ""
    text = html.unescape(value)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_route_numbers(route_field: str) -> list[str]:
    if not route_field:
        return []
    parts = re.split(r"[|,]", str(route_field))
    return [p.strip() for p in parts if p.strip()]


def is_subway_line_route(route: str) -> bool:
    base = re.sub(r"[A-Z]+$", "", route.upper())
    return base in SUBWAY_LINE_NUMBERS or route.upper() in SUBWAY_LINE_NUMBERS


def surface_routes(route_field: str) -> list[str]:
    """Bus & streetcar route numbers (excludes subway line IDs 1–6)."""
    out: list[str] = []
    seen: set[str] = set()
    for route in parse_route_numbers(route_field):
        token = route.upper()
        if not re.match(r"^\d{1,4}[A-Z]?$", token, re.I):
            continue
        if is_subway_line_route(token):
            continue
        if token in seen:
            continue
        seen.add(token)
        out.append(token)
    return out


def is_subway_alert(alert: dict) -> bool:
    route_type = (alert.get("routeType") or "").strip()
    if route_type in ("Subway", "Elevator", "Escalator"):
        return True
    header = clean_text(alert.get("headerText") or "").lower()
    if re.search(r"\bline\s+[1-6]\b", header) and not surface_routes(alert.get("route") or ""):
        return True
    return not surface_routes(alert.get("route") or "")


def is_surface_service_change(change: dict) -> bool:
    routes = surface_routes(change.get("route") or "")
    if not routes:
        return False
    route_type = (change.get("routeType") or "").strip()
    category = (change.get("categoryName") or "").strip()
    if route_type in ("Subway", "Elevator", "Escalator") and category not in ("Bus", "Streetcar"):
        return False
    if category in ("Bus", "Streetcar"):
        return True
    if route_type in ("Bus", "Streetcar"):
        return True
    return True


def categorize_route_alert(alert: dict) -> str | None:
    effect = (alert.get("effectDesc") or "").lower()
    accessibility = alert.get("accessibility") or ""

    if accessibility in ("Elevator", "Escalator"):
        return None
    if "no service" in effect or effect == "subway closure":
        return "No service"
    if effect == "replaced":
        return "Replaced by bus"
    if "delay" in effect:
        return "Delays"
    if "bypass" in effect:
        return "Bypass"
    if "detour" in effect:
        return "Detours"
    return None


def route_label(route: str) -> str:
    try:
        num = int(re.sub(r"\D", "", route))
        kind = "Streetcar" if num >= 500 else "Bus"
        return f"Route {route} ({kind})"
    except ValueError:
        return f"Route {route}"


def get_route_modes() -> dict[str, str]:
    global _route_modes_cache
    if _route_modes_cache is None:
        if ROUTE_MODES_PATH.exists():
            try:
                _route_modes_cache = json.loads(ROUTE_MODES_PATH.read_text())
            except json.JSONDecodeError:
                _route_modes_cache = {}
        else:
            _route_modes_cache = {}
    return _route_modes_cache


def infer_mode(routes: list[str], route_type: str | None = None, category: str | None = None) -> str:
    rt = (route_type or "").lower()
    cat = (category or "").lower()
    if rt == "streetcar" or cat == "streetcar":
        return "streetcar"
    if rt == "bus" or cat == "bus":
        return "bus"

    modes = get_route_modes()
    for route in routes:
        key = (route or "").strip()
        if not key:
            continue
        norm = key.lstrip("0") or key
        from_db = modes.get(key) or modes.get(norm) or modes.get(key.upper())
        if from_db in ("bus", "streetcar"):
            return from_db

    for route in routes:
        try:
            if int(re.sub(r"\D", "", route)) >= 500:
                return "streetcar"
        except ValueError:
            continue
    if routes:
        return "bus"
    return "unknown"


def geocode_item(header: str, description: str, stops: list[str], routes: list[str]) -> tuple[float | None, float | None]:
    return resolve_alert_coordinates(header, description, stops, routes)


def alert_to_item(alert: dict, category: str) -> dict:
    header = clean_text(alert.get("headerText") or "")
    title = clean_text(alert.get("title") or "") or header or (alert.get("effectDesc") or "Service advisory")
    routes = surface_routes(alert.get("route") or "")
    stops = list(alert.get("stopIDList") or alert.get("stops") or [])
    primary = routes[0] if routes else None
    lon, lat = geocode_item(header, header, stops, routes)

    return {
        "id": str(alert.get("id") or title),
        "category": category,
        "title": title,
        "description": header or title,
        "headerText": header,
        "effectDesc": alert.get("effectDesc"),
        "routes": routes,
        "primaryRoute": primary,
        "routeLabel": route_label(primary) if primary else None,
        "stops": stops,
        "routeType": alert.get("routeType"),
        "direction": alert.get("direction"),
        "url": alert.get("url") or "",
        "lon": lon,
        "lat": lat,
    }


def service_change_to_item(change: dict) -> dict | None:
    if not is_surface_service_change(change):
        return None
    routes = surface_routes(change.get("route") or "")
    if not routes:
        return None
    title = clean_text(change.get("saTitle") or change.get("title") or "Service change")
    subtitle = clean_text(change.get("subTitle") or change.get("effectiveDateTitle") or "")
    description = subtitle or title
    station = clean_text(change.get("stationName") or change.get("station") or "")
    stops = [station] if station else []
    lon, lat = geocode_item(title, description, stops, routes)
    primary = routes[0]
    route_type = change.get("routeType")
    category_name = change.get("categoryName")

    return {
        "id": str(change.get("id") or title),
        "category": "Service changes",
        "title": title,
        "description": description,
        "headerText": title,
        "effectDesc": change.get("categoryName"),
        "routes": routes,
        "primaryRoute": primary,
        "routeLabel": route_label(primary),
        "stops": stops,
        "routeType": route_type,
        "categoryName": category_name,
        "direction": None,
        "url": change.get("url") or "",
        "lon": lon,
        "lat": lat,
    }


def build_categories(payload: dict) -> tuple[list[dict], list[dict]]:
    buckets: dict[str, dict] = {
        name: {
            "id": name.lower().replace(" ", "-"),
            "name": name,
            "totalCount": 0,
            "hideLineCounts": False,
            "routeCounts": {},
            "alerts": [],
        }
        for name in WIDGET_CATEGORIES
    }

    flat: list[dict] = []

    for alert in payload.get("routeAlerts") or []:
        if is_subway_alert(alert):
            continue
        category = categorize_route_alert(alert)
        if not category:
            continue
        item = alert_to_item(alert, category)
        if not item["routes"]:
            continue
        flat.append(item)
        bucket = buckets[category]
        bucket["totalCount"] += 1
        bucket["alerts"].append(item)
        for route in item["routes"]:
            counts = bucket["routeCounts"]
            if route in counts:
                counts[route]["count"] += 1
            else:
                counts[route] = {
                    "route": route,
                    "routeLabel": route_label(route),
                    "count": 1,
                }

    for change in payload.get("serviceChanges") or []:
        item = service_change_to_item(change)
        if not item:
            continue
        flat.append(item)
        bucket = buckets["Service changes"]
        bucket["totalCount"] += 1
        bucket["alerts"].append(item)
        for route in item["routes"]:
            counts = bucket["routeCounts"]
            if route in counts:
                counts[route]["count"] += 1
            else:
                counts[route] = {
                    "route": route,
                    "routeLabel": route_label(route),
                    "count": 1,
                }

    categories = []
    for name in WIDGET_CATEGORIES:
        bucket = buckets[name]
        route_counts = sorted(
            bucket["routeCounts"].values(),
            key=lambda r: (-r["count"], r["route"]),
        )
        categories.append(
            {
                "id": bucket["id"],
                "name": name,
                "totalCount": bucket["totalCount"],
                "hideLineCounts": False,
                "routeCounts": route_counts,
                "alerts": bucket["alerts"],
            }
        )

    return categories, flat


def enrich_map_advisories(items: list[dict]) -> list[dict]:
    """Bus & streetcar map pins — only items with resolved coordinates."""
    out: list[dict] = []
    seen: set[str] = set()

    for item in items:
        routes = item.get("routes") or []
        if not routes:
            continue
        aid = item["id"]
        if aid in seen:
            continue

        header = item.get("headerText") or item.get("description") or ""
        description = item.get("description") or header
        stops = item.get("stops") or []

        lon = item.get("lon")
        lat = item.get("lat")
        if lon is None or lat is None:
            lon, lat = geocode_item(header, description, stops, routes)
        if lon is None or lat is None:
            continue
        if not in_toronto_bbox(float(lon), float(lat)):
            continue

        seen.add(aid)
        mode = infer_mode(
            routes,
            item.get("routeType"),
            item.get("categoryName"),
        )

        out.append(
            {
                "id": aid,
                "title": item["title"],
                "description": description,
                "routes": routes[:12],
                "stops": stops,
                "effect": item.get("effectDesc") or item["category"],
                "severity": item["category"],
                "mode": mode,
                "category": item["category"],
                "lon": lon,
                "lat": lat,
                "url": item.get("url") or "",
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }
        )
    return out


async def fetch_ttc_alerts() -> dict:
    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.get(TTC_ALERTS_URL, headers={"Accept": "application/json"})
        response.raise_for_status()
        return response.json()


async def refresh_advisories() -> dict:
    global snapshot
    payload = await fetch_ttc_alerts()
    categories, flat = build_categories(payload)
    advisories = enrich_map_advisories(flat)
    highlighted = sorted(
        {route for item in advisories for route in item.get("routes", []) if route}
    )
    source_updated = payload.get("lastUpdated")

    snapshot = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceUpdatedAt": source_updated,
        "categories": categories,
        "advisories": advisories,
        "highlightedRoutes": highlighted,
        "refreshIntervalMinutes": 10,
        "source": TTC_ALERTS_URL,
    }
    save_cache()
    return snapshot


def get_snapshot() -> dict:
    return snapshot


load_cache()
