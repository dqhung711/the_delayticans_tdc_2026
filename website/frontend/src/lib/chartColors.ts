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
    primary: "#c41e14",
    secondary: "#e07a5f",
    grid: "#e4e8ef",
    tick: "#5a6478",
    tooltipBg: "#ffffff",
    tooltipBorder: "#d4d9e2",
    tooltipText: "#0f1218",
  };
}
