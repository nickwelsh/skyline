import "non.geist";
import "non.geist/mono";
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, useLocation } from "react-router-dom";
import { PinnedTriggerErrors } from "virtual:pinned-trigger-errors";
import { PinnedTriggerRunError } from "virtual:pinned-trigger-run-error";
import { PinnedTriggerStateInspector } from "virtual:pinned-trigger-state-inspector";
import { LocaleContextProvider } from "../../../../trigger.dev/apps/webapp/app/components/primitives/LocaleProvider";
import { OperatingSystemContextProvider } from "../../../../trigger.dev/apps/webapp/app/components/primitives/OperatingSystemProvider";
import { ShortcutsProvider } from "../../../../trigger.dev/apps/webapp/app/components/primitives/ShortcutsProvider";
import errorsScenario from "../fixtures/nw-224-trigger-errors-scenario.json";
import scenario from "../fixtures/nw-222-failure-scenario.json";
import "./reference.css";

const triggerError = { ...scenario.triggerError, type: "BUILT_IN_ERROR" as const };

window.addEventListener("error", (event) => {
  document.body.textContent = event.error instanceof Error ? event.error.stack ?? event.error.message : event.message;
});

function Reference() {
  const location = useLocation();
  const stateInspector = new URLSearchParams(location.search).get("stateInspector") as "sql-captured" | "transaction-committed" | "cache-long" | "redis-truncated" | null;
  if (stateInspector) {
    return <div className="w-[488px] p-3"><PinnedTriggerStateInspector scenario={stateInspector} /></div>;
  }

  if (location.pathname.startsWith("/errors")) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-background-dimmed">
        <PinnedTriggerErrors
          scenario={errorsScenario}
          detail={location.pathname !== "/errors"}
        />
      </div>
    );
  }

  return <div className="w-[488px]"><PinnedTriggerRunError error={triggerError} /></div>;
}

const router = createBrowserRouter([{ id: "root", path: "*", element: <Reference /> }]);

ReactDOM.createRoot(document.getElementById("reference")!).render(
  <React.StrictMode>
    <LocaleContextProvider locales={["en-US"]}>
      <OperatingSystemContextProvider platform="mac">
        <ShortcutsProvider>
          <RouterProvider router={router} />
        </ShortcutsProvider>
      </OperatingSystemContextProvider>
    </LocaleContextProvider>
  </React.StrictMode>,
);
