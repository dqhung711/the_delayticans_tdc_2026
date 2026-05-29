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
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <h1 className="app-header__title">TTC Delays</h1>

        <nav className="app-header__nav" aria-label="Main">
          <button
            type="button"
            onClick={() => onTabChange("live")}
            className={`app-header__link ${tab === "live" ? "app-header__link--active" : ""}`}
          >
            Live map
          </button>
          <button
            type="button"
            onClick={() => onTabChange("explorer")}
            className={`app-header__link ${tab === "explorer" ? "app-header__link--active" : ""}`}
          >
            Data explorer
          </button>
        </nav>

        {tab === "explorer" && (
          <div className="app-header__modes" role="tablist" aria-label="Vehicle type">
            {(["streetcar", "bus"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => onModeChange(m)}
                className={`app-header__mode ${mode === m ? "app-header__mode--active" : ""}`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        <p className="app-header__meta">
          <span>{yearRange}</span>
          <span className="app-header__dot">·</span>
          <span>{incidentCount} incidents</span>
          {tab === "explorer" && (
            <>
              <span className="app-header__dot">·</span>
              <span className="capitalize">{mode}</span>
            </>
          )}
        </p>

        <div className="app-header__actions">{themeToggle}</div>
      </div>
    </header>
  );
}
