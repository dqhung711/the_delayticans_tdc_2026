import type { ExpressionSpecification } from "maplibre-gl";

/** Which color-vision deficiency to compensate for (or off). */
export type ColorblindType = "off" | "deuteranopia" | "protanopia" | "tritanopia";

export const COLORBLIND_TYPE_LABEL: Record<ColorblindType, string> = {
  off: "Standard vision",
  deuteranopia: "Deuteranopia (red–green)",
  protanopia: "Protanopia (red–green)",
  tritanopia: "Tritanopia (blue–yellow)",
};

export const COLORBLIND_TYPE_SHORT: Record<Exclude<ColorblindType, "off">, string> = {
  deuteranopia: "Deutan",
  protanopia: "Protan",
  tritanopia: "Tritan",
};

const OVERLAY_BY_TYPE: Record<
  Exclude<ColorblindType, "off">,
  {
    bus: string;
    streetcar: string;
    unknown: string;
    construction: string;
    addressMarker: string;
    accessible: string;
  }
> = {
  /** Avoid red vs green — blues, oranges, purples, yellows. */
  deuteranopia: {
    bus: "#0072B2",
    streetcar: "#E69F00",
    unknown: "#999999",
    construction: "#CC79A7",
    addressMarker: "#0072B2",
    accessible: "#009E73",
  },
  /** Similar to deutan; stronger blue / orange separation. */
  protanopia: {
    bus: "#005A9E",
    streetcar: "#D55E00",
    unknown: "#888888",
    construction: "#C77CFF",
    addressMarker: "#005A9E",
    accessible: "#008272",
  },
  /** Avoid blue vs yellow — reds, magentas, teals, oranges. */
  tritanopia: {
    bus: "#D55E00",
    streetcar: "#CC79A7",
    unknown: "#999999",
    construction: "#E69F00",
    addressMarker: "#D55E00",
    accessible: "#009E73",
  },
};

export const STANDARD_MODE = {
  bus: "#e53935",
  streetcar: "#ff6f61",
  unknown: "#9ca3af",
  construction: "#f59e0b",
  addressMarker: "#da291c",
  accessible: "#0284c7",
  notAccessible: "#94a3b8",
} as const;

export type ModeColorKey = keyof typeof STANDARD_MODE;

export function isColorblindActive(type: ColorblindType): boolean {
  return type !== "off";
}

export function getModeColors(type: ColorblindType) {
  if (type === "off") return STANDARD_MODE;
  return OVERLAY_BY_TYPE[type];
}

/** Route hues tuned per deficiency type — each route stays a distinct color. */
const ROUTE_HUES: Record<Exclude<ColorblindType, "off">, readonly number[]> = {
  deuteranopia: [210, 35, 320, 55, 20, 280, 240, 300, 130, 15, 195, 0],
  protanopia: [200, 30, 310, 50, 15, 270, 235, 290, 125, 10, 190, 340],
  tritanopia: [10, 330, 160, 25, 300, 140, 350, 180, 45, 270, 200, 0],
};

function hashRoute(route: string): number {
  const norm = route.replace(/^0+/, "") || route;
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = (hash * 31 + norm.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Per-route line color: full GTFS palette off; type-safe hues when CB on. */
export function routeLineColor(
  route: string,
  originalColor: string | undefined,
  type: ColorblindType,
): string {
  if (type === "off") {
    return originalColor || "#e53935";
  }
  const norm = route.replace(/^0+/, "") || route;
  const hues = ROUTE_HUES[type];
  const hash = hashRoute(norm);
  const modeOffset = /^\d+$/.test(norm) && parseInt(norm, 10) >= 300 ? 18 : 0;
  const hue = hues[hash % hues.length];
  return `hsl(${(hue + modeOffset) % 360}, 72%, 46%)`;
}

/** Red density ramp (standard). */
export const HEATMAP_STANDARD: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["heatmap-density"],
  0,
  "rgba(0, 0, 0, 0)",
  0.1,
  "rgba(255, 200, 150, 0.15)",
  0.25,
  "rgba(255, 120, 80, 0.35)",
  0.45,
  "rgba(255, 60, 40, 0.55)",
  0.65,
  "rgba(230, 30, 30, 0.72)",
  0.85,
  "rgba(200, 0, 0, 0.88)",
  1,
  "rgba(140, 0, 0, 0.95)",
];

const HEATMAP_DEUTERAN: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["heatmap-density"],
  0,
  "rgba(0, 0, 0, 0)",
  0.08,
  "rgba(240, 228, 66, 0.18)",
  0.22,
  "rgba(230, 159, 0, 0.38)",
  0.38,
  "rgba(213, 94, 0, 0.52)",
  0.55,
  "rgba(204, 121, 167, 0.65)",
  0.72,
  "rgba(0, 114, 178, 0.78)",
  0.88,
  "rgba(0, 82, 128, 0.9)",
  1,
  "rgba(0, 52, 82, 0.96)",
];

const HEATMAP_PROTAN: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["heatmap-density"],
  0,
  "rgba(0, 0, 0, 0)",
  0.08,
  "rgba(240, 228, 66, 0.2)",
  0.22,
  "rgba(213, 94, 0, 0.4)",
  0.4,
  "rgba(199, 124, 255, 0.58)",
  0.58,
  "rgba(0, 90, 158, 0.72)",
  0.75,
  "rgba(0, 68, 120, 0.85)",
  1,
  "rgba(0, 40, 72, 0.95)",
];

const HEATMAP_TRITAN: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["heatmap-density"],
  0,
  "rgba(0, 0, 0, 0)",
  0.08,
  "rgba(213, 94, 0, 0.2)",
  0.22,
  "rgba(204, 121, 167, 0.38)",
  0.4,
  "rgba(230, 25, 75, 0.55)",
  0.58,
  "rgba(0, 158, 115, 0.7)",
  0.75,
  "rgba(0, 120, 90, 0.85)",
  1,
  "rgba(0, 80, 60, 0.95)",
];

export function getHeatmapColorRamp(type: ColorblindType): ExpressionSpecification {
  switch (type) {
    case "deuteranopia":
      return HEATMAP_DEUTERAN;
    case "protanopia":
      return HEATMAP_PROTAN;
    case "tritanopia":
      return HEATMAP_TRITAN;
    default:
      return HEATMAP_STANDARD;
  }
}
