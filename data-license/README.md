# Data sources

TTC Delays uses **public transit and open map data only**. We do not collect, store, or sell **personal information** (no names, contact details, accounts, payment data, or precise home addresses in our database).

---

## External data sources

| Source | Link | What the app uses it for |
|--------|------|---------------------------|
| **City of Toronto — TTC Bus Delay Data** | [open.toronto.ca/dataset/ttc-bus-delay-data](https://open.toronto.ca/dataset/ttc-bus-delay-data/) | Historical delay charts, tables, heatmap |
| **City of Toronto — TTC Streetcar Delay Data** | [open.toronto.ca/dataset/ttc-streetcar-delay-data](https://open.toronto.ca/dataset/ttc-streetcar-delay-data/) | Same (streetcar mode) |
| **City of Toronto — TTC Surface GTFS** | [open.toronto.ca/dataset/ttc-surface-gtfs](https://open.toronto.ca/dataset/ttc-surface-gtfs/) | Route lines and stop locations on the map |
| **City of Toronto — TTC Routes & Schedules** | [open.toronto.ca/dataset/ttc-routes-and-schedules](https://open.toronto.ca/dataset/ttc-routes-and-schedules/) | Supplemental route/stop geometry |
| **TTC — Live service alerts** | See [Live alerts API](#live-alerts-api) below | Live map pins and alert list |
| **OpenStreetMap — Nominatim** | [nominatim.openstreetmap.org](https://nominatim.openstreetmap.org/) | Map address search (Toronto area) |
| **CARTO** | [carto.com/basemaps](https://carto.com/basemaps/) | Map background (streets) |
| **Google Gemini** *(optional)* | [ai.google.dev](https://ai.google.dev/) | AI chat in Data Explorer, only if enabled |

Toronto open datasets are under the [Open Government Licence – Toronto](https://open.toronto.ca/open-data-licence/).

---

## Live alerts API

The live map does **not** call TTC from the browser. Our server fetches TTC’s public feed, caches it, and the app reads our API.

### TTC (upstream)

| | |
|--|--|
| **URL** | `https://www.ttc.ca/ttcapi/routedetail/getallroutesandstopsalerts` |
| **Method** | `GET` |
| **Format** | JSON |
| **Authentication** | None |
| **Refresh** | About every 10 minutes on the server (`website/api/advisories.py`, `website/api/main.py`) |

### Our app (what the website calls)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/live` | `GET` | Cached snapshot: categories, advisories, map coordinates |
| `/api/live/refresh` | `POST` | Force a new fetch from TTC, then return updated snapshot |

Example on a deployed host: `https://your-app.onrender.com/api/live`

Response includes service alert fields only (route numbers, titles, descriptions, public stop names, map coordinates)—no rider or staff personal data. Subway-only alerts are filtered out in our code.

---

## What we store (aggregated transit data only)

Built from the sources above and saved in `website/data/`:

| Data | Examples of fields | Personal? |
|------|-------------------|-----------|
| **Delay incidents** | date, time, route number, street/intersection location, incident type, delay minutes, gap minutes, direction, **vehicle fleet number** | **No** — operational transit records, not rider or staff identity |
| **Route shapes** | route id, line coordinates | **No** |
| **Stops** | stop name, coordinates, wheelchair access flag | **No** — public stop names only |
| **Live advisories** | route, category, alert title/description, stop names | **No** — service bulletins |

We do **not** have columns for passenger name, email, phone, date of birth, employee ID, fare card, or home address.

---

## What we do not collect

| Not used | Notes |
|----------|--------|
| User accounts or logins | No sign-up |
| Contact or payment info | None |
| Rider identities | Not in source CSVs or our database |
| Saved home/work addresses | Address search is optional; queries are not written to our database |
| Tracking / analytics cookies | Only browser `localStorage` for theme and colorblind mode preferences |

---

## When you use the site (temporary only)

| Feature | What leaves your browser | Stored by us? |
|---------|------------------------|---------------|
| **Browse charts / map** | Filter choices (dates, routes) in API requests | **No** persistent user profile |
| **Address search** | Text you type → our server → OpenStreetMap Nominatim | **No** saved to database |
| **AI chat** *(if on)* | Your question → our server → Google Gemini | **No** in our SQLite DB; subject to [Google’s terms](https://ai.google.dev/gemini-api/terms) |

---

## Disclaimer

This app is for **transit delay information and research**. It is not affiliated with the TTC or the City of Toronto. For official service status, use [ttc.ca](https://www.ttc.ca).
