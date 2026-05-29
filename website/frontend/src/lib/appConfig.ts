/**
 * Developer-only UI (setup commands, PRIMARY badge, GTFS labels).
 * Set VITE_SHOW_DEV_UI=true in frontend/.env.local to enable while developing.
 */
export const showDevUI = import.meta.env.VITE_SHOW_DEV_UI === "true";
