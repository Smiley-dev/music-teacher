import React from "react";
import ReactDOM from "react-dom/client";

import App from "@/App";
import { applyTheme, followSystemTheme, loadThemePreference } from "@/lib/theme";
import { AudioEngineProvider } from "@/providers/audio-engine-provider";
import "./index.css";

// Apply the saved theme (default: follow the OS) before the first render.
applyTheme(loadThemePreference());
followSystemTheme();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AudioEngineProvider>
      <App />
    </AudioEngineProvider>
  </React.StrictMode>,
);
