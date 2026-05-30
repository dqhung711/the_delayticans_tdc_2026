import csv
import re
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

plt.style.use('_mpl-gallery-nogrid')

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_SOURCE = PROJECT_ROOT / "raw_data_sources"
OUTPUT_DIR = PROJECT_ROOT / "data_visualisations"
DELAY_COLUMNS = ("Min Delay", "Delay")
GAP_COLUMNS = ("Min Gap", "Gap")
YEAR_PATTERN = re.compile(r"20\d{2}")


def is_zero_or_null(value):
    if value is None:
        return True

    cleaned_value = value.strip()
    if cleaned_value == "" or cleaned_value.lower() in {"null", "none", "nan"}:
        return True

    try:
        return float(cleaned_value) == 0
    except ValueError:
        return False


def iter_csv_paths(data_source):
    if data_source.is_file():
        csv_paths = [data_source]
    else:
        csv_paths = sorted(data_source.rglob("*.csv"))

    return [
        csv_path
        for csv_path in csv_paths
        if csv_path.name != "Code Descriptions.csv"
    ]


def find_column(fieldnames, possible_names):
    for name in possible_names:
        if name in fieldnames:
            return name
    return None


def count_zero_or_null_delay_gap_rows(csv_path):
    matching_rows = 0
    other_rows = 0

    with csv_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        if not reader.fieldnames:
            return None

        delay_column = find_column(reader.fieldnames, DELAY_COLUMNS)
        gap_column = find_column(reader.fieldnames, GAP_COLUMNS)
        if delay_column is None or gap_column is None:
            return None

        for row in reader:
            has_zero_or_null_delay_gap = (
                is_zero_or_null(row.get(delay_column))
                or is_zero_or_null(row.get(gap_column))
            )

            if has_zero_or_null_delay_gap:
                matching_rows += 1
            else:
                other_rows += 1

    return matching_rows, other_rows


def output_path_for_csv(csv_path):
    relative_path = csv_path.relative_to(DATA_SOURCE).with_suffix(".png")
    return OUTPUT_DIR / relative_path


def percentage_zero_or_null(counts):
    total_rows = sum(counts)
    if total_rows == 0:
        return 0
    return counts[0] / total_rows * 100


def year_from_csv_path(csv_path):
    match = YEAR_PATTERN.search(csv_path.stem)
    if match is None:
        return None
    return int(match.group())


def vehicle_type_from_csv_path(csv_path):
    relative_parts = csv_path.relative_to(DATA_SOURCE).parts
    if not relative_parts:
        return None
    return relative_parts[0]


def make_pie_chart(csv_path, counts, output_path):
    labels = ["Min Delay or Min Gap is 0/null", "Other rows"]
    colors = plt.get_cmap("Blues")(np.linspace(0.35, 0.75, len(counts)))

    fig, ax = plt.subplots(figsize=(8, 6))
    if sum(counts) == 0:
        ax.text(0.5, 0.5, "No data rows found", ha="center", va="center")
        ax.axis("off")
    else:
        ax.pie(
            counts,
            labels=labels,
            colors=colors,
            autopct="%1.1f%%",
            startangle=90,
            wedgeprops={"linewidth": 1, "edgecolor": "white"},
        )
        ax.axis("equal")

    ax.set_title(csv_path.stem)

    plt.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    return fig


def make_yearly_percentage_bar_chart(vehicle_type, yearly_percentages):
    years = [year for year, percentage in yearly_percentages]
    percentages = [percentage for year, percentage in yearly_percentages]
    year_labels = ["Since 2025" if year == 2025 else str(year) for year in years]
    output_path = OUTPUT_DIR / vehicle_type / "zero_null_percentage_by_year.png"

    fig, ax = plt.subplots(figsize=(12, 6))
    bar_colors = plt.get_cmap("Blues")(np.linspace(0.35, 0.75, len(years)))
    bars = ax.bar(year_labels, percentages, color=bar_colors)

    ax.set_title(f"{vehicle_type}: Min Delay or Min Gap is 0/null by Year")
    ax.set_xlabel("Year")
    ax.set_ylabel("Rows with 0/null delay or gap (%)")
    ax.set_ylim(0, max(percentages, default=0) * 1.2 or 1)
    ax.bar_label(bars, labels=[f"{percentage:.1f}%" for percentage in percentages], padding=3, fontsize=8)

    plt.xticks(rotation=45, ha="right")
    plt.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    return output_path


def main():
    chart_count = 0
    yearly_percentages_by_vehicle_type = {
        "Buses": [],
        "Streetcars": [],
    }

    for csv_path in iter_csv_paths(DATA_SOURCE):
        counts = count_zero_or_null_delay_gap_rows(csv_path)
        if counts is None:
            print(f"Skipped {csv_path.relative_to(PROJECT_ROOT)}: missing Min Delay or Min Gap columns")
            continue

        output_path = output_path_for_csv(csv_path)
        make_pie_chart(csv_path, counts, output_path)
        chart_count += 1

        vehicle_type = vehicle_type_from_csv_path(csv_path)
        year = year_from_csv_path(csv_path)
        if vehicle_type in yearly_percentages_by_vehicle_type and year is not None:
            yearly_percentages_by_vehicle_type[vehicle_type].append(
                (year, percentage_zero_or_null(counts))
            )

        print(
            f"Saved {output_path.relative_to(PROJECT_ROOT)} "
            f"({counts[0]:,} zero/null rows, {counts[1]:,} other rows)"
        )

    print(f"Created {chart_count} pie chart(s) in {OUTPUT_DIR.relative_to(PROJECT_ROOT)}")

    bar_chart_count = 0
    for vehicle_type, yearly_percentages in yearly_percentages_by_vehicle_type.items():
        if not yearly_percentages:
            continue

        output_path = make_yearly_percentage_bar_chart(
            vehicle_type,
            sorted(yearly_percentages),
        )
        bar_chart_count += 1
        print(f"Saved {output_path.relative_to(PROJECT_ROOT)}")

    print(f"Created {bar_chart_count} yearly percentage bar chart(s)")


if __name__ == "__main__":
    main()
