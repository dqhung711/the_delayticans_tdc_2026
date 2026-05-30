import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./context/ThemeContext";
import { AccessibilityProvider } from "./context/AccessibilityContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AccessibilityProvider>
        <App />
      </AccessibilityProvider>
    </ThemeProvider>
  </StrictMode>,
);
