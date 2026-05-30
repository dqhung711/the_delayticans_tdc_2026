interface Props {
  incidents?: number;
  totalDelay?: number;
  totalGap?: number;
  avgDelay?: number;
  incidentRate?: number;
  loading?: boolean;
  comparison?: {
    incidents: number;
    total_delay: number;
    total_gap: number;
  };
  avgDelayComp?: number;
  incidentRateComp?: number;
  compLabel?: string;
  rangeLength?: string;
}

export function ExplorerKpis({
  incidents,
  totalDelay,
  totalGap,
  avgDelay,
  incidentRate,
  loading,
  comparison,
  avgDelayComp,
  incidentRateComp,
  compLabel,
  rangeLength,
}: Props) {
  const fmt = (n?: number, decimals = 0) => {
    if (loading || n === undefined) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    return n.toLocaleString(undefined, {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    });
  };

  const pctChange = (curr?: number, prev?: number) => {
    if (curr === undefined || prev === undefined || prev === 0) return null;
    const change = ((curr - prev) / prev) * 100;
    const isUp = change > 0;
    return (
      <span className={`text-[10px] font-bold ${isUp ? "text-red-500" : "text-green-500"}`}>
        {isUp ? "↑" : "↓"} {Math.abs(change).toFixed(0)}% vs {compLabel}
      </span>
    );
  };

  const labelSuffix = rangeLength ? ` · ${rangeLength}` : "";

  return (
    <div className="kpi-strip chart-enter">
      <div className="kpi-card">
        <p className="kpi-card__label">Total incidents{labelSuffix}</p>
        <p className="kpi-card__value">{fmt(incidents)}</p>
        <div className="flex flex-col mt-1">
          {pctChange(incidents, comparison?.incidents)}
          <p className="text-[10px] text-[var(--muted)] mt-0.5">
            {rangeLength ? `Avg ${fmt(incidents ? incidents / parseInt(rangeLength, 10) : 0)} / year` : `${fmt(incidentRate, 1)} per month`}
          </p>
        </div>
      </div>
      <div className="kpi-card">
        <p className="kpi-card__label">Total delay{labelSuffix}</p>
        <p className="kpi-card__value">{fmt(totalDelay)} <span className="text-xs font-medium text-[var(--muted)]">min</span></p>
        <div className="flex flex-col mt-1">
          {pctChange(totalDelay, comparison?.total_delay)}
          <p className="text-[10px] text-[var(--muted)] mt-0.5">
            {rangeLength ? `Avg ${fmt(totalDelay ? totalDelay / parseInt(rangeLength, 10) : 0)} min / year` : `= ${fmt((totalDelay ?? 0) / 1440, 0)} days cumulative`}
          </p>
        </div>
      </div>
      <div className="kpi-card">
        <p className="kpi-card__label">Schedule gap{labelSuffix}</p>
        <p className="kpi-card__value">{fmt(totalGap)} <span className="text-xs font-medium text-[var(--muted)]">min</span></p>
        <div className="flex flex-col mt-1">
          {pctChange(totalGap, comparison?.total_gap)}
          <p className="text-[10px] text-[var(--muted)] mt-0.5">
            {rangeLength ? `Avg ${fmt(totalGap ? totalGap / parseInt(rangeLength, 10) : 0)} min / year` : `${totalDelay ? (totalGap / totalDelay).toFixed(1) : 0}x more than pure delay`}
          </p>
        </div>
      </div>
      <div className="kpi-card">
        <p className="kpi-card__label">Avg delay / incident</p>
        <p className="kpi-card__value">{fmt(avgDelay, 1)} <span className="text-xs font-medium text-[var(--muted)]">min</span></p>
        <div className="flex flex-col mt-1">
          {pctChange(avgDelay, avgDelayComp)}
          <p className="text-[10px] text-[var(--muted)] mt-0.5">
            Per reported incident
          </p>
        </div>
      </div>
      <div className="kpi-card">
        <p className="kpi-card__label">Incidents / month</p>
        <p className="kpi-card__value">{fmt(incidentRate, 1)}</p>
        <div className="flex flex-col mt-1">
          {pctChange(incidentRate, incidentRateComp)}
          <p className="text-[10px] text-[var(--muted)] mt-0.5">
            Monthly frequency
          </p>
        </div>
      </div>
    </div>
  );
}
