import { useEffect, useState } from "react";
import type { Mode, Tab } from "../types";

interface Props {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  yearRange: string;
  incidentCount: string;
  themeToggle: React.ReactNode;
}

export function AppHeader({
  tab,
  onTabChange,
  mode,
  onModeChange,
  yearRange,
  incidentCount,
  themeToggle,
}: Props) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = currentTime.toLocaleTimeString("en-US", {
    timeZone: "America/Toronto",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const dateStr = currentTime.toLocaleDateString("en-US", {
    timeZone: "America/Toronto",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="flex items-center gap-8">
          <h1 className="app-header__title">TTC Delays</h1>

          <nav className="app-header__nav" aria-label="Main">
            <button
              type="button"
              onClick={() => onTabChange("live")}
              className={`app-header__link ${tab === "live" ? "app-header__link--active" : ""}`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Live map
              </span>
            </button>
            <button
              type="button"
              onClick={() => onTabChange("explorer")}
              className={`app-header__link ${tab === "explorer" ? "app-header__link--active" : ""}`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Data explorer
              </span>
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-6 ml-auto">
          <div className="text-right leading-tight">
            <div className="text-sm font-bold text-[var(--text)]">
              {timeStr.toLowerCase()} p.m. EDT
            </div>
            <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider">
              {dateStr}
            </div>
          </div>

          {tab === "live" && (
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 bg-[var(--control-bg)] rounded-full text-xs font-medium text-[var(--muted)]">
                {yearRange}
              </div>
              <div className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold border border-red-100">
                {incidentCount} incidents
              </div>
            </div>
          )}

          <div className="app-header__actions">{themeToggle}</div>
        </div>
      </div>
    </header>
  );
}
