import { afterEach, describe, expect, it } from "vitest";
import { readBootstrap } from "./bootstrap";

afterEach(() => document.body.replaceChildren());

describe("readBootstrap", () => {
  it("reads the single server-provided Application bootstrap", () => {
    const script = document.createElement("script");
    script.id = "skyline-bootstrap";
    script.type = "application/json";
    script.textContent = JSON.stringify({
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
      basePath: "/monitoring",
      applicationName: "Billing",
      environmentLabel: "production",
      capabilities: { runs: { view: true, cancel: false } },
    });
  });

  it("fails closed when bootstrap is missing", () => {
    expect(() => readBootstrap()).toThrow("Skyline bootstrap is missing.");
  });
});
