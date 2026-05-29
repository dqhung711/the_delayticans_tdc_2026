import type { Bucket } from "../types";
import { formatBucketTick } from "./chartTheme";

interface SeriesPoint {
  bucket: string;
  year: string;
  delay_minutes: number;
  gap_minutes: number;
  label: string;
}

/** Ensure every year in range appears on the X-axis (2014 … 2026). */
export function fillYearSeries(
  data: Array<{ bucket: string; delay_minutes: number; gap_minutes: number }>,
  startYear: number,
  endYear: number,
): SeriesPoint[] {
  const byYear = new Map<string, SeriesPoint>();
  for (const row of data) {
    const label = formatBucketTick("year", row.bucket);
    byYear.set(label, {
      bucket: row.bucket,
      year: label,
      delay_minutes: Number(row.delay_minutes) || 0,
      gap_minutes: Number(row.gap_minutes) || 0,
      label,
    });
  }
  const out: SeriesPoint[] = [];
  for (let y = startYear; y <= endYear; y += 1) {
    const label = String(y);
    out.push(
      byYear.get(label) ?? {
        bucket: label,
        year: label,
        label,
        delay_minutes: 0,
        gap_minutes: 0,
      },
    );
  }
  return out;
}

export function yearRangeFromData(
  data: Array<{ bucket: string }>,
  fallbackStart = 2014,
  fallbackEnd = 2026,
): { start: number; end: number } {
  const years = data
    .map((d) => parseInt(formatBucketTick("year", d.bucket), 10))
    .filter((y) => Number.isFinite(y));
  if (!years.length) return { start: fallbackStart, end: fallbackEnd };
  return { start: Math.min(...years), end: Math.max(...years) };
}

export function shouldFillYears(bucket: Bucket | string): boolean {
  return bucket === "year";
}
