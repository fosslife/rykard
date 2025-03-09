import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "./components/ui/theme-provider";
import { DockerEventsProvider } from "./lib/docker-events-context";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="rykard-theme">
      <DockerEventsProvider>
        <App />
      </DockerEventsProvider>
    </ThemeProvider>
  </React.StrictMode>
);
