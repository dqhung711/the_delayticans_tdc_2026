import type { ExpressionSpecification } from "maplibre-gl";
import type { Theme } from "../context/ThemeContext";

/** CARTO GL vector basemaps — free, no API key, supports pitch & 3D buildings */
export const BASEMAP: Record<Theme, string> = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

export const TORONTO_CENTER: [number, number] = [-79.3832, 43.6532];

export { TORONTO_BBOX, TORONTO_MAX_BOUNDS, TORONTO_MIN_ZOOM, inTorontoBbox } from "./torontoBounds";

export { STANDARD_MODE as MODE_COLORS } from "./colorPalettes";

/** Keeps HTML markers glued to map coordinates when the view is pitched or zoomed out. */
export const MAP_ALIGNED_MARKER = {
  anchor: "bottom" as const,
  pitchAlignment: "map" as const,
  rotationAlignment: "map" as const,
  subpixelPositioning: true,
};

/** Reduce 3D tilt when zoomed out so overview matches geographic positions. */
export function pitchForZoom(zoom: number): number {
  if (zoom <= 9.5) return 0;
  if (zoom <= 10.5) return 16;
  if (zoom <= 11.5) return 30;
  if (zoom <= 12.5) return 40;
  return 48;
}

/** Below this zoom, exclusive route focus from map clicks is cleared. */
export const MAP_FOCUS_CLEAR_ZOOM = 11.25;

export function normalizeRouteId(route: string): string {
  return route.replace(/^0+/, "") || route;
}

/** MapLibre options for smoother pan / zoom (less tile fade, no world wrap). */
export const MAP_SMOOTH_OPTIONS = {
  fadeDuration: 0,
  refreshExpiredTiles: false,
  renderWorldCopies: false,
  antialias: true,
  maxPitch: 55,
  minZoom: 10,
  maxZoom: 17,
  scrollZoom: { around: "center" as const },
  touchPitch: true,
  dragRotate: true,
  pitchWithRotate: true,
} as const;

export const MAP_EASE_MS = 450;

/** Red density ramp for MapLibre heatmap layer (heatmap-density 0–1). */
export { HEATMAP_STANDARD as HEATMAP_RED_COLOR_RAMP } from "./colorPalettes";

export const ROUTE_LINE_WIDTH_EXPR: ExpressionSpecification = [
  "case",
  ["boolean", ["get", "focused"], false],
  8,
  ["boolean", ["get", "dimmed"], false],
  1.5,
  ["interpolate", ["linear"], ["coalesce", ["get", "delay_norm"], 0], 0, 2, 1, 7],
];

export const ROUTE_LINE_OPACITY_EXPR: ExpressionSpecification = [
  "case",
  ["boolean", ["get", "focused"], false],
  1,
  ["boolean", ["get", "dimmed"], false],
  0.12,
  ["boolean", ["get", "selected"], false],
  1,
  ["boolean", ["get", "compare_a"], false],
  1,
  ["boolean", ["get", "compare_b"], false],
  1,
  ["interpolate", ["linear"], ["coalesce", ["get", "delay_norm"], 0], 0, 0.35, 1, 0.85],
];

/** ~90% faded route lines (10% opacity) so red heat dominates. */
export const ROUTE_LINE_OPACITY_HEAT_EXPR: ExpressionSpecification = [
  "case",
  ["boolean", ["get", "focused"], false],
  0.45,
  ["boolean", ["get", "dimmed"], false],
  0.06,
  ["boolean", ["get", "selected"], false],
  0.35,
  ["boolean", ["get", "compare_a"], false],
  0.35,
  ["boolean", ["get", "compare_b"], false],
  0.35,
  ["interpolate", ["linear"], ["coalesce", ["get", "delay_norm"], 0], 0, 0.08, 1, 0.12],
];
