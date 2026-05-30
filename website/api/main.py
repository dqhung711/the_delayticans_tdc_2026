import gzip
import json
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.gzip import GZipMiddleware

import advisories
import ai
import db
import geocode_search
from filters import parse_query
from gtfs_data import (
    get_route_shapes_geojson,
    get_route_shapes_response,
    get_stops_geojson,
    get_stops_response,
    warm_map_payloads,
)

app = FastAPI(title="TTC Delays API")
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai.router, prefix="/api/ai", tags=["ai"])

scheduler = AsyncIOScheduler()


@app.on_event("startup")
async def startup() -> None:
    try:
        warm_map_payloads()
        db.warm_delay_hotspots()
        acc = sum(
            1
            for f in get_stops_geojson("bus").get("features", [])
            if (f.get("properties") or {}).get("wheelchair_boarding") == 1
        )
        print(f"Warmed map payloads and delay hotspots ({acc} accessible bus stops)")
    except Exception as exc:
        print(f"Map payload warm failed: {exc}")

    try:
        data = await advisories.refresh_advisories()
        cats = data.get("categories") or []
        total = sum(c.get("totalCount", 0) for c in cats)
        print(f"Loaded TTC live alerts: {total} across {len(cats)} categories")
    except Exception as exc:
        print(f"Initial advisory fetch failed: {exc}")

    scheduler.add_job(advisories.refresh_advisories, "interval", minutes=10)
    scheduler.start()


@app.on_event("shutdown")
async def shutdown() -> None:
    scheduler.shutdown(wait=False)


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/meta")
def meta():
    try:
        return db.get_meta()
    except FileNotFoundError as exc:
        return JSONResponse(status_code=503, content={"error": str(exc)})


@app.get("/api/routes")
def routes(request: Request):
    query = parse_query(request.url.query)
    return db.get_routes(query["mode"])


@app.get("/api/summary")
def summary(request: Request):
    query = parse_query(request.url.query)
    interval = query["intervals"][0]
    return db.get_summary(query["mode"], interval, query["directions"], query["routes"])


@app.get("/api/charts/overview")
def charts_overview(request: Request):
    query = parse_query(request.url.query)
    if query["compare"]:
        periods = []
        for index, interval in enumerate(query["intervals"]):
            periods.append(
                {
                    "label": f"Period {index + 1}",
                    "interval": interval,
                    "timeSeries": db.get_time_series(
                        query["mode"], interval, query["directions"], query["routes"], query["bucket"]
                    ),
                    "hourlyTotals": db.get_hourly_totals(
                        query["mode"], interval, query["directions"], query["routes"]
                    ),
                    "dailyTotals": db.get_daily_totals(
                        query["mode"], interval, query["directions"], query["routes"]
                    ),
                    "categories": db.get_categories(
                        query["mode"], interval, query["directions"], query["routes"]
                    ),
                    "hourlyByCategory": db.get_hourly_by_category(
                        query["mode"], interval, query["directions"], query["routes"]
                    ),
                    "routesByCategory": db.get_routes_by_category(
                        query["mode"], interval, query["directions"], query["routes"]
                    ),
                }
            )
        return {"compare": True, "periods": periods}

    interval = query["intervals"][0]
    return {
        "compare": False,
        "timeSeries": db.get_time_series(
            query["mode"], interval, query["directions"], query["routes"], query["bucket"]
        ),
        "hourlyTotals": db.get_hourly_totals(
            query["mode"], interval, query["directions"], query["routes"]
        ),
        "dailyTotals": db.get_daily_totals(
            query["mode"], interval, query["directions"], query["routes"]
        ),
        "categories": db.get_categories(
            query["mode"], interval, query["directions"], query["routes"]
        ),
        "hourlyByCategory": db.get_hourly_by_category(
            query["mode"], interval, query["directions"], query["routes"]
        ),
        "routesByCategory": db.get_routes_by_category(
            query["mode"], interval, query["directions"], query["routes"]
        ),
    }


@app.get("/api/live")
def live():
    return advisories.get_snapshot()


@app.post("/api/live/refresh")
async def live_refresh():
    try:
        return await advisories.refresh_advisories()
    except Exception as exc:
        return JSONResponse(status_code=502, content={"error": str(exc)})


@app.get("/api/route-modes")
def route_modes():
    modes_path = Path(__file__).resolve().parents[1] / "data" / "route-modes.json"
    if not modes_path.exists():
        return {}
    return json.loads(modes_path.read_text())


@app.get("/api/route-shapes")
def route_shapes(response: Response, mode: str | None = None):
    if mode and mode not in ("bus", "streetcar"):
        return Response(
            content=b'{"type":"FeatureCollection","features":[]}',
            media_type="application/json",
        )
    packed = get_route_shapes_response(mode)
    if packed:
        body, etag, precompressed = packed
        response.headers["Cache-Control"] = "public, max-age=86400, immutable"
        response.headers["ETag"] = etag
        if precompressed:
            # Serve plain JSON — GZipMiddleware compresses on the wire.
            # Raw .gz bytes break fetch().json() when Content-Encoding is stripped.
            body = gzip.decompress(body)
        return Response(content=body, media_type="application/json")
    return get_route_shapes_geojson(mode)


@app.get("/api/map/route-delays")
def map_route_delays(request: Request):
    query = parse_query(request.url.query)
    interval = query["intervals"][0]
    rows = db.get_route_delay_totals(
        query["mode"], interval, query["directions"], query["routes"]
    )
    return rows


@app.get("/api/map/ranked-routes")
def map_ranked_routes(request: Request):
    query = parse_query(request.url.query)
    interval = query["intervals"][0]
    
    # Calculate comparison interval if not provided but we are in a single year or range
    comp_interval = None
    if len(query["intervals"]) > 1:
        comp_interval = query["intervals"][1]
    else:
        # Fallback logic similar to DataExplorer.tsx
        start = request.query_params.get("start", "2014")
        end = request.query_params.get("end", "2026")
        if start.isdigit() and end.isdigit():
            s_year = int(start)
            e_year = int(end)
            diff = e_year - s_year + 1
            prev_start = str(s_year - diff)
            prev_end = str(s_year - 1)
            from filters import interval_from_granularity
            comp_interval = interval_from_granularity("year", prev_start, prev_end)

    rows = db.get_ranked_routes_with_comparison(
        query["mode"], interval, comp_interval, query["directions"], query["routes"]
    )
    return rows


@app.get("/api/geocode/search")
async def geocode_address_search(q: str = Query(..., min_length=2)):
    try:
        results = await geocode_search.search_addresses(q)
        return {"results": results}
    except Exception as exc:
        return JSONResponse(status_code=502, content={"error": str(exc), "results": []})


@app.get("/api/map/delay-hotspots")
def map_delay_hotspots(request: Request):
    query = parse_query(request.url.query)
    interval = query["intervals"][0]
    return db.get_delay_hotspots_geojson(
        query["mode"], interval, query["directions"], query["routes"]
    )


@app.get("/api/map/route/{route_id}")
def map_route_detail(route_id: str, request: Request):
    query = parse_query(request.url.query)
    interval = query["intervals"][0]
    return db.get_route_detail(
        query["mode"], route_id, interval, query["directions"]
    )


@app.get("/api/map/stops")
def map_stops(response: Response, mode: str | None = None):
    if mode and mode not in ("bus", "streetcar"):
        mode = None
    packed = get_stops_response(mode)
    if packed:
        body, etag = packed
        response.headers["Cache-Control"] = "public, max-age=86400, immutable"
        response.headers["ETag"] = etag
        return Response(content=body, media_type="application/json")
    return get_stops_geojson(mode)


client_dist = Path(__file__).resolve().parents[1] / "frontend" / "dist"
if client_dist.exists():
    app.mount("/assets", StaticFiles(directory=client_dist / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        target = client_dist / full_path
        if full_path and target.is_file():
            return FileResponse(target)
        return FileResponse(client_dist / "index.html")
