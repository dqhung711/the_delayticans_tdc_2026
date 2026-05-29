import { useEffect, useState } from "react";
import { fetchRouteModes } from "../../api";
import { routeMatchesMode as routeMatchesModeMap } from "../../lib/routeMode";
import type { RouteModesMap } from "../../lib/routeMode";
import type { LiveAlertCategory, LiveAlertItem, LiveSnapshot, Mode } from "../../types";

const CATEGORY_ICONS: Record<string, string> = {
  Delays: "⚠",
  "Service changes": "⚠",
  Detours: "↪",
  Bypass: "⊳",
  "No service": "⊘",
  "Replaced by bus": "🚌",
};

interface Props {
  snapshot: LiveSnapshot | null;
  mode: Mode;
  onSelectRoute?: (route: string, categoryName: string) => void;
  onSelectAlert?: (alertId: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

function formatUpdated(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function alertMatchesMode(alert: LiveAlertItem, mode: Mode, routeModes: RouteModesMap): boolean {
  const routes = alert.routes ?? [];
  if (!routes.length) return true;
  return routes.some((r) => routeMatchesModeMap(r, mode, routeModes));
}

export function LiveServiceAlerts({
  snapshot,
  mode,
  onSelectRoute,
  onSelectAlert,
  onRefresh,
  refreshing = false,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [routeModes, setRouteModes] = useState<RouteModesMap>({});

  useEffect(() => {
    fetchRouteModes().then(setRouteModes).catch(() => setRouteModes({}));
  }, []);

  const categories = (snapshot?.categories ?? []).filter((c) => c.totalCount > 0);

  const totalAlerts = categories.reduce((n, c) => n + c.totalCount, 0);
  const modeLabel = mode === "streetcar" ? "Streetcar" : "Bus";

  const renderAlertList = (alerts: LiveAlertItem[], catName: string) => {
    const filtered = alerts.filter((a) => alertMatchesMode(a, mode, routeModes));
    if (!filtered.length) {
      return (
        <p className="live-alerts__hint">
          No {modeLabel.toLowerCase()} items in this category.
        </p>
      );
    }
    return (
      <ul className="live-alerts__changes">
        {filtered.map((alert) => (
          <li key={alert.id}>
            <button
              type="button"
              className="live-alerts__change-btn"
              onClick={() => {
                if (alert.routes[0]) onSelectRoute?.(alert.routes[0], catName);
                onSelectAlert?.(alert.id);
              }}
            >
              <span className="live-alerts__change-title">{alert.title}</span>
              {alert.routes.length > 0 && (
                <span className="live-alerts__change-routes">
                  Routes {alert.routes.join(", ")}
                </span>
              )}
              {alert.lon != null && alert.lat != null ? (
                <span className="live-alerts__change-pin">📍 On map</span>
              ) : (
                <span className="live-alerts__change-pin live-alerts__change-pin--muted">
                  Location from route line
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="live-alerts">
      <header className="live-alerts__header">
        <div className="live-alerts__title-row">
          <h2 className="live-alerts__title">Live service alerts</h2>
          {onRefresh && (
            <button
              type="button"
              className="map-live-refresh-btn map-live-refresh-btn--compact"
              onClick={onRefresh}
              disabled={refreshing}
              aria-busy={refreshing}
            >
              {refreshing ? "…" : "Refresh"}
            </button>
          )}
        </div>
        <p className="live-alerts__meta">
          {totalAlerts} active ({modeLabel}) ·{" "}
          <a
            href="https://www.ttc.ca/routes-and-schedules"
            target="_blank"
            rel="noopener noreferrer"
            className="live-alerts__link"
          >
            TTC routes &amp; schedules
          </a>
        </p>
        {(snapshot?.sourceUpdatedAt || snapshot?.updatedAt) && (
          <p className="live-alerts__updated">
            TTC updated {formatUpdated(snapshot.sourceUpdatedAt ?? snapshot.updatedAt)}
          </p>
        )}
      </header>

      <ul className="live-alerts__list">
        {categories.map((cat) => {
          const expanded = openId === cat.id;
          const icon = CATEGORY_ICONS[cat.name] ?? "•";
          const routes = (cat.routeCounts ?? []).filter((r) =>
            routeMatchesModeMap(r.route, mode, routeModes),
          );
          const alerts = cat.alerts ?? [];
          const isServiceChanges = cat.name === "Service changes";

          return (
            <li key={cat.id} className="live-alerts__item">
              <button
                type="button"
                className={`live-alerts__row ${expanded ? "live-alerts__row--open" : ""}`}
                onClick={() => setOpenId(expanded ? null : cat.id)}
                aria-expanded={expanded}
              >
                <span className="live-alerts__icon" aria-hidden>
                  {icon}
                </span>
                <span className="live-alerts__name">{cat.name}</span>
                <span className="live-alerts__count">{cat.totalCount}</span>
                <span className="live-alerts__chevron" aria-hidden>
                  {expanded ? "▾" : "▸"}
                </span>
              </button>

              {expanded && (
                <div className="live-alerts__detail">
                  {isServiceChanges ? (
                    renderAlertList(alerts, cat.name)
                  ) : routes.length > 0 ? (
                    <ul className="live-alerts__lines">
                      {routes.map((row) => (
                        <li key={row.route}>
                          <button
                            type="button"
                            className="live-alerts__line live-alerts__line--btn"
                            onClick={() => onSelectRoute?.(row.route, cat.name)}
                          >
                            <span className="live-alerts__route-badge">{row.route}</span>
                            <span className="live-alerts__line-name">{row.routeLabel}</span>
                            <span className="live-alerts__line-count">
                              {row.count} {row.count === 1 ? "alert" : "alerts"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    renderAlertList(alerts, cat.name)
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!categories.length && (
        <p className="live-alerts__empty">Loading live {modeLabel.toLowerCase()} alerts…</p>
      )}
    </div>
  );
}
