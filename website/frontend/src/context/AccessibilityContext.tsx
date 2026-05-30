import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ColorblindType } from "../lib/colorPalettes";
import { isColorblindActive } from "../lib/colorPalettes";

interface AccessibilityContextValue {
  colorblindType: ColorblindType;
  colorblindMode: boolean;
  setColorblindType: (type: ColorblindType) => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

const STORAGE_KEY = "ttc-colorblind-type";

const VALID_TYPES: ColorblindType[] = [
  "off",
  "deuteranopia",
  "protanopia",
  "tritanopia",
];

function getInitialColorblindType(): ColorblindType {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && VALID_TYPES.includes(stored as ColorblindType)) {
    return stored as ColorblindType;
  }
  if (localStorage.getItem("ttc-colorblind") === "true") {
    return "deuteranopia";
  }
  return "off";
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [colorblindType, setColorblindTypeState] = useState<ColorblindType>(() =>
    getInitialColorblindType(),
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-colorblind", isColorblindActive(colorblindType) ? "true" : "false");
    document.documentElement.setAttribute("data-colorblind-type", colorblindType);
    localStorage.setItem(STORAGE_KEY, colorblindType);
  }, [colorblindType]);

  const setColorblindType = useCallback(
    (type: ColorblindType) => setColorblindTypeState(type),
    [],
  );

  const value = useMemo(
    () => ({
      colorblindType,
      colorblindMode: isColorblindActive(colorblindType),
      setColorblindType,
    }),
    [colorblindType, setColorblindType],
  );

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    throw new Error("useAccessibility must be used within AccessibilityProvider");
  }
  return ctx;
}
