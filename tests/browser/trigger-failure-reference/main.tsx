import "non.geist";
import "non.geist/mono";
import React from "react";
import ReactDOM from "react-dom/client";
import { ExceptionPreview, type ExceptionPreviewData } from "../../../resources/js/trigger/ExceptionPreview";
import baseline from "../fixtures/nw-222-trigger-failure-baseline.json";
import "./reference.css";

ReactDOM.createRoot(document.getElementById("reference")!).render(
  <React.StrictMode>
    <div className="w-[488px]">
      <ExceptionPreview exception={baseline.reference.exception as ExceptionPreviewData} />
    </div>
  </React.StrictMode>,
);
