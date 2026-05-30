import type { Theme } from "../context/ThemeContext";

/** Recharts does not resolve CSS variables on SVG stroke/fill — use explicit colors. */
export function chartPalette(theme: Theme) {
  if (theme === "dark") {
    return {
      primary: "#ff5c52",
      secondary: "#ffb199",
      grid: "#1f2633",
      tick: "#b8c0d0",
      tooltipBg: "#131820",
      tooltipBorder: "#2a3344",
      tooltipText: "#f0f3f8",
    };
  }
  return {
    primary: "#dc2626",
    secondary: "#fca5a5",
    grid: "#f1f5f9",
    tick: "#94a3b8",
    tooltipBg: "#ffffff",
    tooltipBorder: "#e2e8f0",
    tooltipText: "#0f172a",
  };
}
