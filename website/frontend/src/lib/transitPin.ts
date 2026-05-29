import type { Mode } from "../types";

const ICONS: Record<string, string> = {
  bus: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM6 10V6h12v4H6z"/></svg>`,
  streetcar: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M19 16.94V8.5c0-2.8-2.2-5-5-5h-4C7.2 3.5 5 5.7 5 8.5v8.44c-.55.61-.9 1.39-.9 2.28 0 1.93 1.57 3.5 3.5 3.5.78 0 1.5-.26 2.08-.69L12 21l2.32-1.41c.58.43 1.3.69 2.08.69 1.93 0 3.5-1.57 3.5-3.5 0-.89-.35-1.67-.9-2.28zM7.5 17C6.67 17 6 16.33 6 15.5S6.67 14 7.5 14 9 14.67 9 15.5 8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM18 10H6V8.5C6 7.12 7.12 6 8.5 6h7C16.88 6 18 7.12 18 8.5V10z"/></svg>`,
  unknown: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
};

/** MapLibre positions the outer element; hover scale lives on an inner wrapper. */
export function createTransitPinElement(
  mode: Mode | "unknown",
  accent: string,
): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "transit-pin";
  root.innerHTML = `
    <div class="transit-pin__inner">
      <div class="transit-pin__pulse" style="--pin-color:${accent}"></div>
      <div class="transit-pin__head" style="background:${accent}">
        ${ICONS[mode] ?? ICONS.unknown}
      </div>
      <div class="transit-pin__tail" style="border-top-color:${accent}"></div>
    </div>
  `;
  return root;
}
