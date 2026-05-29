# TTC Delays

Historical **bus & streetcar** delay explorer and live service map.

## Quick start (clone & run)

```bash
cd website
npm run setup    # Python venv + npm deps (first time)
npm run build    # optional for production; dev uses Vite on :5173
npm run dev
```

- App: http://localhost:5173  
- API: http://localhost:8000  

Historical data ships as `data/delays.db.gz` (~48 MB). `npm run setup` unpacks it to `delays.db`.

## Live data source (bus & streetcar)

Real-time advisories on the **Live map** come from TTC’s official **GTFS-Realtime Alerts** feed:

| | |
|---|---|
| **URL** | https://bustime.ttc.ca/gtfsrt/alerts |
| **Format** | GTFS-RT protobuf (`application/x-google-protobuf`) |
| **Provider** | TTC Bustime (Clever Devices) |
| **Refresh** | Every 10 minutes (`api/advisories.py` + scheduler in `api/main.py`) |

Subway-only alerts are filtered out. Route numbers ≥ 500 are treated as streetcar; others as bus.

## Repo layout (what gets pushed)

```
website/
  frontend/     # React UI
  api/          # FastAPI + live feed
  data/         # SQLite + map assets (see data/README.md)
```

Dev-only ingest scripts, backups, and caches live in `.dev/` and are **gitignored** (not needed to run the app).

## Production

```bash
npm run build
npm run start    # serves built UI + API on :8000
```

## Maintainers (local only)

Rebuild from CSVs in `../raw_data_sources/`:

```bash
cd website
npm run setup
npm run rebuild-data   # writes data/delays.db + GTFS map files
```

Scripts: `.dev/tools/` (not published; keep a copy locally or use `git add -f` if you must share them).
