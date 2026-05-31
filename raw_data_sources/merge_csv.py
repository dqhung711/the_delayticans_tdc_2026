#!/usr/bin/env python3
"""
Merge multiple CSV files in order into a single CSV.

Each file after the first is appended immediately after the previous file's
last row (the last line of file N is followed by the first data row of file N+1).
Duplicate header rows are skipped by default.

Usage:
  python scripts/merge_csv.py -o merged.csv file1.csv file2.csv file3.csv
  python scripts/merge_csv.py -o merged.csv --glob "data/*.csv"
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path


def merge_csv_files(input_paths: list[Path], output_path: Path, *, skip_header_after_first: bool = True, encoding: str = "utf-8-sig",) -> int:
    """Merge CSV files in order. Returns total number of data rows written."""
    if not input_paths:
        raise ValueError("At least one input CSV file is required.")

    missing = [p for p in input_paths if not p.is_file()]
    if missing:
        raise FileNotFoundError(
            "Input file(s) not found:\n" + "\n".join(f"  {p}" for p in missing)
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    total_rows = 0
    expected_header: list[str] | None = None

    with output_path.open("w", encoding=encoding, newline="") as out_file:
        writer: csv.writer | None = None

        for index, path in enumerate(input_paths):
            with path.open("r", encoding=encoding, newline="") as in_file:
                reader = csv.reader(in_file)
                try:
                    header = next(reader)
                except StopIteration:
                    print(f"warning: skipping empty file {path}", file=sys.stderr)
                    continue

                if index == 0:
                    expected_header = header
                    writer = csv.writer(out_file)
                    writer.writerow(header)
                else:
                    if skip_header_after_first and header == expected_header:
                        pass  # drop duplicate header
                    elif skip_header_after_first and header != expected_header:
                        print(
                            f"warning: {path} has a different header; "
                            "treating first row as data",
                            file=sys.stderr,
                        )
                        if writer is not None:
                            writer.writerow(header)
                            total_rows += 1
                    elif not skip_header_after_first and writer is not None:
                        writer.writerow(header)
                        total_rows += 1

                if writer is None:
                    raise RuntimeError("No header row found in first input file.")

                for row in reader:
                    writer.writerow(row)
                    total_rows += 1

    return total_rows


def collect_paths_from_glob(pattern: str) -> list[Path]:
    paths = sorted(Path().glob(pattern))
    if not paths:
        raise FileNotFoundError(f"No files matched glob: {pattern!r}")
    return paths


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Merge CSV files in order into one output file."
    )
    parser.add_argument(
        "-o",
        "--output",
        required=True,
        type=Path,
        help="Path for the merged CSV file",
    )
    parser.add_argument(
        "inputs",
        nargs="*",
        type=Path,
        help="Input CSV files, in merge order (left to right)",
    )
    parser.add_argument(
        "--glob",
        dest="glob_pattern",
        metavar="PATTERN",
        help='Glob for input files (sorted); e.g. "raw_data_sources/Buses/2014/*.csv"',
    )
    parser.add_argument(
        "--encoding",
        default="utf-8-sig",
        help="Text encoding for read/write (default: utf-8-sig)",
    )
    parser.add_argument(
        "--keep-all-headers",
        action="store_true",
        help="Write every file's header row (default: only the first file)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    if args.glob_pattern:
        if args.inputs:
            print("error: use either positional files or --glob, not both", file=sys.stderr)
            return 2
        input_paths = collect_paths_from_glob(args.glob_pattern)
    elif args.inputs:
        input_paths = list(args.inputs)
    else:
        print("error: provide input files or --glob", file=sys.stderr)
        return 2

    try:
        row_count = merge_csv_files(
            input_paths,
            args.output,
            skip_header_after_first=not args.keep_all_headers,
            encoding=args.encoding,
        )
    except (ValueError, FileNotFoundError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(
        f"Wrote {row_count:,} data rows from {len(input_paths)} file(s) to {args.output}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
