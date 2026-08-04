import "non.geist";
import "non.geist/mono";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./trigger/TriggerInterface";
import "./trigger/tailwind.css";

document.documentElement.dataset.theme = "classic";

ReactDOM.createRoot(document.getElementById("skyline")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
