#!/usr/bin/env python3
"""Build SQLite database from TTC bus/streetcar delay CSV files in raw_data_sources/."""

from __future__ import annotations

import csv
import json
import re
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

_WEBSITE_ROOT = Path(__file__).resolve().parents[2]
_REPO_ROOT = Path(__file__).resolve().parents[3]
RAW_DIR = _REPO_ROOT / "raw_data_sources"
DB_PATH = _WEBSITE_ROOT / "data" / "delays.db"
ROUTE_MODES_PATH = _WEBSITE_ROOT / "data" / "route-modes.json"

DATE_FORMATS = (
    "%d-%b-%y",
    "%d-%b-%Y",
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%m/%d/%Y",
    "%d/%m/%Y",
    "%m/%d/%y",
)

MECHANICAL = {
    "mechanical",
    "overhead",
    "overhead - pantograph",
    "rail/switches",
    "late leaving garage - mechanical",
}
OPERATOR = {
    "operations - operator",
    "late leaving garage - operator",
    "late leaving garage - management",
    "utilized off route",
    "vision",
    "late leaving garage - vision",
    "operations",
    "operator",
    "late leaving garage",
}
TRAFFIC = {
    "diversion",
    "held by",
    "general delay",
    "road blocked - non-ttc collision",
    "emergency services",
    "mfpr",
}
PASSENGER = {
    "investigation",
    "security",
    "cleaning",
    "cleaning - unsanitary",
    "collision - ttc",
    "collision - ttc involved",
    "fare dispute",
}

COLUMN_ALIASES: dict[str, str] = {
    "report date": "Report Date",
    "date": "Report Date",
    "route": "Route",
    "line": "Route",
    "time": "Time",
    "location": "Location",
    "station": "Location",
    "incident": "Incident",
    "code": "Incident",
    "min delay": "Min Delay",
    "delay": "Min Delay",
    "min gap": "Min Gap",
    "gap": "Min Gap",
    "direction": "Direction",
    "bound": "Direction",
    "vehicle": "Vehicle",
}


def parse_date(value: str) -> datetime | None:
    cleaned = (value or "").strip()
    if not cleaned or cleaned.lower() in {"none", "null", "nan"}:
        return None
    if "T" in cleaned:
        try:
            return datetime.fromisoformat(cleaned.replace("Z", "+00:00")[:19])
        except ValueError:
            pass
    for fmt in DATE_FORMATS:
        try:
            sample = cleaned[:10] if fmt != "%Y-%m-%d" else cleaned[:10]
            return datetime.strptime(sample, fmt)
        except ValueError:
            continue
    return None


def parse_time(value: str) -> tuple[int, int, int]:
    cleaned = (value or "").strip()
    if not cleaned or cleaned.lower() in {"none", "null", "nan"}:
        return 0, 0, 0
    for fmt in ("%I:%M:%S %p", "%H:%M:%S", "%I:%M %p", "%H:%M"):
        try:
            parsed = datetime.strptime(cleaned, fmt)
            return parsed.hour, parsed.minute, parsed.second
        except ValueError:
            continue
    if ":" in cleaned:
        parts = cleaned.split(":")
        try:
            return int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0
        except ValueError:
            pass
    return 0, 0, 0


def normalize_row(row: dict[str, str]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for key, value in row.items():
        if key is None:
            continue
        mapped = COLUMN_ALIASES.get(key.strip().lower(), key.strip())
        normalized[mapped] = value
    return normalized


def route_number(raw_route: str) -> str:
    cleaned = (raw_route or "").strip()
    if not cleaned or cleaned.lower() in {"none", "null", "nan"}:
        return ""
    match = re.search(r"\d{1,4}[A-Z]?", cleaned, re.I)
    return match.group(0).upper() if match else ""


def normalize_direction(raw: str) -> str:
    value = (raw or "").strip().lower()
    if not value or value in {"none", "null", "nan"}:
        return ""
    if value in {"e", "eb", "e/b", "east", "eastbound"} or value.startswith("e/"):
        return "EB"
    if value in {"w", "wb", "w/b", "west", "westbound"} or value.startswith("w/"):
        return "WB"
    if value in {"n", "nb", "n/b", "north", "northbound", "up"} or value.startswith("n/"):
        return "NB"
    if value in {"s", "sb", "s/b", "south", "southbound", "down"} or value.startswith("s/"):
        return "SB"
    if "e/b" in value or "eb" in value:
        return "EB"
    if "w/b" in value or "wb" in value:
        return "WB"
    if "n/b" in value or "nb" in value:
        return "NB"
    if "s/b" in value or "sb" in value:
        return "SB"
    return "OTHER"


def categorize_incident(incident: str) -> str:
    value = (incident or "").strip().lower()
    if value.startswith("ef"):
        return "Mechanical"
    if value.startswith("mf"):
        if value in {"mfdv", "mfpr", "mfwea", "mfheld"}:
            return "Traffic"
        if value in {"mfesa", "mffi", "mfpi", "mfui", "mfus"}:
            return "Operator div."
        if value in {"mfcn", "mfsan", "mfs", "mfsec"}:
            return "Passenger"
        return "Operator div."
    if not value:
        return "Other"
    if value in MECHANICAL or "mechanical" in value or "overhead" in value:
        return "Mechanical"
    if value in OPERATOR or "operator" in value or "off route" in value:
        return "Operator div."
    if value in TRAFFIC or "diversion" in value or "held" in value or "delay" in value:
        return "Traffic"
    if value in PASSENGER or "collision" in value or "cleaning" in value or "security" in value:
        return "Passenger"
    return "Other"


def float_or_zero(value: str) -> float:
    cleaned = (value or "").strip()
    if not cleaned or cleaned.lower() in {"null", "none", "nan"}:
        return 0.0
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def iter_csv_files(mode_folder: str):
    folder = RAW_DIR / mode_folder
    if not folder.is_dir():
        print(f"Warning: missing folder {folder}", file=sys.stderr)
        return
    for path in sorted(folder.glob("*.csv")):
        if path.name == "Code Descriptions.csv":
            continue
        yield path


def create_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        DROP TABLE IF EXISTS delays;
        CREATE TABLE delays (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mode TEXT NOT NULL,
            report_date TEXT NOT NULL,
            report_datetime TEXT NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            quarter INTEGER NOT NULL,
            route TEXT,
            location TEXT,
            incident TEXT,
            incident_category TEXT NOT NULL,
            min_delay REAL NOT NULL,
            min_gap REAL NOT NULL,
            direction_raw TEXT,
            direction TEXT NOT NULL,
            vehicle TEXT
        );
        CREATE INDEX idx_delays_mode_dt ON delays(mode, report_datetime);
        CREATE INDEX idx_delays_direction ON delays(direction);
        CREATE INDEX idx_delays_route ON delays(route);
        CREATE INDEX idx_delays_category ON delays(incident_category);
        """
    )


def write_route_modes(conn: sqlite3.Connection) -> None:
    rows = conn.execute(
        """
        SELECT route, mode, COUNT(*) AS total
        FROM delays
        WHERE route != ''
        GROUP BY route, mode
        """
    ).fetchall()
    scores: dict[str, dict[str, int]] = {}
    for route, mode, total in rows:
        scores.setdefault(route, {})[mode] = total
    primary = {route: max(modes, key=modes.get) for route, modes in scores.items()}
    ROUTE_MODES_PATH.parent.mkdir(parents=True, exist_ok=True)
    ROUTE_MODES_PATH.write_text(json.dumps(primary, indent=2, sort_keys=True))
    print(f"Wrote route modes for {len(primary)} routes → {ROUTE_MODES_PATH}")


def ingest() -> int:
    if not RAW_DIR.is_dir():
        print(f"Error: raw data folder not found: {RAW_DIR}", file=sys.stderr)
        return 0

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    create_schema(conn)
    batch: list[tuple] = []
    total = 0
    skipped = 0

    mode_map = {"Buses": "bus", "Streetcars": "streetcar"}

    for folder, mode in mode_map.items():
        for csv_path in iter_csv_files(folder):
            file_rows = 0
            file_skipped = 0
            with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
                reader = csv.DictReader(handle)
                if not reader.fieldnames:
                    print(f"  skip empty {csv_path.name}", file=sys.stderr)
                    continue
                for raw in reader:
                    row = normalize_row(raw)
                    report = parse_date(row.get("Report Date", ""))
                    route = route_number(row.get("Route", ""))
                    if report is None or not route:
                        file_skipped += 1
                        continue
                    hour, minute, second = parse_time(row.get("Time", ""))
                    dt = report.replace(hour=hour, minute=minute, second=second)
                    quarter = (dt.month - 1) // 3 + 1
                    direction = normalize_direction(row.get("Direction", ""))
                    incident = (row.get("Incident") or "").strip()
                    batch.append(
                        (
                            mode,
                            dt.date().isoformat(),
                            dt.isoformat(sep=" "),
                            dt.year,
                            dt.month,
                            quarter,
                            route,
                            (row.get("Location") or "").strip(),
                            incident,
                            categorize_incident(incident),
                            float_or_zero(row.get("Min Delay", "")),
                            float_or_zero(row.get("Min Gap", "")),
                            (row.get("Direction") or "").strip(),
                            direction,
                            (row.get("Vehicle") or "").strip(),
                        )
                    )
                    file_rows += 1
                    if len(batch) >= 5000:
                        conn.executemany(
                            """
                            INSERT INTO delays (
                                mode, report_date, report_datetime, year, month, quarter,
                                route, location, incident, incident_category,
                                min_delay, min_gap, direction_raw, direction, vehicle
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            batch,
                        )
                        total += len(batch)
                        batch.clear()

            skipped += file_skipped
            print(
                f"  {csv_path.name}: {file_rows:,} rows ({mode}), skipped {file_skipped:,}",
                file=sys.stderr,
            )

    if batch:
        conn.executemany(
            """
            INSERT INTO delays (
                mode, report_date, report_datetime, year, month, quarter,
                route, location, incident, incident_category,
                min_delay, min_gap, direction_raw, direction, vehicle
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            batch,
        )
        total += len(batch)

    conn.commit()
    write_route_modes(conn)
    meta = conn.execute(
        "SELECT MIN(report_datetime), MAX(report_datetime), COUNT(*) FROM delays"
    ).fetchone()
    conn.close()
    print(f"Wrote {total:,} rows to {DB_PATH} (skipped {skipped:,} invalid rows)")
    print(f"Range: {meta[0]} – {meta[1]}")
    return total


if __name__ == "__main__":
    raise SystemExit(0 if ingest() else 1)
