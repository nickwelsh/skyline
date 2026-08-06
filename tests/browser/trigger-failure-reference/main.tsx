import "non.geist";
import "non.geist/mono";
import React from "react";
import ReactDOM from "react-dom/client";
import { PinnedTriggerRunError } from "virtual:pinned-trigger-run-error";
import { PinnedTriggerStateInspector } from "virtual:pinned-trigger-state-inspector";
import { OperatingSystemContextProvider } from "../../../../trigger.dev/apps/webapp/app/components/primitives/OperatingSystemProvider";
import { ShortcutsProvider } from "../../../../trigger.dev/apps/webapp/app/components/primitives/ShortcutsProvider";
import scenario from "../fixtures/nw-222-failure-scenario.json";
import "./reference.css";

const triggerError = { ...scenario.triggerError, type: "BUILT_IN_ERROR" as const };

window.addEventListener("error", (event) => {
  document.body.textContent = event.error instanceof Error ? event.error.stack ?? event.error.message : event.message;
});

function Reference() {
  const stateInspector = new URLSearchParams(window.location.search).get("stateInspector") as "sql-captured" | "transaction-committed" | "cache-long" | "redis-truncated" | null;
  if (stateInspector) {
    return <div className="w-[488px] p-3"><PinnedTriggerStateInspector scenario={stateInspector} /></div>;
  }

  return <div className="w-[488px]"><PinnedTriggerRunError error={triggerError} /></div>;
}

ReactDOM.createRoot(document.getElementById("reference")!).render(
  <React.StrictMode>
    <OperatingSystemContextProvider platform="mac">
      <ShortcutsProvider>
        <Reference />
      </ShortcutsProvider>
    </OperatingSystemContextProvider>
  </React.StrictMode>,
);
