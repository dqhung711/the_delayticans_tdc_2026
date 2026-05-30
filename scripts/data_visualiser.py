import csv
import hashlib
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
GROUPED_INVALID_VALUE_YEAR_RANGES = ((2014, 2019), (2020, 2025))
TARGET_DELAY_GAP_RATIOS = (
    ("1:1", 1, 1),
    ("1:2", 1, 2),
    ("1:3", 1, 3),
)
CATEGORY_COLORS = {
    "_id": "#4E79A7",
    "bound": "#A0CBE8",
    "code": "#F28E2B",
    "date": "#FFBE7D",
    "day": "#59A14F",
    "direction": "#8CD17D",
    "incident": "#B6992D",
    "line": "#F1CE63",
    "location": "#499894",
    "min delay": "#86BCB6",
    "min gap": "#E15759",
    "report date": "#FF9D9A",
    "route": "#79706E",
    "station": "#BAB0AC",
    "time": "#D37295",
    "vehicle": "#B07AA1",
}
FALLBACK_CATEGORY_COLORS = [
    "#4E79A7",
    "#F28E2B",
    "#59A14F",
    "#E15759",
    "#76B7B2",
    "#EDC948",
    "#B07AA1",
    "#FF9DA7",
    "#9C755F",
    "#BAB0AC",
]


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


def is_null_value(value):
    if value is None:
        return True

    cleaned_value = value.strip()
    return cleaned_value == "" or cleaned_value.lower() in {"null", "none", "nan"}


def is_zero_or_negative_value(value):
    if is_null_value(value):
        return False

    try:
        return float(value.strip()) <= 0
    except ValueError:
        return False


def is_null_zero_or_negative(value):
    return is_null_value(value) or is_zero_or_negative_value(value)


def numeric_value(value):
    if is_null_value(value):
        return None

    try:
        return float(value.strip())
    except ValueError:
        return None


def category_color(column_name):
    normalized_column_name = column_name.strip().lower()
    if normalized_column_name in CATEGORY_COLORS:
        return CATEGORY_COLORS[normalized_column_name]

    color_index = int(
        hashlib.sha256(normalized_column_name.encode("utf-8")).hexdigest(),
        16,
    ) % len(FALLBACK_CATEGORY_COLORS)
    return FALLBACK_CATEGORY_COLORS[color_index]


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


def count_null_zero_negative_values_by_column(csv_path):
    with csv_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        if not reader.fieldnames:
            return None

        invalid_counts = {column: 0 for column in reader.fieldnames}
        for row in reader:
            for column in reader.fieldnames:
                if is_null_zero_or_negative(row.get(column)):
                    invalid_counts[column] += 1

    return {
        column: count
        for column, count in invalid_counts.items()
        if count > 0
    }


def count_unusual_values_by_column(csv_path):
    with csv_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        if not reader.fieldnames:
            return None

        counts = {
            column: {"zero_or_negative": 0, "null": 0}
            for column in reader.fieldnames
        }
        total_rows = 0

        for row in reader:
            total_rows += 1
            for column in reader.fieldnames:
                value = row.get(column)
                if is_null_value(value):
                    counts[column]["null"] += 1
                elif is_zero_or_negative_value(value):
                    counts[column]["zero_or_negative"] += 1

    return total_rows, counts


def count_rows_with_null_zero_or_negative_value(csv_path):
    matching_rows = 0
    total_rows = 0

    with csv_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        if not reader.fieldnames:
            return None

        for row in reader:
            total_rows += 1
            if any(
                is_null_zero_or_negative(row.get(column))
                for column in reader.fieldnames
            ):
                matching_rows += 1

    return matching_rows, total_rows


def count_delay_gap_ratios(csv_path):
    ratio_counts = {label: 0 for label, _delay, _gap in TARGET_DELAY_GAP_RATIOS}
    total_valid_rows = 0

    with csv_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        if not reader.fieldnames:
            return None

        delay_column = find_column(reader.fieldnames, DELAY_COLUMNS)
        gap_column = find_column(reader.fieldnames, GAP_COLUMNS)
        if delay_column is None or gap_column is None:
            return None

        for row in reader:
            delay = numeric_value(row.get(delay_column))
            gap = numeric_value(row.get(gap_column))
            if delay is None or gap is None or delay == 0 or gap == 0:
                continue

            total_valid_rows += 1
            for label, ratio_delay, ratio_gap in TARGET_DELAY_GAP_RATIOS:
                if np.isclose(delay * ratio_gap, gap * ratio_delay):
                    ratio_counts[label] += 1
                    break

    return total_valid_rows, ratio_counts


def output_path_for_csv(csv_path):
    relative_path = csv_path.relative_to(DATA_SOURCE).with_suffix(".png")
    return OUTPUT_DIR / relative_path


def percentage_of_total(matching_rows, total_rows):
    if total_rows == 0:
        return 0
    return matching_rows / total_rows * 100


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


def make_invalid_value_column_pie_chart(csv_path, invalid_counts, output_path):
    fig, ax = plt.subplots(figsize=(10, 7))

    if not invalid_counts:
        ax.text(
            0.5,
            0.5,
            "No null, zero, or negative values found",
            ha="center",
            va="center",
        )
        ax.axis("off")
    else:
        labels = list(invalid_counts.keys())
        counts = list(invalid_counts.values())
        colors = [category_color(label) for label in labels]

        wedges, _texts, _autotexts = ax.pie(
            counts,
            colors=colors,
            autopct="%1.1f%%",
            startangle=90,
            pctdistance=0.8,
            wedgeprops={"linewidth": 1, "edgecolor": "white"},
        )
        ax.axis("equal")
        ax.legend(
            wedges,
            [f"{label} ({count:,})" for label, count in zip(labels, counts)],
            title="Column",
            loc="center left",
            bbox_to_anchor=(1, 0, 0.5, 1),
        )

    ax.set_title(f"{csv_path.stem}: null, zero, or negative values by column")

    plt.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    return output_path


def make_yearly_invalid_value_column_pie_charts(data_source=DATA_SOURCE):
    chart_paths = []

    for csv_path in iter_csv_paths(data_source):
        year = year_from_csv_path(csv_path)
        vehicle_type = vehicle_type_from_csv_path(csv_path)
        if year is None or vehicle_type is None:
            continue

        invalid_counts = count_null_zero_negative_values_by_column(csv_path)
        if invalid_counts is None:
            print(f"Skipped {csv_path.relative_to(PROJECT_ROOT)}: no header row found")
            continue

        output_path = (
            OUTPUT_DIR
            / vehicle_type
            / f"null_zero_negative_values_by_column_{year}.png"
        )
        chart_paths.append(
            make_invalid_value_column_pie_chart(csv_path, invalid_counts, output_path)
        )

    return chart_paths


def make_grouped_invalid_value_column_pie_chart_images(
    vehicle_types=("Buses", "Streetcars"),
    year_ranges=GROUPED_INVALID_VALUE_YEAR_RANGES,
):
    grouped_chart_paths = []

    for vehicle_type in vehicle_types:
        vehicle_output_dir = OUTPUT_DIR / vehicle_type

        for start_year, end_year in year_ranges:
            years = range(start_year, end_year + 1)
            chart_paths = [
                vehicle_output_dir / f"null_zero_negative_values_by_column_{year}.png"
                for year in years
            ]
            missing_paths = [path for path in chart_paths if not path.is_file()]
            if missing_paths:
                print(
                    f"Skipped grouped chart for {vehicle_type} {start_year}-{end_year}: "
                    "missing "
                    + ", ".join(str(path.relative_to(PROJECT_ROOT)) for path in missing_paths)
                )
                continue

            fig, axes = plt.subplots(3, 2, figsize=(14, 24))
            for ax, year, chart_path in zip(axes.ravel(), years, chart_paths):
                ax.imshow(plt.imread(chart_path))
                ax.set_title(str(year), fontsize=18, pad=8)
                ax.axis("off")

            fig.suptitle(
                f"{vehicle_type}: null, zero, or negative values by column "
                f"({start_year}-{end_year})",
                fontsize=24,
                y=0.99,
            )
            plt.tight_layout(rect=(0, 0, 1, 0.96))

            output_path = (
                vehicle_output_dir
                / f"null_zero_negative_values_by_column_{start_year}_to_{end_year}.png"
            )
            fig.savefig(output_path, dpi=300, bbox_inches="tight")
            plt.close(fig)
            grouped_chart_paths.append(output_path)

    return grouped_chart_paths


def make_unusual_value_table(csv_path, total_rows, counts_by_column, output_path):
    table_rows = []
    for column, counts in counts_by_column.items():
        zero_or_negative_count = counts["zero_or_negative"]
        null_count = counts["null"]
        unusual_count = zero_or_negative_count + null_count
        unusual_percentage = (
            unusual_count / total_rows * 100
            if total_rows > 0
            else 0
        )

        table_rows.append(
            [
                column,
                f"{zero_or_negative_count:,}",
                f"{null_count:,}",
                f"{unusual_percentage:.2f}%",
            ]
        )

    fig_height = max(4, len(table_rows) * 0.42 + 2.2)
    fig, ax = plt.subplots(figsize=(14, fig_height))
    ax.axis("off")
    ax.set_title(
        "Number of zeros or negative values, null values in each column\n"
        f"{csv_path.stem} - total rows: {total_rows:,}",
        fontsize=14,
        pad=18,
    )

    table = ax.table(
        cellText=table_rows,
        colLabels=[
            "Column name",
            "Number of zero or negative values",
            "Number of null values",
            "Percentage of unusual values to total number of rows",
        ],
        cellLoc="center",
        colLoc="center",
        colWidths=[0.22, 0.26, 0.18, 0.34],
        loc="center",
    )
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1, 1.35)

    for (row_index, _column_index), cell in table.get_celld().items():
        cell.set_edgecolor("#CCCCCC")
        if row_index == 0:
            cell.set_facecolor("#EAEAEA")
            cell.set_text_props(weight="bold")
        elif row_index % 2 == 0:
            cell.set_facecolor("#F7F7F7")

    plt.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    return output_path


def make_yearly_unusual_value_tables(data_source=DATA_SOURCE):
    table_paths = []

    for csv_path in iter_csv_paths(data_source):
        year = year_from_csv_path(csv_path)
        vehicle_type = vehicle_type_from_csv_path(csv_path)
        if year is None or vehicle_type is None:
            continue

        unusual_counts = count_unusual_values_by_column(csv_path)
        if unusual_counts is None:
            print(f"Skipped {csv_path.relative_to(PROJECT_ROOT)}: no header row found")
            continue

        total_rows, counts_by_column = unusual_counts
        output_path = (
            OUTPUT_DIR
            / vehicle_type
            / f"unusual_values_table_{year}.png"
        )
        table_paths.append(
            make_unusual_value_table(
                csv_path,
                total_rows,
                counts_by_column,
                output_path,
            )
        )

    return table_paths


def make_yearly_null_zero_negative_row_percentage_bar_chart(
    vehicle_type,
    yearly_row_counts,
):
    years = sorted(yearly_row_counts)
    percentages = [
        percentage_of_total(*yearly_row_counts[year])
        for year in years
    ]
    year_labels = ["Since 2025" if year == 2025 else str(year) for year in years]
    output_path = (
        OUTPUT_DIR
        / vehicle_type
        / "null_zero_negative_row_percentage_by_year.png"
    )

    fig, ax = plt.subplots(figsize=(12, 6))
    bar_colors = plt.get_cmap("Oranges")(np.linspace(0.35, 0.75, len(years)))
    bars = ax.bar(year_labels, percentages, color=bar_colors)

    ax.set_title(
        f"{vehicle_type}: rows with at least one null, zero, or negative value by year"
    )
    ax.set_xlabel("Year")
    ax.set_ylabel("Rows with at least one null, zero, or negative value (%)")
    ax.set_ylim(0, max(percentages, default=0) * 1.2 or 1)
    ax.bar_label(
        bars,
        labels=[f"{percentage:.1f}%" for percentage in percentages],
        padding=3,
        fontsize=8,
    )

    plt.xticks(rotation=45, ha="right")
    plt.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    return output_path


def make_yearly_null_zero_negative_row_percentage_bar_charts(data_source=DATA_SOURCE):
    yearly_counts_by_vehicle_type = {
        "Buses": {},
        "Streetcars": {},
    }

    for csv_path in iter_csv_paths(data_source):
        vehicle_type = vehicle_type_from_csv_path(csv_path)
        year = year_from_csv_path(csv_path)
        if vehicle_type not in yearly_counts_by_vehicle_type or year is None:
            continue

        counts = count_rows_with_null_zero_or_negative_value(csv_path)
        if counts is None:
            print(f"Skipped {csv_path.relative_to(PROJECT_ROOT)}: no header row found")
            continue

        matching_rows, total_rows = counts
        previous_matching_rows, previous_total_rows = (
            yearly_counts_by_vehicle_type[vehicle_type].get(year, (0, 0))
        )
        yearly_counts_by_vehicle_type[vehicle_type][year] = (
            previous_matching_rows + matching_rows,
            previous_total_rows + total_rows,
        )

    chart_paths = []
    for vehicle_type, yearly_row_counts in yearly_counts_by_vehicle_type.items():
        if yearly_row_counts:
            chart_paths.append(
                make_yearly_null_zero_negative_row_percentage_bar_chart(
                    vehicle_type,
                    yearly_row_counts,
                )
            )

    return chart_paths


def make_yearly_delay_gap_ratio_line_chart(vehicle_type, yearly_ratio_counts):
    years = sorted(yearly_ratio_counts)
    year_labels = ["Since 2025" if year == 2025 else str(year) for year in years]
    output_path = OUTPUT_DIR / vehicle_type / "delay_gap_ratio_percentage_by_year.png"

    fig, ax = plt.subplots(figsize=(12, 6))
    line_colors = {
        "1:1": "#4E79A7",
        "1:2": "#F28E2B",
        "1:3": "#59A14F",
    }

    for label, _ratio_delay, _ratio_gap in TARGET_DELAY_GAP_RATIOS:
        percentages = []
        for year in years:
            total_valid_rows, ratio_counts = yearly_ratio_counts[year]
            percentages.append(
                percentage_of_total(ratio_counts[label], total_valid_rows)
            )

        ax.plot(
            year_labels,
            percentages,
            marker="o",
            linewidth=2,
            color=line_colors[label],
            label=label,
        )

    ax.set_title(f"{vehicle_type}: Min Delay to Min Gap ratio trend by year")
    ax.set_xlabel("Year")
    ax.set_ylabel("Rows with ratio (%)")
    ax.set_ylim(bottom=0)
    ax.legend(title="Delay:Gap")
    ax.grid(axis="y", alpha=0.3)

    plt.xticks(rotation=45, ha="right")
    plt.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    return output_path


def make_yearly_delay_gap_ratio_line_charts(data_source=DATA_SOURCE):
    yearly_ratio_counts_by_vehicle_type = {
        "Buses": {},
        "Streetcars": {},
    }

    for csv_path in iter_csv_paths(data_source):
        vehicle_type = vehicle_type_from_csv_path(csv_path)
        year = year_from_csv_path(csv_path)
        if vehicle_type not in yearly_ratio_counts_by_vehicle_type or year is None:
            continue

        counts = count_delay_gap_ratios(csv_path)
        if counts is None:
            print(f"Skipped {csv_path.relative_to(PROJECT_ROOT)}: missing delay or gap columns")
            continue

        total_valid_rows, ratio_counts = counts
        current_total_rows, current_ratio_counts = (
            yearly_ratio_counts_by_vehicle_type[vehicle_type].get(
                year,
                (
                    0,
                    {
                        label: 0
                        for label, _ratio_delay, _ratio_gap in TARGET_DELAY_GAP_RATIOS
                    },
                ),
            )
        )

        yearly_ratio_counts_by_vehicle_type[vehicle_type][year] = (
            current_total_rows + total_valid_rows,
            {
                label: current_ratio_counts[label] + ratio_counts[label]
                for label, _ratio_delay, _ratio_gap in TARGET_DELAY_GAP_RATIOS
            },
        )

    chart_paths = []
    for vehicle_type, yearly_ratio_counts in yearly_ratio_counts_by_vehicle_type.items():
        if yearly_ratio_counts:
            chart_paths.append(
                make_yearly_delay_gap_ratio_line_chart(
                    vehicle_type,
                    yearly_ratio_counts,
                )
            )

    return chart_paths


def main():
    chart_count = 0

    for csv_path in iter_csv_paths(DATA_SOURCE):
        counts = count_zero_or_null_delay_gap_rows(csv_path)
        if counts is None:
            print(f"Skipped {csv_path.relative_to(PROJECT_ROOT)}: missing Min Delay or Min Gap columns")
            continue

        output_path = output_path_for_csv(csv_path)
        make_pie_chart(csv_path, counts, output_path)
        chart_count += 1

        print(
            f"Saved {output_path.relative_to(PROJECT_ROOT)} "
            f"({counts[0]:,} zero/null rows, {counts[1]:,} other rows)"
        )

    print(f"Created {chart_count} pie chart(s) in {OUTPUT_DIR.relative_to(PROJECT_ROOT)}")

    row_percentage_bar_chart_paths = (
        make_yearly_null_zero_negative_row_percentage_bar_charts(DATA_SOURCE)
    )
    for output_path in row_percentage_bar_chart_paths:
        print(f"Saved {output_path.relative_to(PROJECT_ROOT)}")

    print(
        "Created "
        f"{len(row_percentage_bar_chart_paths)} yearly null/zero/negative row "
        "percentage bar chart(s)"
    )

    ratio_line_chart_paths = make_yearly_delay_gap_ratio_line_charts(DATA_SOURCE)
    for output_path in ratio_line_chart_paths:
        print(f"Saved {output_path.relative_to(PROJECT_ROOT)}")

    print(f"Created {len(ratio_line_chart_paths)} yearly delay/gap ratio line chart(s)")

    invalid_value_chart_paths = make_yearly_invalid_value_column_pie_charts(DATA_SOURCE)
    for output_path in invalid_value_chart_paths:
        print(f"Saved {output_path.relative_to(PROJECT_ROOT)}")

    print(f"Created {len(invalid_value_chart_paths)} null/zero/negative column pie chart(s)")

    unusual_value_table_paths = make_yearly_unusual_value_tables(DATA_SOURCE)
    for output_path in unusual_value_table_paths:
        print(f"Saved {output_path.relative_to(PROJECT_ROOT)}")

    print(f"Created {len(unusual_value_table_paths)} unusual value table image(s)")

    grouped_invalid_value_chart_paths = make_grouped_invalid_value_column_pie_chart_images()
    for output_path in grouped_invalid_value_chart_paths:
        print(f"Saved {output_path.relative_to(PROJECT_ROOT)}")

    print(f"Created {len(grouped_invalid_value_chart_paths)} grouped null/zero/negative column pie chart image(s)")


if __name__ == "__main__":
    main()
