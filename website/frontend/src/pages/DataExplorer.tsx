import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchOverview, fetchRoutes, fetchSummary, type QueryParams } from "../api";
import { showDevUI } from "../lib/appConfig";
import { ExplorerKpis } from "../components/ExplorerKpis";
import { FilterBar } from "../components/FilterBar";
import { AiAssistant } from "../components/AiAssistant";
import { CategoryChart } from "../components/charts/CategoryChart";
import { HourlyStackedChart } from "../components/charts/HourlyStackedChart";
import { HourlyTotalsChart } from "../components/charts/HourlyTotalsChart";
import { TimeSeriesChart } from "../components/charts/TimeSeriesChart";
import type {
  Bucket,
  CompareInterval,
  Direction,
  Granularity,
  Meta,
  Mode,
  OverviewCharts,
  ViewMode,
} from "../types";

interface Props {
  mode: Mode;
  meta: Meta | null;
  onModeChange: (mode: Mode) => void;
}

export function DataExplorer({ mode, meta, onModeChange }: Props) {
  const [view, setView] = useState<ViewMode>("overview");
  const [granularity, setGranularity] = useState<Granularity>("year");
  const [timeToggle, setTimeToggle] = useState<"year" | "month">("year");
  const [start, setStart] = useState("2014");
  const [end, setEnd] = useState(String(meta?.overall.max_year ?? 2026));
  const [directions, setDirections] = useState<Direction[]>([]);
  const [bucket, setBucket] = useState<Bucket>("year");
  const [routes, setRoutes] = useState<string[]>([]);
  const [availableRoutes, setAvailableRoutes] = useState<
    Array<{ route: string; incidents: number }>
  >([]);
  const [compareIntervals, setCompareIntervals] = useState<CompareInterval[]>([]);
  const [charts, setCharts] = useState<OverviewCharts | null>(null);
  const [summary, setSummary] = useState<{
    incidents: number;
    total_delay: number;
    total_gap: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rangeInitialized, setRangeInitialized] = useState(false);
  useEffect(() => {
    if (meta && !rangeInitialized) {
      setEnd(String(meta.overall.max_year));
      setStart(String(meta.overall.min_year));
      setRangeInitialized(true);
    }
  }, [meta, rangeInitialized]);

  useEffect(() => {
    fetchRoutes(mode).then(setAvailableRoutes).catch(() => setAvailableRoutes([]));
  }, [mode]);

  const query: QueryParams = useMemo(
    () => ({
      mode,
      view,
      granularity,
      timeToggle,
      start,
      end,
      directions,
      routes,
      bucket,
      intervals: compareIntervals,
    }),
    [
      mode,
      view,
      granularity,
      timeToggle,
      start,
      end,
      directions,
      routes,
      bucket,
      compareIntervals,
    ],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, sum] = await Promise.all([
        fetchOverview(query),
        view === "overview" ? fetchSummary(query) : Promise.resolve(null),
      ]);
      setCharts(data);
      setSummary(sum);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load data";
      setError(
        showDevUI
          ? `${msg}. Ensure the API is running (npm run dev) — if port 8000 is busy, stop the other process and restart.`
          : "Could not load chart data. Please try again in a moment.",
      );
    } finally {
      setLoading(false);
    }
  }, [query, view]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const timeSeriesData = useMemo(() => {
    if (!charts || charts.compare) return [];
    return (charts.timeSeries ?? []).map((row) => ({
      ...row,
      delay_minutes: Number(row.delay_minutes) || 0,
      gap_minutes: Number(row.gap_minutes) || 0,
    }));
  }, [charts]);

  const onTimeToggleChange = (t: "year" | "month") => {
    setTimeToggle(t);
    setGranularity(t === "year" ? "year" : granularity === "year" ? "month" : granularity);
    if (t === "year") {
      const y = start.includes("-") ? start.slice(0, 4) : start;
      setStart(y);
      setEnd(y);
    } else {
      const y = start.length === 4 ? start : start.slice(0, 4);
      setStart(`${y}-01`);
      setEnd(`${y}-12`);
    }
  };

  return (
    <div className="page-enter explorer-layout">
      <FilterBar
        view={view}
        onViewChange={setView}
        granularity={granularity}
        onGranularityChange={setGranularity}
        timeToggle={timeToggle}
        onTimeToggleChange={onTimeToggleChange}
        start={start}
        end={end}
        onStartChange={setStart}
        onEndChange={setEnd}
        directions={directions}
        onDirectionsChange={setDirections}
        bucket={bucket}
        onBucketChange={setBucket}
        routes={routes}
        onRoutesChange={setRoutes}
        availableRoutes={availableRoutes}
        compareIntervals={compareIntervals}
        onCompareIntervalsChange={setCompareIntervals}
        mode={mode}
        onModeChange={onModeChange}
      />

      {loading && showDevUI && <p className="explorer-status">Loading analytics…</p>}
      {error && <p className="explorer-error">{error}</p>}

      {view === "overview" && (
        <ExplorerKpis
          loading={loading}
          incidents={summary?.incidents}
          totalDelay={summary?.total_delay}
          totalGap={summary?.total_gap}
        />
      )}

      <div className={view === "overview" ? "explorer-grid" : ""}>
        <div className="explorer-main flex flex-col gap-4">
          {view === "overview" && (
            <section className="main-chart-section">
              <TimeSeriesChart
                key={`${mode}-${start}-${end}-${bucket}-${directions.join(",")}`}
                data={timeSeriesData}
                title="Delay minutes & gap minutes over time"
                primary
                mode={mode}
                bucket={bucket}
                rangeStart={start}
                rangeEnd={end}
              />
              {!loading && charts && timeSeriesData.length === 0 && (
                <p className="explorer-error mt-2">
                  No rows in this range. Try clearing route filters or widening the year range.
                </p>
              )}
            </section>
          )}

          {charts && !charts.compare && view === "overview" && (
            <div className="explorer-charts-grid">
              <HourlyTotalsChart data={charts.hourlyTotals ?? []} mode={mode} />
              <CategoryChart data={charts.categories ?? []} mode={mode} />
              <HourlyStackedChart rows={charts.hourlyByCategory ?? []} mode={mode} />
            </div>
          )}
        </div>

        {view === "overview" && <AiAssistant />}
      </div>

      {charts?.compare && charts.periods && (
        <div className="explorer-compare">
          {charts.periods.map((period) => (
            <section key={period.label} className="explorer-compare__block">
              <h2 className="explorer-compare__heading">
                {period.label}
                <span>
                  {period.interval.start.slice(0, 10)} – {period.interval.end.slice(0, 10)}
                </span>
              </h2>
              <section className="main-chart-section">
                <TimeSeriesChart
                  data={period.timeSeries}
                  title="Delay & gap over time"
                  primary
                  mode={mode}
                  bucket={bucket}
                  rangeStart={period.interval.start.slice(0, 4)}
                  rangeEnd={period.interval.end.slice(0, 4)}
                />
              </section>
              <div className="explorer-charts-grid">
                <HourlyTotalsChart data={period.hourlyTotals ?? []} compact />
                <CategoryChart data={period.categories ?? []} compact />
                <HourlyStackedChart rows={period.hourlyByCategory ?? []} compact />
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
