import React from "react";
import type { RouteDetail } from "../../api";
import type { Mode } from "../../types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Props {
  routeDetail: RouteDetail;
  mode: Mode;
  onBack?: () => void;
}

const BusIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78A2.99 2.99 0 0020 16V6c0-3.5-3.58-4-8-4S4 2.5 4 6v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h14v5z" />
  </svg>
);

const StreetcarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 16.94V8c0-2.79-2.68-3.98-6.04-3.98h-.03C9.67 4.02 7 5.22 7 8v8.94l-1.45 1.45c-.18.18-.29.43-.29.68V20c0 .55.45 1 1 1h2.58l1.7-1.71h2.92l1.7 1.71H18.74c.55 0 1-.45 1-1v-.93c0-.25-.11-.5-.29-.68L19 16.94zM8.5 15c-.83 0-1.5-.67-1.5-1.5S7.67 12 8.5 12s1.5.67 1.5 1.5S9.33 15 8.5 15zm7 0c-.83 0-1.5-.67-1.5-1.5S14.67 12 15.5 12s1.5.67 1.5 1.5S16.33 15 15.5 15zm1.5-5H9V8h8v2z" />
  </svg>
);

const SubwayIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2c-4.42 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2l2-2h4l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm5.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM18 11h-5V6h5v5z" />
  </svg>
);

// Mock data for charts and live info
const MOCK_VEHICLES = [
  { id: "4412", dir: "EB", loc: "King & Bathurst", delay: "+22 min", status: "stopped" },
  { id: "4387", dir: "WB", loc: "Near Broadview Stn", delay: "+8 min", status: "moving" },
  { id: "4401", dir: "EB", loc: "King & Dufferin", delay: "+3 min", status: "moving" },
];

const MOCK_DEPARTURES = [
  { time: "9:04", from: "Dufferin Loop", to: "Broadview", delay: "+18 min" },
  { time: "9:12", from: "Dufferin Loop", to: "Broadview", delay: "+6 min" },
  { time: "9:21", from: "Dufferin Loop", to: "Broadview", delay: "On time" },
];

const MOCK_HOURLY = Array.from({ length: 24 }, (_, i) => ({
  hour: i,
  value: Math.floor(Math.random() * 50) + 10,
}));

const MOCK_DAILY = [
  { day: "Mon", value: 30 },
  { day: "Tue", value: 45 },
  { day: "Wed", value: 55 },
  { day: "Thu", value: 50 },
  { day: "Fri", value: 65 },
  { day: "Sat", value: 40 },
  { day: "Sun", value: 25 },
];

export function LiveRouteDetail({ routeDetail, mode, onBack }: Props) {
  const Icon = mode === "subway" ? SubwayIcon : mode === "bus" ? BusIcon : StreetcarIcon;
  
  const totalDelay = routeDetail.categories.reduce((sum, c) => sum + c.delay_minutes, 0) || 1;
  const causes = routeDetail.categories
    .sort((a, b) => b.delay_minutes - a.delay_minutes)
    .slice(0, 4)
    .map(c => ({
      label: c.category,
      value: Math.round((c.delay_minutes / totalDelay) * 100),
      color: c.category === "Operator" ? "#ef4444" : c.category === "Mechanical" ? "#3b82f6" : c.category === "Traffic" ? "#f59e0b" : "#6b7280"
    }));

  return (
    <div className="live-route-detail pb-8">
      {/* Header */}
      <header className="sticky top-0 bg-[var(--card)] z-10 py-4 border-b border-[var(--border)] mb-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <h2 className="text-lg font-bold text-[var(--text)]">{routeDetail.route}</h2>
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px] font-bold uppercase">
              <span className="w-1 h-1 bg-green-500 rounded-full" />
              Live
            </div>
          </div>
          <button 
            onClick={onBack}
            className="p-1 hover:bg-[var(--control-bg)] rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-[var(--muted)]">Eastbound · 47 stops</p>
      </header>

      {/* Vehicles Section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Vehicles on route now</h3>
          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px] font-bold uppercase">
            <span className="w-1 h-1 bg-green-500 rounded-full" />
            Live
          </div>
        </div>
        <div className="space-y-3">
          {MOCK_VEHICLES.map(v => {
            const delayMatch = v.delay.match(/(\d+) min/);
            const delayVal = delayMatch ? parseInt(delayMatch[1], 10) : 0;
            let delayColor = "text-red-700";
            if (v.delay === "On time") delayColor = "text-green-700";
            else if (delayVal >= 15) delayColor = "text-red-700";
            else if (delayVal >= 5) delayColor = "text-orange-600";
            else delayColor = "text-yellow-600";

            return (
              <div key={v.id} className="flex items-center gap-3">
                <div className="w-8 h-8 flex-shrink-0 bg-red-50 text-red-600 rounded-lg flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
              <div className="flex-1 min-w-0 relative group/item">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-bold text-[var(--text)] truncate">
                    Car {v.id} · {v.dir}
                  </h3>
                  <span className={`text-sm font-semibold ${delayColor}`}>
                    {v.delay}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-[var(--muted)] truncate">{v.loc}</span>
                  <span className="text-[10px] text-[var(--muted)] uppercase font-medium">{v.status}</span>
                </div>

                {/* Hover Tooltip for Vehicle */}
                <div className="absolute z-[100] invisible group-hover/item:visible opacity-0 group-hover/item:opacity-100 transition-all duration-200 bg-white/80 backdrop-blur-md border border-[var(--border)] p-3 rounded-xl shadow-xl text-xs text-[var(--text)] right-full mr-4 top-0 w-64 pointer-events-none">
                  <div className="font-bold mb-1 text-[var(--accent)]">Vehicle {v.id}</div>
                  <div className="opacity-90">Currently {v.status} at {v.loc}. Delay is {v.delay}.</div>
                  <div className="absolute top-4 -right-1 translate-x-1/2 rotate-45 w-2 h-2 bg-white/80 border-t border-r border-[var(--border)]"></div>
                </div>
              </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Next Departures */}
      <section className="mb-8 pt-6 border-t border-[var(--border)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Next Departures</h3>
          <span className="text-[10px] text-[var(--muted)] font-medium">Dufferin Loop</span>
        </div>
        <div className="space-y-4">
          {MOCK_DEPARTURES.map((d, i) => {
            const delayMatch = d.delay.match(/(\d+) min/);
            const delayVal = delayMatch ? parseInt(delayMatch[1], 10) : 0;
            let delayBg = "bg-red-50 text-red-700";
            if (d.delay === "On time") delayBg = "bg-green-50 text-green-700";
            else if (delayVal >= 15) delayBg = "bg-red-50 text-red-700";
            else if (delayVal >= 5) delayBg = "bg-orange-50 text-orange-700";
            else delayBg = "bg-yellow-50 text-yellow-700";

            return (
              <div key={i} className="flex items-center justify-between group/item relative">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-[var(--text)]">{d.time}</span>
                  <div className="text-xs text-[var(--muted)]">
                    <span className="font-medium">{d.from}</span>
                    <span className="mx-1">→</span>
                    <span>{d.to}</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${delayBg}`}>
                  {d.delay}
                </span>

                {/* Hover Tooltip for Departure */}
                <div className="absolute z-[100] invisible group-hover/item:visible opacity-0 group-hover/item:opacity-100 transition-all duration-200 bg-white/80 backdrop-blur-md border border-[var(--border)] p-3 rounded-xl shadow-xl text-xs text-[var(--text)] right-full mr-4 top-0 w-64 pointer-events-none">
                  <div className="font-bold mb-1 text-[var(--accent)]">Departure {d.time}</div>
                  <div className="opacity-90">From {d.from} to {d.to}. Expected delay: {d.delay}.</div>
                  <div className="absolute top-4 -right-1 translate-x-1/2 rotate-45 w-2 h-2 bg-white/80 border-t border-r border-[var(--border)]"></div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Busy by Hour */}
      <section className="mb-8 pt-6 border-t border-[var(--border)]">
        <h3 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-4">Busy by hour</h3>
        <div className="h-24 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MOCK_HOURLY}>
              <Bar dataKey="value" fill="#ef4444" radius={[1, 1, 0, 0]} />
              <XAxis 
                dataKey="hour" 
                hide 
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-[var(--muted)] font-medium">
          <span>12a</span>
          <span>2</span>
          <span>4</span>
          <span>6</span>
          <span>8</span>
          <span>10</span>
          <span>12p</span>
          <span>2</span>
          <span>4</span>
          <span>6</span>
          <span>8</span>
          <span>10</span>
        </div>
      </section>

      {/* Busy by Day of Week */}
      <section className="mb-8 pt-6 border-t border-[var(--border)]">
        <h3 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-4">Busy by day of week</h3>
        <div className="h-24 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MOCK_DAILY}>
              <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                {MOCK_DAILY.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.value > 50 ? "#ef4444" : "#fca5a5"} />
                ))}
              </Bar>
              <XAxis dataKey="day" hide />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-[var(--muted)] font-medium px-1">
          {MOCK_DAILY.map(d => <span key={d.day}>{d.day}</span>)}
        </div>
      </section>

      {/* Delay Causes */}
      <section className="mb-8 pt-6 border-t border-[var(--border)]">
        <h3 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-4">Delay causes</h3>
        <div className="space-y-3">
          {causes.map(c => (
            <div key={c.label} className="flex items-center gap-3">
              <span className="text-xs font-medium text-[var(--text)] w-20">{c.label}</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full" 
                  style={{ width: `${c.value}%`, backgroundColor: c.color }}
                />
              </div>
              <span className="text-xs font-bold text-[var(--text)] w-8 text-right">{c.value}%</span>
            </div>
          ))}
        </div>
      </section>

      {/* KPI Grid */}
      <section className="grid grid-cols-2 gap-3 pt-6 border-t border-[var(--border)]">
        <div className="bg-gray-50 p-3 rounded-xl">
          <span className="text-[10px] text-[var(--muted)] font-bold uppercase">Avg delay</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg font-bold text-[var(--text)]">22</span>
            <span className="text-xs text-[var(--muted)]">min</span>
          </div>
          <div className="text-[10px] text-red-600 font-bold mt-1">↑ +3% vs prev yr</div>
        </div>
        <div className="bg-gray-50 p-3 rounded-xl">
          <span className="text-[10px] text-[var(--muted)] font-bold uppercase">Incidents</span>
          <div className="text-lg font-bold text-[var(--text)] mt-1">2,797</div>
          <div className="text-[10px] text-green-600 font-bold mt-1">↓ -5% vs prev yr</div>
        </div>
        <div className="bg-gray-50 p-3 rounded-xl">
          <span className="text-[10px] text-[var(--muted)] font-bold uppercase">Worst hour</span>
          <div className="text-lg font-bold text-[var(--text)] mt-1">5–6 AM</div>
          <div className="text-[10px] text-[var(--muted)] font-medium mt-1">all-time avg</div>
        </div>
        <div className="bg-gray-50 p-3 rounded-xl">
          <span className="text-[10px] text-[var(--muted)] font-bold uppercase">Top cause</span>
          <div className="text-lg font-bold text-[var(--text)] mt-1">MTDV</div>
          <div className="text-[10px] text-[var(--muted)] font-medium mt-1">op. diversion</div>
        </div>
      </section>
    </div>
  );
}
