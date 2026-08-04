import "non.geist";
import "non.geist/mono";
import React from "react";
import ReactDOM from "react-dom/client";
import { FixtureAdapter } from "./skyline/FixtureAdapter";
import { HttpAdapter } from "./skyline/HttpAdapter";
import { App } from "./trigger/TriggerInterface";
import "./trigger/tailwind.css";

document.documentElement.dataset.theme = "classic";
const root = document.getElementById("skyline")!;
const basePath = root.dataset.basePath ?? "/skyline";
const adapter = root.dataset.fixtures === "true" ? new FixtureAdapter() : new HttpAdapter(basePath);

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App adapter={adapter} basePath={basePath} />
  </React.StrictMode>,
);
