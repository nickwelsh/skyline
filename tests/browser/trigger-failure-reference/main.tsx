import "non.geist";
import "non.geist/mono";
import React from "react";
import ReactDOM from "react-dom/client";
import { PinnedTriggerRunError } from "virtual:pinned-trigger-run-error";
import { OperatingSystemContextProvider } from "../../../../trigger.dev/apps/webapp/app/components/primitives/OperatingSystemProvider";
import { ShortcutsProvider } from "../../../../trigger.dev/apps/webapp/app/components/primitives/ShortcutsProvider";
import scenario from "../fixtures/nw-222-failure-scenario.json";
import "./reference.css";

const triggerError = { ...scenario.triggerError, type: "BUILT_IN_ERROR" as const };

window.addEventListener("error", (event) => {
  document.body.textContent = event.error instanceof Error ? event.error.stack ?? event.error.message : event.message;
});

ReactDOM.createRoot(document.getElementById("reference")!).render(
  <React.StrictMode>
    <OperatingSystemContextProvider platform="mac">
      <ShortcutsProvider>
        <div className="w-[488px]">
          <PinnedTriggerRunError error={triggerError} />
        </div>
      </ShortcutsProvider>
    </OperatingSystemContextProvider>
  </React.StrictMode>,
);
