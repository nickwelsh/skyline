import "non.geist";
import "non.geist/mono";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { readBootstrap } from "./skyline/bootstrap";
import { createSkylineRouter } from "./skyline/router";
import { createUiPreferencesAdapter } from "./skyline/UiPreferencesAdapter";
import { UiPreferencesProvider } from "./skyline/UiPreferencesProvider";
import { OperatingSystemContextProvider, operatingSystemFromUserAgent } from "./trigger/components/primitives/OperatingSystemProvider";
import { ShortcutsProvider } from "./trigger/components/primitives/ShortcutsProvider";
import "./trigger/tailwind.css";

const root = document.getElementById("skyline")!;
const bootstrap = readBootstrap();
const preferences = createUiPreferencesAdapter({ basePath: bootstrap.basePath });
const router = createSkylineRouter(bootstrap, undefined, preferences);

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <OperatingSystemContextProvider platform={operatingSystemFromUserAgent(navigator.userAgent)}>
      <ShortcutsProvider>
        <UiPreferencesProvider adapter={preferences}>
          <RouterProvider
            router={router}
            fallbackElement={<InitialLoadingState />}
          />
        </UiPreferencesProvider>
      </ShortcutsProvider>
    </OperatingSystemContextProvider>
  </React.StrictMode>,
);

function InitialLoadingState() {
  const segment = window.location.pathname.match(/\/(jobs|runs|queues|errors|logs)(?:\/[^/]+)?$/)?.[1] ?? "runs";
  const detail = window.location.pathname.match(new RegExp(`/${segment}/[^/]+$`));
  const label = detail ? `${segment === "jobs" ? "Job" : segment === "queues" ? "Queue target" : segment === "errors" ? "Error group" : segment === "logs" ? "Telemetry event" : "Run"}` : `${segment === "jobs" ? "Jobs" : segment === "queues" ? "Queues" : segment === "errors" ? "Errors" : segment === "logs" ? "Logs" : "Runs"}`;
  return <div aria-label={`Loading ${label}`} className="grid h-screen place-items-center bg-background-dimmed text-text-dimmed">Loading {label}…</div>;
}
