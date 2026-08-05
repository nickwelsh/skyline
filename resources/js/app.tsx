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
          fallbackElement={<div aria-label="Loading Runs" className="grid h-screen place-items-center bg-background-dimmed text-text-dimmed">Loading Runs…</div>}
        />
      </ShortcutsProvider>
    </OperatingSystemContextProvider>
  </React.StrictMode>,
);
