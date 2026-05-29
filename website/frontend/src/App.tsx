import { useEffect, useState } from "react";
import { fetchMeta } from "./api";
import { AppHeader } from "./components/AppHeader";
import { ThemeToggle } from "./components/ThemeToggle";
import { TransitMap } from "./components/map/TransitMap";
import { DataExplorer } from "./pages/DataExplorer";
import type { Meta, Mode, Tab } from "./types";

export default function App() {
  const [tab, setTab] = useState<Tab>("explorer");
  const [mode, setMode] = useState<Mode>("streetcar");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [tabAnim, setTabAnim] = useState(0);

  useEffect(() => {
    fetchMeta()
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  const handleTabChange = (next: Tab) => {
    setTab(next);
    setTabAnim((n) => n + 1);
  };

  const yearRange = meta
    ? `${meta.overall.min_year}–${meta.overall.max_year}`
    : "2014–2026";
  const incidentCount = meta ? meta.overall.total.toLocaleString() : "—";

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <AppHeader
        tab={tab}
        onTabChange={handleTabChange}
        mode={mode}
        onModeChange={setMode}
        yearRange={yearRange}
        incidentCount={incidentCount}
        themeToggle={<ThemeToggle />}
      />

      <main key={`${tab}-${tabAnim}`} className="app-main">
        {tab === "live" ? (
          <TransitMap mode={mode} onModeChange={setMode} />
        ) : (
          <DataExplorer mode={mode} meta={meta} />
        )}
      </main>
    </div>
  );
}
