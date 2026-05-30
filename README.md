# TTC Delays

**Live site:** [the-delayticans-tdc-2026.vercel.app](https://the-delayticans-tdc-2026.vercel.app/)

Explore more than a decade of Toronto Transit Commission **bus and streetcar** delay history, then switch to a **live map** of current service alerts—all in one place.

## What you can do

### Data Explorer

- Filter by **year or date range**, direction, and specific routes.
- Compare time periods side by side.
- View trends in delay minutes, service gaps, incident categories, and busiest routes.
- Drill into hourly and daily patterns with interactive charts.

### Live Map

- See **active TTC advisories** on a 3D map of Toronto (bus and streetcar; subway-only alerts are excluded).
- Highlight routes with current issues and open route details.
- Turn on a **delay heatmap** to see where historical incidents cluster for your selected period.
- Search addresses in the GTA and explore nearby service.
- Optional layers: all route lines, stops, **accessible stops** (step-free boarding), and construction-related overlays.
- **Colorblind-friendly** display modes (deuteranopia, protanopia, tritanopia) and a dark/light theme.

### Assistant

- Ask questions about delays and trends in plain language (when enabled on the deployed site).

## Data & updates

| Source | What it powers |
|--------|----------------|
| **Historical delays** | Data Explorer charts and heatmap (approximately 2014–2026, bus & streetcar) |
| **Live advisories** | Live map pins and alert list, refreshed about every 10 minutes from TTC |
| **OpenStreetMap** | Address search (Toronto area) |
| **Transit network geometry** | Route lines and stop locations on the map |

Historical figures come from archived TTC delay reports. Live information reflects conditions at refresh time and may change without notice. This project is for **information and research**; for official service status, use [ttc.ca](https://www.ttc.ca).

**Data Sources Statement** (datasets, licences, no PII): [data-license/README.md](data-license/README.md).

## Run locally

**Requirements:** [Node.js](https://nodejs.org/) 18+ and Python 3 (macOS/Linux/Windows).

1. **Clone the repository**

   ```bash
   git clone https://github.com/dqhung711/the_delayticans_tdc_2026.git
   cd the_delayticans_tdc_2026/website
   ```

2. **First-time setup** (installs dependencies, creates a Python virtual environment, and unpacks the historical database from `data/delays.db.gz`)

   ```bash
   npm run setup
   ```

3. **Start the app**

   ```bash
   npm run dev
   ```

4. **Open in your browser**

   | URL | What it is |
   |-----|------------|
   | **http://localhost:5173** | Web app (use this) |
   | http://localhost:8000 | API only (health check: `/api/health`) |

   Stop the servers with `Ctrl+C` in the terminal.

### Optional

- **AI chat (local):** create `website/api/.env` with `GEMINI_API_KEY=your-key` (see [Google AI Studio](https://aistudio.google.com/apikey)).
- **Production-style run** (single port, UI + API together):

  ```bash
  npm run build
  npm run start
  ```

  Then open **http://localhost:8000**.

More detail: [website/README.md](website/README.md).

## Team

Built for **TDC 2026** by The Delayticans.
