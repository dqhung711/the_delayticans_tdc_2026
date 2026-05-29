import json
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

import advisories
import db
import geocode_search
from filters import parse_query

app = FastAPI(title="TTC Delays API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

scheduler = AsyncIOScheduler()


@app.on_event("startup")
async def startup() -> None:
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
                    "categories": db.get_categories(
                        query["mode"], interval, query["directions"], query["routes"]
                    ),
                    "hourlyByCategory": db.get_hourly_by_category(
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
        "categories": db.get_categories(
            query["mode"], interval, query["directions"], query["routes"]
        ),
        "hourlyByCategory": db.get_hourly_by_category(
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


@app.get("/api/route-shapes")
def route_shapes():
    shapes_path = Path(__file__).resolve().parents[1] / "data" / "route-shapes.json"
    if not shapes_path.exists():
        return {"type": "FeatureCollection", "features": []}
    return json.loads(shapes_path.read_text())


@app.get("/api/map/route-delays")
def map_route_delays(request: Request):
    query = parse_query(request.url.query)
    interval = query["intervals"][0]
    rows = db.get_route_delay_totals(
        query["mode"], interval, query["directions"], query["routes"]
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
def map_stops(mode: str | None = None):
    stops_path = Path(__file__).resolve().parents[1] / "data" / "stops.geojson"
    if not stops_path.exists():
        return {"type": "FeatureCollection", "features": []}
    collection = json.loads(stops_path.read_text())
    if not mode or mode not in ("bus", "streetcar"):
        return collection
    features = [
        f
        for f in collection.get("features", [])
        if mode in (f.get("properties") or {}).get("modes", [f.get("properties", {}).get("mode")])
    ]
    return {"type": "FeatureCollection", "features": features}


client_dist = Path(__file__).resolve().parents[1] / "frontend" / "dist"
if client_dist.exists():
    app.mount("/assets", StaticFiles(directory=client_dist / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        target = client_dist / full_path
        if full_path and target.is_file():
            return FileResponse(target)
        return FileResponse(client_dist / "index.html")
