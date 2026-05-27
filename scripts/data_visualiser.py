import csv
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

plt.style.use('_mpl-gallery-nogrid')

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_SOURCE = PROJECT_ROOT / "raw_data_sources/Buses/TTC Bus Delay Data since 2025.csv"
OUTPUT_PATH = PROJECT_ROOT / "data_visualisation.png"


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
        return [data_source]
    return sorted(data_source.rglob("*.csv"))


def count_zero_or_null_delay_gap_rows(data_source):
    matching_rows = 0
    other_rows = 0

    for csv_path in iter_csv_paths(data_source):
        with csv_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
            reader = csv.DictReader(csv_file)
            if not reader.fieldnames:
                continue
            if "Min Delay" not in reader.fieldnames or "Min Gap" not in reader.fieldnames:
                continue

            for row in reader:
                has_zero_or_null_delay_gap = (is_zero_or_null(row.get("Min Delay")) or is_zero_or_null(row.get("Min Gap")))

                if has_zero_or_null_delay_gap:
                    matching_rows += 1
                else:
                    other_rows += 1

    return matching_rows, other_rows


def make_pie_chart(counts, output_path):
    labels = ["Min Delay or Min Gap is 0/null", "Other rows"]
    colors = plt.get_cmap("Blues")(np.linspace(0.35, 0.75, len(counts)))

    fig, ax = plt.subplots(figsize=(8, 6))
    ax.pie(
        counts,
        labels=labels,
        colors=colors,
        autopct="%1.1f%%",
        startangle=90,
        wedgeprops={"linewidth": 1, "edgecolor": "white"},
    )
    ax.set_title("Rows by Min Delay / Min Gap Values")
    ax.axis("equal")

    plt.tight_layout()
    fig.savefig(output_path, dpi=300, bbox_inches="tight")
    return fig


counts = count_zero_or_null_delay_gap_rows(DATA_SOURCE)
fig = make_pie_chart(counts, OUTPUT_PATH)
print(f"Rows with Min Delay or Min Gap as 0/null: {counts[0]:,}")
print(f"Other rows: {counts[1]:,}")
print(f"Saved chart to: {OUTPUT_PATH}")

plt.show()
