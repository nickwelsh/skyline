import { afterEach, describe, expect, it } from "vitest";
import { readBootstrap } from "./bootstrap";

afterEach(() => document.body.replaceChildren());

describe("readBootstrap", () => {
  it("reads the single server-provided Application bootstrap", () => {
    const script = document.createElement("script");
    script.id = "skyline-bootstrap";
    script.type = "application/json";
    script.textContent = JSON.stringify({
      schemaVersion: 1,
      basePath: "/monitoring",
      applicationName: "Billing",
      environmentLabel: "production",
      capabilities: {
        navigation: { runs: true },
        runs: { view: true, cancel: false },
        shell: { shortcuts: true },
      },
    });
    document.body.append(script);

    expect(readBootstrap()).toMatchObject({
      schemaVersion: 1,
      basePath: "/monitoring",
      applicationName: "Billing",
      environmentLabel: "production",
      capabilities: { runs: { view: true, cancel: false } },
    });
  });

  it("fails closed when bootstrap is missing", () => {
    expect(() => readBootstrap()).toThrow("Skyline bootstrap is missing.");
  });

  it("defaults missing, invalid, and unknown capabilities to unavailable", () => {
    const script = document.createElement("script");
    script.id = "skyline-bootstrap";
    script.type = "application/json";
    script.textContent = JSON.stringify({
      schemaVersion: 1,
      basePath: "/monitoring",
      applicationName: "Billing",
      environmentLabel: "production",
      capabilities: {
        navigation: { jobs: true, runs: "yes", futureSurface: true },
        shell: { shortcuts: true, futureControl: true },
      },
    });
    document.body.append(script);

    expect(readBootstrap().capabilities).toMatchObject({
      navigation: { jobs: true, runs: false },
      shell: { shortcuts: true, appearance: false },
    });
    expect(readBootstrap().capabilities.navigation).not.toHaveProperty("futureSurface");
    expect(readBootstrap().capabilities.shell).not.toHaveProperty("futureControl");
  });

  it("rejects unsupported bootstrap versions", () => {
    const script = document.createElement("script");
    script.id = "skyline-bootstrap";
    script.type = "application/json";
    script.textContent = JSON.stringify({ schemaVersion: 2, basePath: "/skyline", applicationName: "Skyline", environmentLabel: "local", capabilities: {} });
    document.body.append(script);

    expect(() => readBootstrap()).toThrow("Skyline bootstrap is invalid.");
  });
});
