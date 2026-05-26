#!/usr/bin/env python3
"""
Run the CSV merge from the editor (no terminal).

1. Edit INPUT_FILES and OUTPUT_FILE below (paths relative to project root).
2. Open this file in Cursor.
3. Click Run (▶) or press F5 and choose "Merge CSV (config)".

To merge every file in a folder, set USE_GLOB = True and GLOB_PATTERN instead.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from merge_csv import merge_csv_files

# --- Edit these settings ---
PROJECT_ROOT = Path(__file__).resolve().parents[1]

USE_GLOB = False
GLOB_PATTERN = "raw_data_sources/Streetcars/ttc-streetcar-delay-data-2021/*.csv"

INPUT_FILES = [
    "raw_data_sources/Streetcars/ttc-streetcar-delay-data-2021/ttc-streetcar-delay-data-2021-Jan 21.csv",
    "raw_data_sources/Streetcars/ttc-streetcar-delay-data-2021/ttc-streetcar-delay-data-2021-Feb 21.csv",
    "raw_data_sources/Streetcars/ttc-streetcar-delay-data-2021/ttc-streetcar-delay-data-2021-Mar 21.csv",
    "raw_data_sources/Streetcars/ttc-streetcar-delay-data-2021/ttc-streetcar-delay-data-2021-Apr 21.csv",
    "raw_data_sources/Streetcars/ttc-streetcar-delay-data-2021/ttc-streetcar-delay-data-2021-May 21.csv",
    "raw_data_sources/Streetcars/ttc-streetcar-delay-data-2021/ttc-streetcar-delay-data-2021-June 21.csv",
    "raw_data_sources/Streetcars/ttc-streetcar-delay-data-2021/ttc-streetcar-delay-data-2021-July 21.csv",
    "raw_data_sources/Streetcars/ttc-streetcar-delay-data-2021/ttc-streetcar-delay-data-2021-Aug 21.csv",
    "raw_data_sources/Streetcars/ttc-streetcar-delay-data-2021/ttc-streetcar-delay-data-2021-Sept 21.csv",
    "raw_data_sources/Streetcars/ttc-streetcar-delay-data-2021/ttc-streetcar-delay-data-2021-Oct 21.csv",
    "raw_data_sources/Streetcars/ttc-streetcar-delay-data-2021/ttc-streetcar-delay-data-2021-Nov 21.csv",
    "raw_data_sources/Streetcars/ttc-streetcar-delay-data-2021/ttc-streetcar-delay-data-2021-Dec 21.csv",
]

OUTPUT_FILE = "raw_data_sources/Streetcars/ttc-streetcar-delay-data-2021.csv"
# --- End of settings ---


def main() -> None:
    if USE_GLOB:
        input_paths = sorted(PROJECT_ROOT.glob(GLOB_PATTERN))
        if not input_paths:
            raise FileNotFoundError(f"No files matched: {GLOB_PATTERN!r}")
    else:
        input_paths = [PROJECT_ROOT / p for p in INPUT_FILES]

    output_path = PROJECT_ROOT / OUTPUT_FILE
    row_count = merge_csv_files(input_paths, output_path)
    print(f"Done: wrote {row_count:,} rows to {output_path}")


if __name__ == "__main__":
    main()
