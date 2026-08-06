import "non.geist";
import "non.geist/mono";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { readBootstrap } from "./skyline/bootstrap";
import { createSkylineRouter } from "./skyline/router";
import { OperatingSystemContextProvider } from "./trigger/components/primitives/OperatingSystemProvider";
import { ShortcutsProvider } from "./trigger/components/primitives/ShortcutsProvider";
import "./trigger/tailwind.css";

document.documentElement.dataset.theme = "classic";
const root = document.getElementById("skyline")!;
const bootstrap = readBootstrap();
const router = createSkylineRouter(bootstrap);

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <OperatingSystemContextProvider platform={/windows/i.test(navigator.userAgent) ? "windows" : "mac"}>
      <ShortcutsProvider>
        <RouterProvider
          router={router}
          fallbackElement={<InitialLoadingState />}
        />
      </ShortcutsProvider>
    </OperatingSystemContextProvider>
  </React.StrictMode>,
);

function InitialLoadingState() {
  const segment = window.location.pathname.match(/\/(runs|queues)(?:\/[^/]+)?$/)?.[1] ?? "runs";
  const detail = window.location.pathname.match(new RegExp(`/${segment}/[^/]+$`));
  const label = detail ? `${segment === "queues" ? "Queue target" : "Run"}` : `${segment === "queues" ? "Queues" : "Runs"}`;
  return <div aria-label={`Loading ${label}`} className="grid h-screen place-items-center bg-background-dimmed text-text-dimmed">Loading {label}…</div>;
}
