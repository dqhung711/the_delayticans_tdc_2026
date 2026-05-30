# Data Sources Statement

**Project:** TTC Delays  
**Team:** The Delayticans  
**Event:** TDC 2026  
**Date:** May 2026  

This document lists **every dataset and external data service** used in our submission, its **origin**, the **licence or terms** under which we use it, and our confirmation regarding **personally identifiable information (PII)**.

---

## Summary

| # | Dataset / service | Origin (publisher) | Licence / terms | PII in source data? |
|---|-------------------|--------------------|-----------------|---------------------|
| 1 | TTC Bus Delay Data | City of Toronto Open Data | [Open Government Licence – Toronto](https://open.toronto.ca/open-data-licence/) | **No** |
| 2 | TTC Streetcar Delay Data | City of Toronto Open Data | [Open Government Licence – Toronto](https://open.toronto.ca/open-data-licence/) | **No** |
| 3 | TTC Surface GTFS | City of Toronto Open Data | [Open Government Licence – Toronto](https://open.toronto.ca/open-data-licence/) | **No** |
| 4 | TTC Routes and Schedules Data | City of Toronto Open Data | [Open Government Licence – Toronto](https://open.toronto.ca/open-data-licence/) | **No** |
| 5 | TTC Live Service Alerts | Toronto Transit Commission (TTC) | TTC website / public API terms ([ttc.ca](https://www.ttc.ca/about-ttc/terms-and-conditions)) | **No** |
| 6 | OpenStreetMap (via Nominatim) | OpenStreetMap contributors / OSMF | [ODbL 1.0](https://opendativelicense.org/) + [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) | **No** (place names & coordinates only) |
| 7 | CARTO Basemaps | CARTO | CARTO basemap [terms](https://carto.com/basemaps/) / [style licence](https://github.com/CartoDB/basemap-styles/blob/master/LICENSE.md); underlying OSM data ODbL | **No** |
| 8 | Google Gemini API *(optional)* | Google | [Google APIs Terms](https://developers.google.com/terms) + [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms) | **No** in our stored data; user prompts sent to Google at query time only |
| 9 | IBM Plex Sans (Google Fonts) | IBM / Google Fonts | [SIL Open Font License 1.1](https://openfontlicense.org/) | **No** |

---

## Dataset details

### 1. TTC Bus Delay Data

| Field | Detail |
|-------|--------|
| **Origin** | City of Toronto — Open Data Portal |
| **Source URL** | https://open.toronto.ca/dataset/ttc-bus-delay-data/ |
| **Local copy** | `raw_data_sources/Buses/*.csv` → processed to `website/data/delays.db` |
| **Licence** | Open Government Licence – Toronto |
| **Use in app** | Historical charts, KPIs, route rankings, delay heatmap (bus mode) |
| **Fields used** | Report date, route, time, location (stop/intersection), incident type, min delay, min gap, direction, vehicle fleet number |
| **PII** | **None.** Operational transit records only; no passenger or employee names, contact details, or identifiers. |

### 2. TTC Streetcar Delay Data

| Field | Detail |
|-------|--------|
| **Origin** | City of Toronto — Open Data Portal |
| **Source URL** | https://open.toronto.ca/dataset/ttc-streetcar-delay-data/ |
| **Local copy** | `raw_data_sources/Streetcars/*.csv` → processed to `website/data/delays.db` |
| **Licence** | Open Government Licence – Toronto |
| **Use in app** | Same as bus delay data (streetcar mode) |
| **Fields used** | Same schema as bus delay CSVs |
| **PII** | **None.** Same as above. |

### 3. TTC Surface GTFS

| Field | Detail |
|-------|--------|
| **Origin** | City of Toronto — Open Data Portal |
| **Source URL** | https://open.toronto.ca/dataset/ttc-surface-gtfs/ |
| **Download URL** | https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/bd4809dd-e289-4de8-bbde-c5c00dafbf4f/resource/28514055-d011-4ed7-8bb0-97961dfe2b66/download/SurfaceGTFS.zip |
| **Local copy** | `website/data/route-shapes-bus.json`, `route-shapes-streetcar.json`, `stops.geojson`, `stops-lookup.json` |
| **Licence** | Open Government Licence – Toronto |
| **Use in app** | Route line geometry, stop locations, wheelchair boarding flags, geocoding delay locations and live alerts |
| **PII** | **None.** Public stop names and coordinates only. |

### 4. TTC Routes and Schedules Data

| Field | Detail |
|-------|--------|
| **Origin** | City of Toronto — Open Data Portal |
| **Source URL** | https://open.toronto.ca/dataset/ttc-routes-and-schedules/ |
| **Download URL** | https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/7795b45e-e65a-4465-81fc-c36b9dfff169/resource/cfb6b2b8-6191-41e3-bda1-b175c51148cb/download/TTC%20Routes%20and%20Schedules%20Data.zip |
| **Local copy** | Merged into GTFS-derived files in `website/data/` |
| **Licence** | Open Government Licence – Toronto |
| **Use in app** | Supplemental route and schedule geometry for the map |
| **PII** | **None.** |

### 5. TTC Live Service Alerts

| Field | Detail |
|-------|--------|
| **Origin** | Toronto Transit Commission (TTC) |
| **Source URL** | `https://www.ttc.ca/ttcapi/routedetail/getallroutesandstopsalerts` |
| **Access** | Public JSON API (no API key); fetched by our server every ~10 minutes |
| **Local copy** | Runtime cache: `website/data/live-advisories.json` (not committed to git) |
| **Licence / terms** | TTC website terms and conditions; **not** distributed under Open Government Licence – Toronto |
| **Use in app** | Live map pins, alert list, route highlighting (bus & streetcar; subway-only alerts excluded) |
| **Fields used** | Alert title, description, route numbers, public stop/station names, category, map coordinates (derived) |
| **PII** | **None.** Service bulletins only; no rider or staff personal data. |

### 6. OpenStreetMap — Nominatim (geocoding)

| Field | Detail |
|-------|--------|
| **Origin** | OpenStreetMap contributors, served by OpenStreetMap Foundation |
| **Source URL** | `https://nominatim.openstreetmap.org/search` |
| **Licence** | Open Database Licence (ODbL) 1.0; usage subject to [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) |
| **Use in app** | Map address search (Toronto/GTA bounding box); proxied via our API (`/api/geocode/search`) |
| **PII** | **None stored by us.** Users may type an address; queries are forwarded to Nominatim and **not saved** to our database. |

### 7. CARTO Basemaps

| Field | Detail |
|-------|--------|
| **Origin** | CARTO (basemap tiles; data derived from OpenStreetMap / OpenMapTiles) |
| **Source URL** | `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json`, `dark-matter-gl-style/style.json` |
| **Licence** | CARTO basemap service terms; map style CC-BY 4.0; underlying geographic data ODbL |
| **Use in app** | Map background (light/dark themes) |
| **PII** | **None.** |

### 8. Google Gemini API *(optional feature)*

| Field | Detail |
|-------|--------|
| **Origin** | Google (Generative Language API) |
| **Source URL** | https://ai.google.dev/ |
| **Licence / terms** | [Google APIs Terms of Service](https://developers.google.com/terms), [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms) |
| **Use in app** | Optional “Ask about this data” chat in Data Explorer |
| **PII** | **None in our SQLite database.** User questions are sent to Google at request time only; we do not persist chat history in `delays.db`. |

### 9. IBM Plex Sans (typography)

| Field | Detail |
|-------|--------|
| **Origin** | IBM, served via Google Fonts |
| **Source URL** | `https://fonts.googleapis.com/css2?family=IBM+Plex+Sans` |
| **Licence** | SIL Open Font License 1.1 |
| **Use in app** | UI typeface |
| **PII** | **None.** |

---

## Derived files shipped with the application

| File | Derived from | Licence (inherits) | PII |
|------|--------------|-------------------|-----|
| `website/data/delays.db` / `delays.db.gz` | Datasets 1 & 2 | Open Government Licence – Toronto | **No** |
| `website/data/route-shapes-*.json` | Datasets 3 & 4 | Open Government Licence – Toronto | **No** |
| `website/data/stops.geojson`, `stops-lookup.json` | Datasets 3 & 4 | Open Government Licence – Toronto | **No** |
| `website/data/route-modes.json` | Computed from delay database | Open Government Licence – Toronto | **No** |
| `website/data/live-advisories.json` | Dataset 5 | TTC terms | **No** |

---

## PII confirmation

We confirm that **no personally identifiable information (PII)** is present in any dataset we ingest, store, or submit as part of this project.

Specifically, our data **does not include**:

- Names of passengers, employees, or operators  
- Email addresses, phone numbers, or postal addresses of individuals  
- Account credentials, fare-card numbers, or payment information  
- Government-issued identifiers, dates of birth, or employee IDs  
- Precise home locations linked to an individual  

The only identifier that could be mistaken for personal data is the **vehicle fleet number** in historical delay records (e.g. bus/streetcar unit number). This is an **operational asset identifier** published in open TTC delay reports, not linked to a named person in our system.

We **do not** operate user accounts, do **not** collect contact information from visitors, and do **not** persist address-search queries or AI chat messages in our application database.

The only client-side storage is `localStorage` for **theme** and **colorblind display mode** preferences (no PII).

---

## Attribution

Toronto open data:

> Contains information licensed under the [Open Government Licence – Toronto](https://open.toronto.ca/open-data-licence/).

OpenStreetMap (map display and geocoding):

> © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors

---

## Disclaimer

This application is for transit delay information and research. It is **not affiliated with** or endorsed by the Toronto Transit Commission or the City of Toronto. For official service status, use [ttc.ca](https://www.ttc.ca).
