/**
 * Developer-only hints (npm commands, debug badges). Off in production builds.
 * Local: set VITE_SHOW_DEV_UI=true in frontend/.env.local
 */
export const showDevUI =
  import.meta.env.DEV && import.meta.env.VITE_SHOW_DEV_UI === "true";

/** Backend origin (no trailing slash). Empty = same host as the UI. */
export const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return apiBase ? `${apiBase}${normalized}` : normalized;
}
