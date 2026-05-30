import type { Map as MapLibreMap } from "maplibre-gl";

export const ACCESSIBLE_STOP_ICON = "accessible-stop-icon";

/** Register ♿ marker image for MapLibre symbol layer (exact stop coordinates). */
export function ensureAccessibleStopIcon(map: MapLibreMap, accentColor: string): void {
  if (map.hasImage(ACCESSIBLE_STOP_ICON)) {
    map.removeImage(ACCESSIBLE_STOP_ICON);
  }

  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 3;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = accentColor;
  ctx.font = "bold 34px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("♿", cx, cy + 2);

  const data = ctx.getImageData(0, 0, size, size);
  map.addImage(ACCESSIBLE_STOP_ICON, data, { pixelRatio: 2 });
}
