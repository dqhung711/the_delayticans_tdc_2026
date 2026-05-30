#!/usr/bin/env python3
"""Legacy script — use fetch_gtfs_network.py instead (writes split bus/streetcar files)."""

import csv
import io
import json
import zipfile
from pathlib import Path

import httpx

OUT_PATH = Path(__file__).resolve().parents[2] / "data" / "route-shapes.json"
GTFS_URLS = [
    "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/bd4809dd-e289-4de8-bbde-c5c00dafbf4f/resource/28514055-d011-4ed7-8bb0-97961dfe2b66/download/SurfaceGTFS.zip",
]


def parse_csv(text: str) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(text)))


def main() -> None:
    content = None
    for url in GTFS_URLS:
        try:
            response = httpx.get(url, timeout=120.0, follow_redirects=True)
            if response.status_code == 200:
                content = response.content
                print(f"Downloaded GTFS from {url}")
                break
        except Exception as exc:
            print(f"Failed {url}: {exc}")

    if not content:
        OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUT_PATH.write_text(json.dumps({"type": "FeatureCollection", "features": []}))
        print("Could not download GTFS; wrote empty shapes file.")
        return

    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        shapes = parse_csv(archive.read("shapes.txt").decode("utf-8-sig"))
        trips = parse_csv(archive.read("trips.txt").decode("utf-8-sig"))
        routes = parse_csv(archive.read("routes.txt").decode("utf-8-sig"))

    route_short = {row["route_id"]: row["route_short_name"] for row in routes}
    shape_points: dict[str, list[list[float]]] = {}
    for row in shapes:
        shape_id = row["shape_id"]
        lon = float(row["shape_pt_lon"])
        lat = float(row["shape_pt_lat"])
        shape_points.setdefault(shape_id, []).append([lon, lat])

    route_shapes: dict[str, list[list[float]]] = {}
    seen_routes: set[str] = set()
    for row in trips:
        route_id = row["route_id"]
        shape_id = row.get("shape_id", "")
        short_name = route_short.get(route_id, "")
        if not short_name or not shape_id or route_id in seen_routes:
            continue
        seen_routes.add(route_id)
        if shape_id in shape_points:
            route_shapes[short_name] = shape_points[shape_id]

    features = [
        {
            "type": "Feature",
            "properties": {"route": route},
            "geometry": {"type": "LineString", "coordinates": coords},
        }
        for route, coords in route_shapes.items()
    ]
    collection = {"type": "FeatureCollection", "features": features}
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(collection))
    print(f"Wrote {len(features)} route shapes to {OUT_PATH}")


if __name__ == "__main__":
    main()
