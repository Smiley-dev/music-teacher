import React from "react";
import ReactDOM from "react-dom/client";

import App from "@/App";
import { AudioEngineProvider } from "@/providers/audio-engine-provider";
import "./index.css";

// Follow the OS light/dark setting (shadcn uses the `.dark` class).
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const applyTheme = () => document.documentElement.classList.toggle("dark", darkQuery.matches);
applyTheme();
darkQuery.addEventListener("change", applyTheme);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AudioEngineProvider>
      <App />
    </AudioEngineProvider>
  </React.StrictMode>,
);
