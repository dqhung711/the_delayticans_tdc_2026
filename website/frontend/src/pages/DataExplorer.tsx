import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchOverview, fetchRoutes, fetchSummary, type QueryParams } from "../api";
import { showDevUI } from "../lib/appConfig";
import { ExplorerKpis } from "../components/ExplorerKpis";
import { FilterBar } from "../components/FilterBar";
import { AiAssistant } from "../components/AiAssistant";
import { CategoryChart } from "../components/charts/CategoryChart";
import { RouteStackedChart } from "../components/charts/RouteStackedChart";
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
  const [timeToggle, setTimeToggle] = useState<"year" | "range">("year");
  const [start, setStart] = useState("2014");
  const [end, setEnd] = useState(String(meta?.overall.max_year ?? 2026));
  const [directions, setDirections] = useState<Direction[]>([]);
  const [bucket, setBucket] = useState<Bucket>("year");
  const [routes, setRoutes] = useState<string[]>([]);
  const [availableRoutes, setAvailableRoutes] = useState<
    Array<{ route: string; incidents: number }>
  >([]);
  const [charts, setCharts] = useState<OverviewCharts | null>(null);
  const [summary, setSummary] = useState<{
    incidents: number;
    total_delay: number;
    total_gap: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparisonSummary, setComparisonSummary] = useState<{
    incidents: number;
    total_delay: number;
    total_gap: number;
  } | null>(null);

  const monthsInRange = useMemo(() => {
    let s = start;
    let e = end;
    if (s.length === 4) s = `${s}-01`;
    if (e.length === 4) e = `${e}-12`;

    const [sy, sm] = s.split("-").map(Number);
    const [ey, em] = e.split("-").map(Number);

    return (ey - sy) * 12 + (em - sm + 1);
  }, [start, end]);

  const avgDelay = useMemo(() => {
    if (!summary || !summary.incidents) return 0;
    return summary.total_delay / summary.incidents;
  }, [summary]);

  const avgDelayComp = useMemo(() => {
    if (!comparisonSummary || !comparisonSummary.incidents) return 0;
    return comparisonSummary.total_delay / comparisonSummary.incidents;
  }, [comparisonSummary]);

  const incidentRate = useMemo(() => {
    if (!summary || !monthsInRange) return 0;
    return summary.incidents / monthsInRange;
  }, [summary, monthsInRange]);

  const incidentRateComp = useMemo(() => {
    if (!comparisonSummary || !monthsInRange) return 0;
    return comparisonSummary.incidents / monthsInRange;
  }, [comparisonSummary, monthsInRange]);

  const compLabel = useMemo(() => {
    if (timeToggle !== "year") return undefined;
    if (start === end) {
      return String(parseInt(start, 10) - 1);
    } else {
      const diff = parseInt(end, 10) - parseInt(start, 10) + 1;
      const prevStart = parseInt(start, 10) - diff;
      const prevEnd = parseInt(start, 10) - 1;
      return `${prevStart}–${prevEnd}`;
    }
  }, [start, end, timeToggle]);

  const rangeLengthLabel = useMemo(() => {
    if (timeToggle !== "year" || start === end) return undefined;
    const diff = parseInt(end, 10) - parseInt(start, 10) + 1;
    return `${diff} yr`;
  }, [start, end, timeToggle]);

  const [rangeInitialized, setRangeInitialized] = useState(false);
  useEffect(() => {
    if (meta && !rangeInitialized) {
      const latest = String(meta.overall.max_year);
      if (timeToggle === "year") {
        setStart(latest);
        setEnd(latest);
      } else {
        setStart(String(meta.overall.min_year));
        setEnd(latest);
      }
      setRangeInitialized(true);
    }
  }, [meta, rangeInitialized, timeToggle]);

  useEffect(() => {
    fetchRoutes(mode).then(setAvailableRoutes).catch(() => setAvailableRoutes([]));
  }, [mode]);

  const query: QueryParams = useMemo(
    () => ({
      mode,
      view,
      granularity: timeToggle === "year" ? "year" : "range",
      timeToggle,
      start,
      end,
      directions,
      routes,
      bucket,
    }),
    [
      mode,
      view,
      timeToggle,
      start,
      end,
      directions,
      routes,
      bucket,
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

      // Automatic comparison logic
      if (view === "overview" && timeToggle === "year") {
        if (start === end) {
          const prevYear = String(parseInt(start, 10) - 1);
          const compQuery = { ...query, start: prevYear, end: prevYear };
          fetchSummary(compQuery).then(setComparisonSummary).catch(() => setComparisonSummary(null));
        } else {
          const diff = parseInt(end, 10) - parseInt(start, 10) + 1;
          const prevStart = String(parseInt(start, 10) - diff);
          const prevEnd = String(parseInt(start, 10) - 1);
          const compQuery = { ...query, start: prevStart, end: prevEnd };
          fetchSummary(compQuery).then(setComparisonSummary).catch(() => setComparisonSummary(null));
        }
      } else {
        setComparisonSummary(null);
      }
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

  const onTimeToggleChange = (t: "year" | "range") => {
    setTimeToggle(t);
    if (t === "year") {
      const y = start.includes("-") ? start.slice(0, 4) : start;
      setStart(y);
      setEnd(y);
      setBucket("month");
    } else {
      const y = start.length === 4 ? start : start.slice(0, 4);
      setStart(y);
      const nextYear = String(parseInt(y, 10) + 1);
      setEnd(nextYear);
      setBucket("month");
    }
  };

  useEffect(() => {
    if (timeToggle === "year") {
      // Single year: allow day/month. Default to month if not set to day.
      if (bucket !== "day" && bucket !== "month") {
        setBucket("month");
      }
    } else {
      // Year range: only month.
      setBucket("month");
    }
  }, [timeToggle, start, end]);

  return (
    <div className="page-enter explorer-layout">
      <FilterBar
        view={view}
        onViewChange={setView}
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
        compLabel={compLabel}
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
          avgDelay={avgDelay}
          incidentRate={incidentRate}
          comparison={comparisonSummary ?? undefined}
          avgDelayComp={avgDelayComp}
          incidentRateComp={incidentRateComp}
          compLabel={compLabel}
          rangeLength={rangeLengthLabel}
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
              <HourlyTotalsChart
                data={charts.hourlyTotals ?? []}
                dailyData={charts.dailyTotals ?? []}
                mode={mode}
              />
              <CategoryChart data={charts.categories ?? []} mode={mode} />
            </div>
          )}
        </div>

        {view === "overview" && <AiAssistant />}
      </div>

      {view === "overview" && timeToggle === "year" && start === end && (
        <div className="mt-4 p-3 bg-white/50 border border-[var(--border)] rounded-lg flex items-center gap-2 text-xs text-[var(--muted)]">
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Cards show <strong>{start} totals</strong> compared automatically against <strong>{parseInt(start, 10) - 1}</strong> — the previous equivalent period.
          </span>
        </div>
      )}

      {view === "overview" && timeToggle === "year" && start !== end && (
        <div className="mt-4 p-3 bg-white/50 border border-[var(--border)] rounded-lg flex items-center gap-2 text-xs text-[var(--muted)]">
          <svg className="w-4 h-4 text-[var(--muted)] opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span>
            Cards show <strong>{rangeLengthLabel} totals ({start}–{end})</strong> with per-year averages. Compared automatically against <strong>the equal prior period {compLabel}</strong>.
          </span>
        </div>
      )}

    </div>
  );
}
