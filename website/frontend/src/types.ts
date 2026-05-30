export type Tab = "live" | "explorer";
export type Mode = "streetcar" | "bus";
export type ViewMode = "overview" | "compare";
export type Granularity = "year" | "range" | "month" | "date" | "datetime" | "quarter";
export type TimeToggle = "year" | "range";
export type Bucket = "hour" | "day" | "month" | "year";
export type Direction = "EB" | "WB" | "NB" | "SB";

export interface Meta {
  overall: { min_year: number; max_year: number; total: number };
  byMode: Array<{ mode: string; total: number }>;
}

export interface OverviewCharts {
  compare: boolean;
  timeSeries: Array<{
    bucket: string;
    delay_minutes: number;
    gap_minutes: number;
    incidents: number;
  }>;
  hourlyTotals: Array<{
    hour: number;
    delay_minutes: number;
    gap_minutes: number;
  }>;
  dailyTotals?: Array<{
    day: number;
    delay_minutes: number;
    gap_minutes: number;
  }>;
  categories: Array<{
    category: string;
    delay_minutes: number;
    incidents: number;
  }>;
  hourlyByCategory: Array<{
    hour: number;
    category: string;
    delay_minutes: number;
  }>;
  routesByCategory?: Array<{
    route: string;
    category: string;
    delay_minutes: number;
  }>;
  periods?: Array<OverviewCharts & { label: string; interval: { start: string; end: string } }>;
  note?: string;
}

export interface LiveRouteCount {
  route: string;
  routeLabel: string;
  count: number;
}

export interface LiveAlertItem {
  id: string;
  category: string;
  title: string;
  description: string;
  routes: string[];
  routeLabel?: string | null;
  url?: string;
  lon?: number | null;
  lat?: number | null;
}

export interface LiveAlertCategory {
  id: string;
  name: string;
  totalCount: number;
  hideLineCounts: boolean;
  routeCounts: LiveRouteCount[];
  alerts?: LiveAlertItem[];
}

export interface LiveAdvisory {
  id: string;
  title: string;
  description: string;
  routes: string[];
  stops: string[];
  effect: string;
  mode: Mode | "unknown";
  category?: string;
  lat?: number;
  lon?: number;
  url?: string;
  hasExactLocation?: boolean;
  updatedAt: string;
}

export interface LiveSnapshot {
  updatedAt: string;
  sourceUpdatedAt?: string | null;
  categories: LiveAlertCategory[];
  advisories: LiveAdvisory[];
  highlightedRoutes: string[];
  refreshIntervalMinutes: number;
  source?: string;
}

export interface CompareInterval {
  id: string;
  start: string;
  end: string;
  label?: string;
}
