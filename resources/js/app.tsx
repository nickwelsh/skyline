import "non.geist";
import "non.geist/mono";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { readBootstrap } from "./skyline/bootstrap";
import { createSkylineRouter } from "./skyline/router";
import { InitialLoadingState } from "./skyline/InitialLoadingState";
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
            fallbackElement={<InitialLoadingState bootstrap={bootstrap} />}
          />
        </UiPreferencesProvider>
      </ShortcutsProvider>
    </OperatingSystemContextProvider>
  </React.StrictMode>,
);
