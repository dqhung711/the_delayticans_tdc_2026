import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchDelayHotspots,
  getCachedDelayHotspots,
  prefetchDelayHotspots,
  fetchLive,
  refreshLive,
  fetchMapStops,
  clearMapStopsCache,
  clearRouteShapesCache,
  fetchRouteDelays,
  fetchRankedRoutes,
  fetchRouteDetail,
  fetchRouteShapes,
  prefetchRouteShapes,
  type RouteDelayRow,
  type RouteDetail,
} from "../../api";
import { useTheme } from "../../context/ThemeContext";
import { useAccessibility } from "../../context/AccessibilityContext";
import { showDevUI } from "../../lib/appConfig";
import { getHeatmapColorRamp, getModeColors, routeLineColor, type ColorblindType } from "../../lib/colorPalettes";
import { ACCESSIBLE_STOP_ICON, ensureAccessibleStopIcon } from "../../lib/accessibleStopIcon";
import { geocodeAddress, searchAddresses, type GeocodeResult } from "../../lib/geoUtils";
import {
  BASEMAP,
  MAP_ALIGNED_MARKER,
  MAP_EASE_MS,
  MAP_FOCUS_CLEAR_ZOOM,
  MAP_SMOOTH_OPTIONS,
  normalizeRouteId,
  pitchForZoom,
  ROUTE_LINE_OPACITY_EXPR,
  ROUTE_LINE_OPACITY_HEAT_EXPR,
  ROUTE_LINE_WIDTH_EXPR,
  TORONTO_CENTER,
  TORONTO_MAX_BOUNDS,
  TORONTO_MIN_ZOOM,
  inTorontoBbox,
} from "../../lib/mapStyles";
import { selectMapRouteFeatures } from "../../lib/routeNetworkFilter";
import {
  ACCESSIBLE_STOPS_LAYER,
  ACCESSIBLE_STOPS_SOURCE,
  accessibleStopFeatures,
  accessibleStopLabel,
  setOverlayVisibility,
  STOPS_LAYER,
  STOPS_SOURCE,
} from "../../lib/mapOverlays";
import { collectLiveAdvisoryRouteIds } from "../../lib/visibleRoutes";
import type { Direction, LiveAdvisory, LiveSnapshot, Mode } from "../../types";
import { MapSidebar, type MapExploreState } from "./MapSidebar";

interface Props {
  mode: Mode;
  onModeChange: (m: Mode) => void;
}

const DIRECTIONS: Direction[] = ["EB", "WB", "NB", "SB"];

const EMPTY_GEOJSON: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

const StreetcarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 16.94V8c0-2.79-2.68-3.98-6.04-3.98h-.03C9.67 4.02 7 5.22 7 8v8.94l-1.45 1.45c-.18.18-.29.43-.29.68V20c0 .55.45 1 1 1h2.58l1.7-1.71h2.92l1.7 1.71H18.74c.55 0 1-.45 1-1v-.93c0-.25-.11-.5-.29-.68L19 16.94zM8.5 15c-.83 0-1.5-.67-1.5-1.5S7.67 12 8.5 12s1.5.67 1.5 1.5S9.33 15 8.5 15zm7 0c-.83 0-1.5-.67-1.5-1.5S14.67 12 15.5 12s1.5.67 1.5 1.5S16.33 15 15.5 15zm1.5-5H9V8h8v2z" />
  </svg>
);

const BusIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78A2.99 2.99 0 0020 16V6c0-3.5-3.58-4-8-4S4 2.5 4 6v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h14v5z" />
  </svg>
);

function popupHtml(advisory: LiveAdvisory): string {
  const routes = advisory.routes.length
    ? `<p class="map-popup__routes">Routes ${advisory.routes.join(", ")}</p>`
    : "";
  return `
    <div class="map-popup">
      <span class="map-popup__badge map-popup__badge--${advisory.mode}">${advisory.mode}</span>
      <strong>${escapeHtml(advisory.title)}</strong>
      <p>${escapeHtml(advisory.description.slice(0, 200))}${advisory.description.length > 200 ? "…" : ""}</p>
      ${routes}
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function advisoryCoords(advisory: LiveAdvisory): [number, number] | null {
  if (advisory.lon != null && advisory.lat != null) {
    return [advisory.lon, advisory.lat];
  }
  return null;
}

function routeColorFromShapes(
  route: string,
  shapes: GeoJSON.FeatureCollection | null,
): string | undefined {
  if (!shapes?.features.length) return undefined;
  const norm = normalizeRouteId(route);
  const feat = shapes.features.find((f) => {
    const r = String(f.properties?.route ?? "");
    return r === route || normalizeRouteId(r) === norm;
  });
  const color = feat?.properties?.color;
  return color != null ? String(color) : undefined;
}

function advisoriesToGeoJSON(
  advisories: LiveAdvisory[],
  focusedRoutes: string[],
  colorblindType: ColorblindType,
  shapes: GeoJSON.FeatureCollection | null,
): GeoJSON.FeatureCollection {
  const modeColors = getModeColors(colorblindType);
  const focusSet = new Set(focusedRoutes.map(normalizeRouteId));
  const focusActive = focusSet.size > 0;
  const features: GeoJSON.Feature[] = [];
  for (const advisory of advisories) {
    const coords = advisoryCoords(advisory);
    if (!coords) continue;
    if (!inTorontoBbox(coords[0], coords[1])) continue;
    const modeKey =
      advisory.mode === "bus" || advisory.mode === "streetcar"
        ? advisory.mode
        : "unknown";
    const routeMatch =
      !focusActive ||
      advisory.routes.some((r) => focusSet.has(normalizeRouteId(r)));
    const route = advisory.routes[0] ?? "";
    const originalColor = route ? routeColorFromShapes(route, shapes) : undefined;
    const pinColor = route
      ? routeLineColor(route, originalColor, colorblindType)
      : modeColors[modeKey];
    features.push({
      type: "Feature",
      id: advisory.id,
      geometry: { type: "Point", coordinates: coords },
      properties: {
        id: advisory.id,
        mode: modeKey,
        color: pinColor,
        focusActive,
        routeMatch,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

const LIVE_PIN_LAYER = "live-advisory-pin";
const LIVE_PIN_HALO_LAYER = "live-advisory-halo";
const MAP_CLICK_LAYERS = [
  "ttc-routes-line",
  LIVE_PIN_LAYER,
  LIVE_PIN_HALO_LAYER,
] as const;

const PIN_OPACITY_FOCUS: maplibregl.ExpressionSpecification = [
  "case",
  ["!=", ["get", "focusActive"], true],
  1,
  ["case", ["boolean", ["get", "routeMatch"], false], 1, 0.2],
];

function routeShapeCenter(
  route: string,
  shapes: GeoJSON.FeatureCollection | null,
): [number, number] | null {
  const norm = route.replace(/^0+/, "") || route;
  const feat = shapes?.features.find((f) => {
    const r = String(f.properties?.route ?? "");
    return r === route || r.replace(/^0+/, "") === norm;
  });
  if (!feat || feat.geometry.type !== "LineString") return null;
  const coords = feat.geometry.coordinates as [number, number][];
  return coords[Math.floor(coords.length / 2)] ?? null;
}

export function TransitMap({ mode, onModeChange }: Props) {
  const { theme } = useTheme();
  const { colorblindType, colorblindMode } = useAccessibility();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null);
  const liveAdvisoriesRef = useRef<LiveAdvisory[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const livePinInteractionsBound = useRef(false);
  const mapFocusHandlersBound = useRef(false);
  const clearMapFocusRef = useRef<() => void>(() => {});
  const focusRoutesRef = useRef<(routes: string[]) => void>(() => {});
  const routeHoverPopupRef = useRef<maplibregl.Popup | null>(null);
  const routeInteractionsBound = useRef(false);
  const routesRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const routeShapesCache = useRef<GeoJSON.FeatureCollection | null>(null);
  const themeRef = useRef(theme);
  const prevThemeRef = useRef(theme);
  const showHeatmapRef = useRef(false);
  const showAllRoutesRef = useRef(false);
  const showStopsRef = useRef(true);
  const showAccessibleStopsRef = useRef(false);
  const colorblindRef = useRef(colorblindType);
  const modeRef = useRef(mode);
  const stopsGeoRef = useRef<GeoJSON.FeatureCollection | null>(null);
  themeRef.current = theme;
  modeRef.current = mode;
  colorblindRef.current = colorblindType;

  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [liveRefreshing, setLiveRefreshing] = useState(false);
  const [selected, setSelected] = useState<LiveAdvisory | null>(null);
  selectedIdRef.current = selected?.id ?? null;
  const [mapFocusedRoutes, setMapFocusedRoutes] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const clearMapFocus = useCallback(() => {
    setMapFocusedRoutes([]);
    setSelected(null);
    setRouteDetail(null);
    setExplore((p) => ({ ...p, routeSearch: "" }));
  }, []);

  const focusMapRoutes = useCallback((routes: string[]) => {
    const ids = [...new Set(routes.map(normalizeRouteId).filter(Boolean))];
    setMapFocusedRoutes(ids);
  }, []);

  clearMapFocusRef.current = clearMapFocus;
  focusRoutesRef.current = focusMapRoutes;
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [networkLoaded, setNetworkLoaded] = useState(false);
  const [routeShapesReady, setRouteShapesReady] = useState(false);
  const [routesShownCount, setRoutesShownCount] = useState(0);
  const [networkHint, setNetworkHint] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"live" | "historical">("live");
  const [showStops, setShowStops] = useState(true);
  const [showAccessibleStops, setShowAccessibleStops] = useState(true);
  const [accessibleStopCount, setAccessibleStopCount] = useState(0);
  const [explore, setExplore] = useState<MapExploreState>({
    histStart: "2014",
    histEnd: "2026",
    showHeatmap: false,
    showAllRoutes: false,
    routeSearch: "",
    compareA: "",
    compareB: "",
    addressQuery: "",
    nearbyKm: 1,
    timeToggle: "year",
  });
  showHeatmapRef.current = explore.showHeatmap;
  showAllRoutesRef.current = explore.showAllRoutes;
  showStopsRef.current = showStops;
  showAccessibleStopsRef.current = showAccessibleStops;
  const [routeRows, setRouteRows] = useState<RouteDelayRow[]>([]);
  const [rankedRoutes, setRankedRoutes] = useState<RouteDelayRow[]>([]);
  const [routeDetail, setRouteDetail] = useState<RouteDetail | null>(null);
  const [compareA, setCompareA] = useState<RouteDetail | null>(null);
  const [compareB, setCompareB] = useState<RouteDetail | null>(null);
  const [geocodeStatus, setGeocodeStatus] = useState<string | null>(null);
  const [geocodeSearching, setGeocodeSearching] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<GeocodeResult[]>([]);
  const [addressCenter, setAddressCenter] = useState<[number, number] | null>(null);
  const addressPopupRef = useRef<maplibregl.Popup | null>(null);
  const addressMarkerRef = useRef<maplibregl.Marker | null>(null);
  const routeClickBound = useRef(false);
  const accessibleStopClickBound = useRef(false);

  const mapQuery = useMemo(
    () => ({
      mode,
      view: "overview" as const,
      granularity: explore.timeToggle === "year" ? ("year" as const) : ("range" as const),
      timeToggle: explore.timeToggle,
      start: explore.histStart,
      end: explore.histEnd,
      directions: [] as Direction[],
      routes: [],
      bucket: "month" as const,
    }),
    [mode, explore.histStart, explore.histEnd, explore.timeToggle],
  );

  const filtered = useMemo(() => {
    const all = snapshot?.advisories ?? [];
    return all.filter((a) => a.mode === mode || a.mode === "unknown");
  }, [snapshot?.advisories, mode]);

  const clearLivePopup = useCallback(() => {
    hoverPopupRef.current?.remove();
    hoverPopupRef.current = null;
  }, []);

  const addNetworkLayers = useCallback((map: maplibregl.Map) => {
    if (!map.getSource("ttc-routes")) {
      map.addSource("ttc-routes", {
        type: "geojson",
        data: EMPTY_GEOJSON,
      });
      map.addLayer({
        id: "ttc-routes-line",
        type: "line",
        source: "ttc-routes",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2.5,
          "line-opacity": 0.75,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: "ttc-routes-highlight",
        type: "line",
        source: "ttc-routes",
        filter: [
          "any",
          ["==", ["get", "highlighted"], true],
          ["==", ["get", "focused"], true],
        ],
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["case", ["==", ["get", "focused"], true], 7, 5],
          "line-opacity": 1,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }

    if (!map.getSource("delay-heat")) {
      map.addSource("delay-heat", {
        type: "geojson",
        data: EMPTY_GEOJSON,
      });
      map.addLayer(
        {
          id: "delay-heat-layer",
          type: "heatmap",
          source: "delay-heat",
          layout: { visibility: "none" },
          paint: {
            "heatmap-weight": [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", "weight_norm"], 0],
              0,
              0,
              0.15,
              0.4,
              1,
              1,
            ],
            "heatmap-intensity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              9,
              1.1,
              12,
              1.6,
              15,
              2.5,
            ],
            "heatmap-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              9,
              22,
              12,
              34,
              15,
              52,
            ],
            "heatmap-opacity": 0.92,
            "heatmap-color": getHeatmapColorRamp(colorblindRef.current),
          },
        },
        "ttc-routes-line",
      );
    }

    const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

    if (!map.getSource(STOPS_SOURCE)) {
      map.addSource(STOPS_SOURCE, { type: "geojson", data: EMPTY_GEOJSON });
      map.addLayer(
        {
          id: STOPS_LAYER,
          type: "circle",
          source: STOPS_SOURCE,
          minzoom: 11,
          layout: { visibility: showStopsRef.current ? "visible" : "none" },
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 2, 14, 4, 16, 5],
            "circle-color": "#64748b",
            "circle-opacity": 0.55,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-opacity": 0.35,
          },
        },
        "ttc-routes-line",
      );
    }

    if (!map.getSource("live-advisories")) {
      map.addSource("live-advisories", {
        type: "geojson",
        data: EMPTY_GEOJSON,
        promoteId: "id",
      });
      map.addLayer({
        id: LIVE_PIN_HALO_LAYER,
        type: "circle",
        source: "live-advisories",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            9,
            8,
            12,
            14,
            15,
            20,
          ],
          "circle-color": ["get", "color"],
          "circle-opacity": [
            "*",
            0.28,
            PIN_OPACITY_FOCUS,
          ],
          "circle-blur": 0.35,
        },
      });
      map.addLayer({
        id: LIVE_PIN_LAYER,
        type: "circle",
        source: "live-advisories",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            9,
            [
              "case",
              [
                "any",
                ["boolean", ["feature-state", "hover"], false],
                ["boolean", ["feature-state", "selected"], false],
              ],
              7,
              5,
            ],
            12,
            [
              "case",
              [
                "any",
                ["boolean", ["feature-state", "hover"], false],
                ["boolean", ["feature-state", "selected"], false],
              ],
              11,
              8,
            ],
            15,
            [
              "case",
              [
                "any",
                ["boolean", ["feature-state", "hover"], false],
                ["boolean", ["feature-state", "selected"], false],
              ],
              14,
              10,
            ],
          ],
          "circle-color": ["get", "color"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": PIN_OPACITY_FOCUS,
        },
      });
    }

    if (!map.getSource(ACCESSIBLE_STOPS_SOURCE)) {
      ensureAccessibleStopIcon(map, getModeColors(colorblindRef.current).accessible);
      map.addSource(ACCESSIBLE_STOPS_SOURCE, { type: "geojson", data: EMPTY_GEOJSON });
      map.addLayer({
        id: ACCESSIBLE_STOPS_LAYER,
        type: "symbol",
        source: ACCESSIBLE_STOPS_SOURCE,
        minzoom: 10,
        layout: {
          visibility: showAccessibleStopsRef.current ? "visible" : "none",
          "icon-image": ACCESSIBLE_STOP_ICON,
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            0.42,
            13,
            0.62,
            16,
            0.82,
          ],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-anchor": "center",
        },
      });
    }
  }, []);

  const syncMapOverlays = useCallback(
    (map: maplibregl.Map, advisories: LiveAdvisory[]) => {
      const stops = stopsGeoRef.current;
      const stopsSource = map.getSource(STOPS_SOURCE) as maplibregl.GeoJSONSource | undefined;
      const accessibleSource = map.getSource(ACCESSIBLE_STOPS_SOURCE) as
        | maplibregl.GeoJSONSource
        | undefined;

      if (stopsSource && stops) {
        stopsSource.setData(stops);
      }
      if (accessibleSource && stops) {
        const accessible = accessibleStopFeatures(stops);
        setAccessibleStopCount(accessible.features.length);
        accessibleSource.setData(accessible);
      }

      setOverlayVisibility(map, STOPS_LAYER, showStopsRef.current);
      setOverlayVisibility(map, ACCESSIBLE_STOPS_LAYER, showAccessibleStopsRef.current);
    },
    [],
  );

  const setupRouteHover = useCallback((map: maplibregl.Map) => {
    if (routeInteractionsBound.current) return;
    routeInteractionsBound.current = true;

    const layerId = "ttc-routes-line";

    const restoreRouteLinePaint = () => {
      if (!map.getLayer(layerId)) return;
      const heatOn = showHeatmapRef.current;
      const showAll = showAllRoutesRef.current;
      if (showAll) {
        map.setPaintProperty(layerId, "line-width", 2.5);
        map.setPaintProperty(layerId, "line-opacity", heatOn ? 0.55 : 0.75);
      } else {
        map.setPaintProperty(layerId, "line-width", ROUTE_LINE_WIDTH_EXPR);
        map.setPaintProperty(
          layerId,
          "line-opacity",
          heatOn ? ROUTE_LINE_OPACITY_HEAT_EXPR : ROUTE_LINE_OPACITY_EXPR,
        );
      }
    };

    const clearRouteHover = () => {
      map.getCanvas().style.cursor = "";
      routeHoverPopupRef.current?.remove();
      routeHoverPopupRef.current = null;
      restoreRouteLinePaint();
    };

    map.on("mouseenter", layerId, (e) => {
      map.getCanvas().style.cursor = "pointer";
      const feature = e.features?.[0];
      if (!feature) return;

      const route = String(feature.properties?.route ?? "?");
      const lineMode = String(feature.properties?.mode ?? "");
      const modeLabel =
        lineMode === "streetcar" ? "Streetcar" : lineMode === "bus" ? "Bus" : "Route";
      const color = String(feature.properties?.color ?? "#94a3b8");

      const showAll = showAllRoutesRef.current;
      const heatOn = showHeatmapRef.current;
      const baseWidth = showAll ? 2.5 : ROUTE_LINE_WIDTH_EXPR;
      const baseOpacity = showAll
        ? heatOn
          ? 0.55
          : 0.75
        : heatOn
          ? ROUTE_LINE_OPACITY_HEAT_EXPR
          : ROUTE_LINE_OPACITY_EXPR;

      map.setPaintProperty(layerId, "line-width", [
        "case",
        ["==", ["get", "route"], route],
        8,
        baseWidth,
      ]);
      map.setPaintProperty(layerId, "line-opacity", [
        "case",
        ["==", ["get", "route"], route],
        1,
        baseOpacity,
      ]);

      routeHoverPopupRef.current?.remove();
      routeHoverPopupRef.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        className: `map-route-popup map-route-popup--${themeRef.current}`,
      })
        .setLngLat(e.lngLat)
        .setHTML(
          `<div class="map-route-popup__inner">
            <span class="map-route-popup__swatch" style="background:${escapeHtml(color)}"></span>
            <div>
              <strong>Route ${escapeHtml(route)}</strong>
              <span class="map-route-popup__mode map-route-popup__mode--${escapeHtml(lineMode)}">${escapeHtml(modeLabel)}</span>
            </div>
          </div>`,
        )
        .addTo(map);
    });

    map.on("mousemove", layerId, (e) => {
      if (routeHoverPopupRef.current && e.lngLat) {
        routeHoverPopupRef.current.setLngLat(e.lngLat);
      }
    });

    map.on("mouseleave", layerId, clearRouteHover);
  }, []);

  const setRouteLinePaint = useCallback(
    (map: maplibregl.Map, heatmapOn: boolean, showAll: boolean) => {
      if (!map.getLayer("ttc-routes-line")) return;
      if (showAll) {
        map.setPaintProperty("ttc-routes-line", "line-width", 2.5);
        map.setPaintProperty(
          "ttc-routes-line",
          "line-opacity",
          heatmapOn ? 0.55 : 0.75,
        );
      } else {
        map.setPaintProperty("ttc-routes-line", "line-width", ROUTE_LINE_WIDTH_EXPR);
        map.setPaintProperty(
          "ttc-routes-line",
          "line-opacity",
          heatmapOn ? ROUTE_LINE_OPACITY_HEAT_EXPR : ROUTE_LINE_OPACITY_EXPR,
        );
      }
      if (map.getLayer("ttc-routes-highlight")) {
        map.setLayoutProperty("ttc-routes-highlight", "visibility", "visible");
      }
      if (map.getLayer("delay-heat-layer") && map.getLayer("ttc-routes-line")) {
        map.moveLayer("delay-heat-layer", "ttc-routes-line");
      }
    },
    [],
  );

  const applyNetworkData = useCallback(
    (
      map: maplibregl.Map,
      activeMode: Mode,
      highlighted: string[],
      delays: RouteDelayRow[],
      liveAdvisories: LiveAdvisory[],
      center: [number, number] | null,
      heatmapOn: boolean,
    ) => {
      const routes = routeShapesCache.current;

      if (!routes?.features.length) {
        if (showDevUI) {
          setNetworkHint(
            "Missing route shapes — run: cd website && npm run fetch-network",
          );
        }
        setNetworkLoaded(false);
        return;
      }

      setNetworkHint(null);
      setNetworkLoaded(true);

      const highlightSet = new Set(highlighted.map(normalizeRouteId));
      const focusSet = new Set(mapFocusedRoutes.map(normalizeRouteId));
      const hasMapFocus = focusSet.size > 0;
      const selectedNorm = explore.routeSearch.replace(/^0+/, "") || explore.routeSearch;
      const compareNormA = explore.compareA.replace(/^0+/, "") || explore.compareA;
      const compareNormB = explore.compareB.replace(/^0+/, "") || explore.compareB;

      const delayByRoute = new Map(
        delays.map((d) => [d.route.replace(/^0+/, "") || d.route, d.delay_minutes]),
      );
      const maxDelay = Math.max(1, ...delays.map((d) => d.delay_minutes));

      const visibleRouteIds = explore.showAllRoutes
        ? null
        : collectLiveAdvisoryRouteIds(liveAdvisories, activeMode);

      const showAll = explore.showAllRoutes;
      const empty = EMPTY_GEOJSON;
    const lineFeatures = selectMapRouteFeatures({
        collection: routes,
        activeMode,
        showAllRoutes: showAll,
        visibleRouteIds,
      });

      const routeFeatures = lineFeatures.map((f) => {
        const route = String(f.properties?.route ?? "");
        const norm = route.replace(/^0+/, "") || route;
        const delay = delayByRoute.get(norm) ?? delayByRoute.get(route) ?? 0;
        const delayNorm = showAll ? 0.5 : delay / maxDelay;
        const originalColor = String(f.properties?.color ?? "");
        const lineColor = routeLineColor(
          route,
          originalColor || undefined,
          colorblindRef.current,
        );
        const isMapFocused =
          !showAll && hasMapFocus && (focusSet.has(norm) || focusSet.has(route));
        const isDimmed = !showAll && hasMapFocus && !isMapFocused;
        const isSelected =
          !showAll &&
          !hasMapFocus &&
          (norm === selectedNorm || route === explore.routeSearch);
        const isCompareA = norm === compareNormA || route === explore.compareA;
        const isCompareB = norm === compareNormB || route === explore.compareB;
        return {
          ...f,
          properties: {
            ...f.properties,
            color: lineColor,
            delay_minutes: delay,
            delay_norm: delayNorm,
            focused: isMapFocused,
            dimmed: isDimmed,
            highlighted: showAll
              ? false
              : isMapFocused ||
                (!hasMapFocus &&
                  (highlightSet.has(norm) ||
                    highlightSet.has(route) ||
                    isSelected ||
                    isCompareA ||
                    isCompareB)),
            selected: isMapFocused || isSelected,
            compare_a: !hasMapFocus && isCompareA,
            compare_b: !hasMapFocus && isCompareB,
          },
        };
      });

      setRoutesShownCount(routeFeatures.length);

      if (!routeFeatures.length && routes.features.length && !showAll) {
        setNetworkHint("No live alert routes — check Display all routes on map");
      }

      const routeSource = map.getSource("ttc-routes") as maplibregl.GeoJSONSource;
      routeSource?.setData({ type: "FeatureCollection", features: routeFeatures });

      setRouteLinePaint(map, heatmapOn, showAll);

      if (center) {
        addressMarkerRef.current?.remove();
        addressMarkerRef.current = new maplibregl.Marker({
          color: getModeColors(colorblindRef.current).addressMarker,
          ...MAP_ALIGNED_MARKER,
        })
          .setLngLat(center)
          .addTo(map);
      }
    },
    [
      explore.routeSearch,
      explore.compareA,
      explore.compareB,
      explore.showAllRoutes,
      mapFocusedRoutes,
      setRouteLinePaint,
    ],
  );

  const applyMapPalette = useCallback((map: maplibregl.Map) => {
    const palette = getModeColors(colorblindRef.current);
    const heatRamp = getHeatmapColorRamp(colorblindRef.current);
    if (map.getLayer("delay-heat-layer")) {
      map.setPaintProperty("delay-heat-layer", "heatmap-color", heatRamp);
    }
    if (map.getLayer(ACCESSIBLE_STOPS_LAYER)) {
      ensureAccessibleStopIcon(map, palette.accessible);
      map.triggerRepaint();
    }
  }, []);

  const applyHeatmap = useCallback(
    async (map: maplibregl.Map, show: boolean) => {
      const heatSource = map.getSource("delay-heat") as maplibregl.GeoJSONSource | undefined;

      if (!show) {
        if (map.getLayer("delay-heat-layer")) {
          map.setLayoutProperty("delay-heat-layer", "visibility", "none");
        }
        heatSource?.setData(EMPTY_GEOJSON);
        setRouteLinePaint(map, false, showAllRoutesRef.current);
        return;
      }

      setRouteLinePaint(map, true, showAllRoutesRef.current);
      const cached = getCachedDelayHotspots(mapQuery);
      if (cached) {
        heatSource?.setData(cached);
        if (map.getLayer("delay-heat-layer")) {
          map.setLayoutProperty("delay-heat-layer", "visibility", "visible");
        }
      }
      const geo = await fetchDelayHotspots(mapQuery);
      heatSource?.setData(geo);
      if (map.getLayer("delay-heat-layer")) {
        map.setLayoutProperty("delay-heat-layer", "visibility", "visible");
      }
    },
    [mapQuery, setRouteLinePaint],
  );

  const setupAccessibleStopInteractions = useCallback((map: maplibregl.Map) => {
    if (accessibleStopClickBound.current) return;
    accessibleStopClickBound.current = true;

    map.on("mouseenter", ACCESSIBLE_STOPS_LAYER, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", ACCESSIBLE_STOPS_LAYER, () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("click", ACCESSIBLE_STOPS_LAYER, (e) => {
      const feature = e.features?.[0];
      if (!feature?.geometry || feature.geometry.type !== "Point") return;
      e.originalEvent.stopPropagation();
      const label = accessibleStopLabel(feature);
      const coords = feature.geometry.coordinates as [number, number];
      new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        offset: 12,
        className: `map-hover-popup map-hover-popup--${themeRef.current}`,
        maxWidth: "260px",
      })
        .setLngLat(coords)
        .setHTML(
          `<div class="map-popup"><strong>${escapeHtml(label)}</strong><p class="map-popup__hint">Step-free boarding available</p></div>`,
        )
        .addTo(map);
    });
  }, []);

  const setupRouteClick = useCallback(
    (map: maplibregl.Map) => {
      if (routeClickBound.current) return;
      routeClickBound.current = true;
      map.on("click", "ttc-routes-line", (e) => {
        const route = String(e.features?.[0]?.properties?.route ?? "");
        if (!route) return;
        focusRoutesRef.current([route]);
        setExplore((prev) => ({ ...prev, routeSearch: route }));
        void fetchRouteDetail(route, mapQuery).then(setRouteDetail);
      });
    },
    [mapQuery],
  );

  const setupMapFocusHandlers = useCallback((map: maplibregl.Map) => {
    if (mapFocusHandlersBound.current) return;
    mapFocusHandlersBound.current = true;

    map.on("click", (e) => {
      const hit = map.queryRenderedFeatures(e.point, {
        layers: [...MAP_CLICK_LAYERS],
      });
      if (!hit.length) clearMapFocusRef.current();
    });
  }, []);

  const focusLiveRoute = useCallback(
    (route: string, categoryName: string) => {
      const map = mapRef.current;
      if (!map) return;

      focusRoutesRef.current([route]);
      setExplore((prev) => ({ ...prev, routeSearch: route }));
      void fetchRouteDetail(route, mapQuery).then(setRouteDetail);

      const norm = normalizeRouteId(route);
      const matches = filtered.filter(
        (a) =>
          a.routes.some((r) => r === route || r.replace(/^0+/, "") === norm) &&
          (!categoryName || a.category === categoryName),
      );

      const coords: [number, number][] = [];
      matches.forEach((a) => {
        const c = advisoryCoords(a);
        if (c) coords.push(c);
      });

      const shapeCenter = routeShapeCenter(route, routesRef.current);
      if (shapeCenter && !coords.length) coords.push(shapeCenter);

      if (coords.length) {
        const bounds = new maplibregl.LngLatBounds(coords[0], coords[0]);
        coords.forEach((c) => bounds.extend(c));
        map.fitBounds(bounds, {
          padding: 80,
          pitch: pitchForZoom(13),
          duration: MAP_EASE_MS + 400,
          maxZoom: 14,
        });
      } else if (shapeCenter) {
        map.easeTo({
          center: shapeCenter,
          zoom: 13,
          pitch: pitchForZoom(13),
          duration: MAP_EASE_MS + 200,
        });
      }

      if (matches[0]) setSelected(matches[0]);
    },
    [filtered, mapQuery],
  );

  const syncLivePins = useCallback(
    (
      map: maplibregl.Map,
      advisories: LiveAdvisory[],
      hoverId: string | null,
      selectedId: string | null,
      focusedRoutes: string[],
    ) => {
      liveAdvisoriesRef.current = advisories;
      const source = map.getSource("live-advisories") as maplibregl.GeoJSONSource | undefined;
      if (!source) return;
      source.setData(
        advisoriesToGeoJSON(
          advisories,
          focusedRoutes,
          colorblindRef.current,
          routesRef.current,
        ),
      );
      for (const advisory of advisories) {
        if (!advisoryCoords(advisory)) continue;
        map.setFeatureState(
          { source: "live-advisories", id: advisory.id },
          { hover: advisory.id === hoverId, selected: advisory.id === selectedId },
        );
      }
    },
    [],
  );

  const setupLivePinInteractions = useCallback((map: maplibregl.Map) => {
    if (livePinInteractionsBound.current) return;
    livePinInteractionsBound.current = true;

    const showPopup = (advisory: LiveAdvisory, lngLat: maplibregl.LngLat) => {
      clearLivePopup();
      hoverPopupRef.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 14,
        className: `map-hover-popup map-hover-popup--${themeRef.current}`,
        maxWidth: "280px",
      })
        .setLngLat(lngLat)
        .setHTML(popupHtml(advisory))
        .addTo(map);
    };

    map.on("mouseenter", LIVE_PIN_LAYER, (e) => {
      map.getCanvas().style.cursor = "pointer";
      const feature = e.features?.[0];
      if (!feature?.properties?.id) return;
      const advisory = liveAdvisoriesRef.current.find((a) => a.id === feature.properties?.id);
      if (!advisory) return;
      setHoveredId(advisory.id);
      map.setFeatureState(
        { source: "live-advisories", id: advisory.id },
        { hover: true, selected: advisory.id === selectedIdRef.current },
      );
      if (e.lngLat) showPopup(advisory, e.lngLat);
    });

    map.on("mousemove", LIVE_PIN_LAYER, (e) => {
      if (hoverPopupRef.current && e.lngLat) {
        hoverPopupRef.current.setLngLat(e.lngLat);
      }
    });

    map.on("mouseleave", LIVE_PIN_LAYER, () => {
      map.getCanvas().style.cursor = "";
      setHoveredId(null);
      clearLivePopup();
      for (const advisory of liveAdvisoriesRef.current) {
        if (!advisoryCoords(advisory)) continue;
        map.setFeatureState(
          { source: "live-advisories", id: advisory.id },
          { hover: false, selected: advisory.id === selectedIdRef.current },
        );
      }
    });

    map.on("click", LIVE_PIN_LAYER, (e) => {
      const feature = e.features?.[0];
      if (!feature?.properties?.id) return;
      const advisory = liveAdvisoriesRef.current.find((a) => a.id === feature.properties?.id);
      if (!advisory) return;
      const coords = advisoryCoords(advisory);
      focusRoutesRef.current(advisory.routes);
      setSelected(advisory);
      if (advisory.routes[0]) {
        setExplore((prev) => ({ ...prev, routeSearch: advisory.routes[0] }));
        void fetchRouteDetail(advisory.routes[0], mapQuery).then(setRouteDetail);
      }
      if (coords) {
        map.easeTo({
          center: coords,
          zoom: Math.max(map.getZoom(), 14),
          pitch: pitchForZoom(14),
          duration: MAP_EASE_MS,
        });
      }
    });
  }, [clearLivePopup, mapQuery]);

  const loadLive = useCallback(async (forceRefresh = false) => {
    const data = forceRefresh ? await refreshLive() : await fetchLive();
    setSnapshot(data);
    setError(null);
    return data;
  }, []);

  const handleRefreshLive = useCallback(async () => {
    if (liveRefreshing) return;
    setLiveRefreshing(true);
    try {
      await loadLive(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Live refresh failed");
    } finally {
      setLiveRefreshing(false);
    }
  }, [liveRefreshing, loadLive]);

  useEffect(() => {
    let cancelled = false;
    const poll = () =>
      loadLive()
        .catch((e) => {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Live feed error");
          }
        });
    poll();
    const interval = setInterval(poll, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [loadLive]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: BASEMAP[themeRef.current],
      center: TORONTO_CENTER,
      zoom: 11.3,
      pitch: pitchForZoom(11.3),
      bearing: -18,
      maxBounds: TORONTO_MAX_BOUNDS,
      ...MAP_SMOOTH_OPTIONS,
      minZoom: TORONTO_MIN_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    const syncPitch = () => {
      const target = pitchForZoom(map.getZoom());
      if (Math.abs(map.getPitch() - target) > 1.5) {
        map.easeTo({ pitch: target, duration: MAP_EASE_MS, essential: true });
      }
    };

    const onZoomEnd = () => {
      syncPitch();
      if (map.getZoom() < MAP_FOCUS_CLEAR_ZOOM) {
        clearMapFocusRef.current();
      }
    };

    map.on("load", () => {
      addNetworkLayers(map);
      setupRouteHover(map);
      setupRouteClick(map);
      setupAccessibleStopInteractions(map);
      setupLivePinInteractions(map);
      setupMapFocusHandlers(map);
      syncMapOverlays(map, liveAdvisoriesRef.current);
      syncPitch();
      setMapReady(true);
    });

    map.on("zoomend", onZoomEnd);

    mapRef.current = map;
    return () => {
      clearLivePopup();
      routeInteractionsBound.current = false;
      livePinInteractionsBound.current = false;
      mapFocusHandlersBound.current = false;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [
    addNetworkLayers,
    clearLivePopup,
    setupRouteHover,
    setupRouteClick,
    setupAccessibleStopInteractions,
    setupLivePinInteractions,
    setupMapFocusHandlers,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || prevThemeRef.current === theme) return;
    map.setStyle(BASEMAP[theme]);
    map.once("style.load", () => {
      prevThemeRef.current = theme;
      addNetworkLayers(map);
      applyNetworkData(
        map,
        mode,
        snapshot?.highlightedRoutes ?? [],
        routeRows,
        filtered,
        addressCenter,
        explore.showHeatmap,
      );
      syncLivePins(map, filtered, hoveredId, selected?.id ?? null, mapFocusedRoutes);
      syncMapOverlays(map, filtered);
      applyMapPalette(map);
      void applyHeatmap(map, explore.showHeatmap);
    });
  }, [
    theme,
    mapReady,
    mode,
    filtered,
    snapshot?.highlightedRoutes,
    addNetworkLayers,
    applyNetworkData,
    syncLivePins,
    syncMapOverlays,
    setupRouteHover,
    routeRows,
    addressCenter,
    explore.showHeatmap,
    applyHeatmap,
    applyMapPalette,
    hoveredId,
    selected?.id,
    mapFocusedRoutes,
    routeShapesReady,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!routeShapesReady) return;
    applyMapPalette(map);
    applyNetworkData(
      map,
      mode,
      snapshot?.highlightedRoutes ?? [],
      routeRows,
      filtered,
      addressCenter,
      explore.showHeatmap,
    );
    syncLivePins(map, filtered, hoveredId, selected?.id ?? null, mapFocusedRoutes);
  }, [
    mode,
    filtered,
    mapReady,
    routeShapesReady,
    snapshot?.highlightedRoutes,
    applyNetworkData,
    syncLivePins,
    hoveredId,
    selected?.id,
    mapFocusedRoutes,
    routeRows,
    addressCenter,
    explore.showHeatmap,
    explore.routeSearch,
    explore.compareA,
    explore.compareB,
    explore.showAllRoutes,
    colorblindType,
    applyMapPalette,
  ]);

  useEffect(() => {
    clearMapFocus();
  }, [mode, clearMapFocus]);

  useEffect(() => {
    let cancelled = false;
    setRouteShapesReady(false);
    fetchRouteShapes(mode)
      .then((raw) => {
        if (cancelled) return;
        routeShapesCache.current = raw;
        routesRef.current = raw;
        setRouteShapesReady(true);
        if (raw.features.length) {
          setNetworkLoaded(true);
          setNetworkHint(null);
        } else if (showDevUI) {
          setNetworkHint("Run: cd website && npm run fetch-network");
        }
        prefetchRouteShapes(mode === "bus" ? "streetcar" : "bus");
      })
      .catch(() => {
        if (!cancelled && showDevUI) {
          setNetworkHint("Could not load route shapes from API.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    clearMapStopsCache();
    clearRouteShapesCache();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMapStops(mode)
      .then((data) => {
        if (cancelled) return;
        stopsGeoRef.current = data;
        const map = mapRef.current;
        if (map && mapReady) {
          syncMapOverlays(map, filtered);
        }
      })
      .catch(() => {
        if (!cancelled) stopsGeoRef.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [mode, mapReady, filtered, syncMapOverlays]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    syncMapOverlays(map, filtered);
  }, [filtered, mapReady, syncMapOverlays]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    setOverlayVisibility(map, STOPS_LAYER, showStops);
  }, [showStops, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    setOverlayVisibility(map, ACCESSIBLE_STOPS_LAYER, showAccessibleStops);
  }, [showAccessibleStops, mapReady]);

  useEffect(() => {
    fetchRouteDelays(mapQuery).then(setRouteRows).catch(() => setRouteRows([]));
    fetchRankedRoutes(mapQuery).then(setRankedRoutes).catch(() => setRankedRoutes([]));
    prefetchDelayHotspots(mapQuery);
  }, [mapQuery]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    void applyHeatmap(map, explore.showHeatmap);
  }, [explore.showHeatmap, mapReady, applyHeatmap, mapQuery]);

  useEffect(() => {
    if (!explore.compareA) {
      setCompareA(null);
      return;
    }
    fetchRouteDetail(explore.compareA, mapQuery).then(setCompareA).catch(() => setCompareA(null));
  }, [explore.compareA, mapQuery]);

  useEffect(() => {
    if (!explore.compareB) {
      setCompareB(null);
      return;
    }
    fetchRouteDetail(explore.compareB, mapQuery).then(setCompareB).catch(() => setCompareB(null));
  }, [explore.compareB, mapQuery]);

  const flyToAddress = useCallback((hit: GeocodeResult) => {
    const lon = hit.lon;
    const lat = hit.lat;
    setAddressCenter([lon, lat]);
    setGeocodeStatus(hit.display_name);
    setAddressSuggestions([]);
    const map = mapRef.current;
    if (!map) return;
    addressPopupRef.current?.remove();
    addressPopupRef.current = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      offset: 16,
      className: `map-hover-popup map-hover-popup--${themeRef.current}`,
      maxWidth: "280px",
    })
      .setLngLat([lon, lat])
      .setHTML(
        `<div class="map-popup"><strong>${escapeHtml(hit.display_name)}</strong></div>`,
      )
      .addTo(map);
    map.easeTo({
      center: [lon, lat],
      zoom: 15,
      pitch: pitchForZoom(15),
      duration: MAP_EASE_MS + 200,
    });
  }, []);

  const handleGeocodeAddress = async () => {
    const q = explore.addressQuery.trim();
    if (!q) {
      setGeocodeStatus("Enter a street address or intersection.");
      return;
    }
    setGeocodeSearching(true);
    setGeocodeStatus("Searching…");
    try {
      const hit = await geocodeAddress(q);
      if (!hit) {
        setGeocodeStatus("No results in Toronto area. Try a full address or postal code.");
        return;
      }
      flyToAddress(hit);
    } finally {
      setGeocodeSearching(false);
    }
  };

  const handlePickAddressSuggestion = (hit: GeocodeResult) => {
    setExplore((p) => ({ ...p, addressQuery: hit.display_name }));
    flyToAddress(hit);
  };

  useEffect(() => {
    const q = explore.addressQuery.trim();
    if (q.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchAddresses(q)
        .then((results) => {
          if (!cancelled) setAddressSuggestions(results);
        })
        .catch(() => {
          if (!cancelled) setAddressSuggestions([]);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [explore.addressQuery]);

  const handleSelectRoute = (route: string) => {
    if (!route) return;
    focusMapRoutes([route]);
    setExplore((p) => ({ ...p, routeSearch: route }));
    fetchRouteDetail(route, mapQuery).then(setRouteDetail);
    const map = mapRef.current;
    if (!map) return;
    const norm = normalizeRouteId(route);
    const features = routesRef.current?.features.filter((f) => {
      const r = String(f.properties?.route ?? "");
      return r === route || normalizeRouteId(r) === norm;
    });
    if (features?.length) {
      const coords = (features[0].geometry as GeoJSON.LineString).coordinates[0] as [
        number,
        number,
      ];
      map.easeTo({
        center: coords,
        zoom: 13,
        pitch: pitchForZoom(13),
        duration: MAP_EASE_MS,
      });
    }
  };

  const focusAdvisoryById = (alertId: string) => {
    const advisory = filtered.find((a) => a.id === alertId);
    if (advisory) focusAdvisory(advisory);
  };

  const focusAdvisory = (advisory: LiveAdvisory) => {
    setSelected(advisory);
    focusMapRoutes(advisory.routes);
    const map = mapRef.current;
    if (!map) return;
    const coords = advisoryCoords(advisory);
    if (coords) {
      map.easeTo({
        center: coords,
        zoom: 14,
        pitch: pitchForZoom(14),
        duration: MAP_EASE_MS,
      });
    }
    if (advisory.routes[0]) {
      setExplore((p) => ({ ...p, routeSearch: advisory.routes[0] }));
      void fetchRouteDetail(advisory.routes[0], mapQuery).then(setRouteDetail);
    }
  };

  return (
    <div className="page-enter explorer-layout">
      {/* Top Nav Bar */}
      <div className="map-nav-bar">
        <div className="map-nav-tabs">
          <button
            type="button"
            onClick={() => onModeChange("streetcar")}
            className={`map-nav-tab ${mode === "streetcar" ? "map-nav-tab--active" : ""}`}
          >
            <StreetcarIcon className="w-4 h-4" />
            Streetcar
          </button>
          <button
            type="button"
            onClick={() => onModeChange("bus")}
            className={`map-nav-tab ${mode === "bus" ? "map-nav-tab--active" : ""}`}
          >
            <BusIcon className="w-4 h-4" />
            Bus
          </button>
        </div>

        <div className="map-badge-live">
          <span className="badge-live">Live</span>
          <span className="badge-active-delays">
            {filtered.length} active delays
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="map-filter-bar">
        <div className="map-filter-group map-filter-group--vertical">
          <span className="map-filter-label">View</span>
          <div className="map-view-toggle">
            <button
              type="button"
              onClick={() => setViewMode("live")}
              className={`map-view-btn ${viewMode === "live" ? "map-view-btn--active" : ""}`}
            >
              <span className={`map-view-dot ${viewMode === "live" ? "map-view-dot--active" : "map-view-dot--inactive"}`} />
              Live
            </button>
            <button
              type="button"
              onClick={() => setViewMode("historical")}
              className={`map-view-btn ${viewMode === "historical" ? "map-view-btn--active" : ""}`}
            >
              <span className={`map-view-dot ${viewMode === "historical" ? "map-view-dot--active" : "map-view-dot--inactive"}`} />
              Historical
            </button>
          </div>
        </div>

        {viewMode === "historical" && (
          <div className="map-filter-group map-filter-group--vertical px-4 border-l border-[var(--border)]">
            <span className="map-filter-label">Time Range</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {(["year", "range"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setExplore((p) => {
                        const patch: Partial<MapExploreState> = { timeToggle: t };
                        if (t === "year") {
                          const y = p.histStart.includes("-") ? p.histStart.slice(0, 4) : p.histStart;
                          patch.histStart = y;
                          patch.histEnd = y;
                        } else {
                          const y = p.histStart.length === 4 ? p.histStart : p.histStart.slice(0, 4);
                          patch.histStart = y;
                          patch.histEnd = String(parseInt(y, 10) + 1);
                        }
                        return { ...p, ...patch };
                      });
                    }}
                    className={`relative text-[11px] font-bold pb-0.5 transition-all ${
                      explore.timeToggle === t ? "text-[var(--text)]" : "text-[var(--muted)]"
                    }`}
                  >
                    {t === "year" ? "Year" : "Range"}
                    {explore.timeToggle === t && (
                      <span className="absolute bottom-0 left-0 right-0 h-[1px] bg-[var(--accent)] opacity-50" />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                {explore.timeToggle === "year" ? (
                  <input
                    type="number"
                    value={explore.histStart}
                    onChange={(e) => {
                      const val = e.target.value;
                      setExplore((p) => ({ ...p, histStart: val, histEnd: val }));
                    }}
                    min={2014}
                    max={2099}
                    className="bg-transparent border-b-[1px] border-[var(--muted)] border-opacity-40 text-xs font-bold text-center focus:ring-0 focus:outline-none w-16"
                  />
                ) : (
                  <>
                    <input
                      type="number"
                      value={explore.histStart}
                      onChange={(e) => setExplore((p) => ({ ...p, histStart: e.target.value }))}
                      min={2014}
                      max={2099}
                      className="bg-transparent border-b-[1px] border-[var(--muted)] border-opacity-40 text-xs font-bold text-center focus:ring-0 focus:outline-none w-16"
                    />
                    <span className="text-[var(--muted)] text-[10px]">→</span>
                    <input
                      type="number"
                      value={explore.histEnd}
                      onChange={(e) => setExplore((p) => ({ ...p, histEnd: e.target.value }))}
                      min={2014}
                      max={2099}
                      className="bg-transparent border-b-[1px] border-[var(--muted)] border-opacity-40 text-xs font-bold text-center focus:ring-0 focus:outline-none w-16"
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="map-filter-group map-filter-group--vertical px-4 border-l border-[var(--border)]">
          <span className="map-filter-label">Show</span>
          <div className="map-show-toggle">
            <label className="map-checkbox-item">
              <input
                type="checkbox"
                className="map-checkbox"
                checked={showStops}
                onChange={(e) => setShowStops(e.target.checked)}
              />
              Stops
            </label>
            <label className="map-checkbox-item">
              <input
                type="checkbox"
                className="map-checkbox"
                checked={showAccessibleStops}
                onChange={(e) => setShowAccessibleStops(e.target.checked)}
              />
              Accessible stops
            </label>
            <label className="map-checkbox-item">
              <input
                type="checkbox"
                className="map-checkbox"
                checked={explore.showHeatmap}
                onChange={(e) => setExplore((p) => ({ ...p, showHeatmap: e.target.checked }))}
              />
              Delay heat
            </label>
          </div>
        </div>
      </div>

      {error && <p className="explorer-error mb-3">{error}</p>}
      {showDevUI && networkHint && (
        <p className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Map network data missing. {networkHint}
        </p>
      )}

      <div className="map-layout">
        <div className="map-shell map-shell--network relative">
          {/* Floating Search Bar */}
          <div className="map-search-container">
            <svg className="map-search-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              className="map-search-input"
              placeholder="Search address or route..."
              value={explore.addressQuery || explore.routeSearch}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d+$/.test(val)) {
                  setExplore((p) => ({ ...p, routeSearch: val, addressQuery: "" }));
                } else {
                  setExplore((p) => ({ ...p, addressQuery: val, routeSearch: "" }));
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (explore.routeSearch) handleSelectRoute(explore.routeSearch);
                  else handleGeocodeAddress();
                }
              }}
            />
            {addressSuggestions.length > 0 && (
              <ul className="address-search__suggestions" style={{ top: '100%', left: 0, right: 0, position: 'absolute', zIndex: 50 }}>
                {addressSuggestions.map((hit) => (
                  <li key={`${hit.lon}-${hit.lat}-${hit.display_name}`}>
                    <button
                      type="button"
                      className="address-search__option"
                      onClick={() => handlePickAddressSuggestion(hit)}
                    >
                      {hit.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div ref={mapContainer} className="map-canvas map-canvas--tall" />
          <div className="map-legend map-legend--wide">
            <span><i className="legend-dot legend-dot--bus" /> Bus</span>
            <span><i className="legend-dot legend-dot--streetcar" /> Streetcar</span>
            {showStops && <span className="text-[var(--muted)]">· Stops (zoom in)</span>}
            {showAccessibleStops && (
              <span className="text-[var(--muted)]">
                · <span className="legend-accessible-icon" aria-hidden="true">♿</span> Step-free stops
                {accessibleStopCount === 0 ? " (reload API)" : ` (${accessibleStopCount.toLocaleString()})`}
              </span>
            )}
            <span className="text-[var(--muted)]">
              {explore.showHeatmap
                ? colorblindMode
                  ? " · Multi-color heat (CB)"
                  : " · Red heat = delay density"
                : explore.showAllRoutes
                  ? ` · All ${mode} lines · pins = live`
                  : " · Live alert routes only"}
            </span>
            {colorblindMode && (
              <span className="text-[var(--muted)]"> · {colorblindType} palette</span>
            )}
          </div>
        </div>

        <MapSidebar
          mode={mode}
          viewMode={viewMode}
          explore={explore}
          onExploreChange={(patch) => setExplore((p) => ({ ...p, ...patch }))}
          routeRows={routeRows}
          rankedRoutes={rankedRoutes}
          routeDetail={routeDetail}
          compareDetailA={compareA}
          compareDetailB={compareB}
          onSelectRoute={handleSelectRoute}
          onGeocodeAddress={handleGeocodeAddress}
          geocodeStatus={geocodeStatus}
          geocodeSearching={geocodeSearching}
          addressSuggestions={addressSuggestions}
          onPickAddressSuggestion={handlePickAddressSuggestion}
          liveSnapshot={snapshot}
          advisories={filtered}
          selectedAdvisory={selected}
          onSelectAdvisory={focusAdvisory}
          onSelectLiveRoute={focusLiveRoute}
          onSelectAlert={focusAdvisoryById}
          onRefreshLive={() => void handleRefreshLive()}
          liveRefreshing={liveRefreshing}
          onClearRouteDetail={clearMapFocus}
        />
      </div>

      {selected && (
        <div className="card-panel mt-4 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold">{selected.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{selected.description}</p>
            </div>
            <button type="button" className="theme-toggle" onClick={clearMapFocus}>
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
