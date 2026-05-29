"""Toronto-bounded address search via Nominatim (proxied for the frontend)."""

from __future__ import annotations

import re

import httpx

from gtfs_data import in_toronto_bbox

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
TORONTO_VIEWBOX = "-79.64,43.58,-79.12,43.86"
USER_AGENT = "TTC-Delays-Dashboard/1.0 (university project; contact via repo)"

GTA_PATTERN = re.compile(
    r"\b(toronto|scarborough|north york|etobicoke|east york|york|mississauga|gta)\b",
    re.I,
)


def format_query(raw: str) -> str:
    q = raw.strip()
    if not q:
        return q
    if not GTA_PATTERN.search(q):
        q = f"{q}, Toronto, Ontario, Canada"
    return q


async def search_addresses(query: str, limit: int = 6) -> list[dict]:
    q = format_query(query)
    if len(q) < 3:
        return []

    params = {
        "q": q,
        "format": "json",
        "limit": str(limit),
        "countrycodes": "ca",
        "viewbox": TORONTO_VIEWBOX,
        "bounded": "1",
        "addressdetails": "1",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            NOMINATIM_URL,
            params=params,
            headers={"Accept": "application/json", "User-Agent": USER_AGENT},
        )
        response.raise_for_status()
        rows = response.json()

    results: list[dict] = []
    for row in rows:
        try:
            lat = float(row["lat"])
            lon = float(row["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        if not in_toronto_bbox(lon, lat):
            continue
        results.append(
            {
                "lat": lat,
                "lon": lon,
                "display_name": row.get("display_name") or "",
                "type": row.get("type") or "",
            }
        )
    return results
