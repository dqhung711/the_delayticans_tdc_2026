interface Props {
  incidents?: number;
  totalDelay?: number;
  totalGap?: number;
  loading?: boolean;
}

export function ExplorerKpis({ incidents, totalDelay, totalGap, loading }: Props) {
  const fmt = (n?: number) =>
    loading || n === undefined ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div className="kpi-strip chart-enter">
      <div className="kpi-card">
        <p className="kpi-card__label">Incidents</p>
        <p className="kpi-card__value">{fmt(incidents)}</p>
      </div>
      <div className="kpi-card">
        <p className="kpi-card__label">Total delay (min)</p>
        <p className="kpi-card__value">{fmt(totalDelay)}</p>
      </div>
      <div className="kpi-card">
        <p className="kpi-card__label">Total gap (min)</p>
        <p className="kpi-card__value">{fmt(totalGap)}</p>
      </div>
    </div>
  );
}
