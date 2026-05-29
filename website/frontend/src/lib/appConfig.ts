/**
 * Developer-only UI (setup commands, PRIMARY badge, GTFS labels).
 * Set VITE_SHOW_DEV_UI=true in frontend/.env.local to enable while developing.
 */
export const showDevUI = import.meta.env.VITE_SHOW_DEV_UI === "true";

/** Backend origin (no trailing slash). Empty = same host; dev uses Vite proxy. */
export const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return apiBase ? `${apiBase}${normalized}` : normalized;
}
