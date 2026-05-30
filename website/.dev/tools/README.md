# Maintainer tools

Not required to run the app — only when rebuilding data or route shapes.

```bash
# From website/
.venv/bin/python tools/ingest_delays.py
.venv/bin/python tools/fetch_gtfs_network.py   # routes, stops, geocoding lookup
```

`fetch_gtfs_network.py` downloads TTC **SurfaceGTFS** from Toronto Open Data and writes:

- `data/route-shapes-bus.json` — bus line geometries
- `data/route-shapes-streetcar.json` — streetcar line geometries
- `data/stops.geojson` — all bus/streetcar stop locations
- `data/stops-lookup.json` — stop ID/name → coordinates for live advisory pins
