/** Nice round Y-axis tick values up to max (milestone-style grid lines). */
export function milestoneTicks(maxValue: number, targetCount = 5): number[] {
  const max = Math.max(0, Number(maxValue) || 0);
  if (max === 0) return [0];

  const roughStep = max / Math.max(targetCount - 1, 1);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  let niceStep = magnitude;
  if (normalized <= 1) niceStep = magnitude;
  else if (normalized <= 2) niceStep = 2 * magnitude;
  else if (normalized <= 5) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;

  const ticks: number[] = [0];
  let v = niceStep;
  const ceiling = max * 1.08;
  while (v <= ceiling) {
    ticks.push(Math.round(v));
    v += niceStep;
  }
  return ticks;
}

export function formatDelayTick(n: number): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(Math.round(v));
}

export function maxOfSeries(
  rows: Array<Record<string, unknown>>,
  keys: string[],
): number {
  let max = 0;
  for (const row of rows) {
    for (const key of keys) {
      const v = Number(row[key]);
      if (Number.isFinite(v)) max = Math.max(max, v);
    }
  }
  return max;
}
