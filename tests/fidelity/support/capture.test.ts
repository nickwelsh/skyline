import { describe, expect, test } from "vitest";
import { captureEnvironment, installDeterministicSplineViewer } from "./capture";

describe("fidelity capture environment", () => {
  test.each([
    ["runs-populated@1440x960-classic", { width: 1440, height: 960, theme: "classic", colorScheme: "light" }],
    ["run-found@390x844-dark", { width: 390, height: 844, theme: "dark", colorScheme: "dark" }],
    ["shell-live-change@1440x960-system-light", { width: 1440, height: 960, theme: "system", colorScheme: "light" }],
  ])("parses %s", (capture, expected) => {
    expect(captureEnvironment(capture)).toEqual(expected);
  });

  test("pins external Spline artwork to one static Trigger mark", () => {
    installDeterministicSplineViewer();
    const constructor = customElements.get("spline-viewer");

    installDeterministicSplineViewer();
    const element = document.createElement("spline-viewer");
    document.body.append(element);

    expect(customElements.get("spline-viewer")).toBe(constructor);
    expect(element.getAttribute("data-fidelity-static-artwork")).toBe("trigger-mark@ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0");
    expect(element.getAttribute("aria-hidden")).toBe("true");
    expect(element.shadowRoot?.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 119 104");
    expect(element.shadowRoot?.querySelector("path")?.getAttribute("d")).toBe(
      "M35.664 42.4 59.411 1.269l58.853 101.937H.559l23.747-41.133 16.799 9.7-6.948 12.034h50.509L59.41 40.066 52.464 52.1l-16.8-9.7Z",
    );
    expect([...element.shadowRoot!.querySelectorAll("stop")].map((stop) => stop.getAttribute("stop-color"))).toEqual(["#E7FF52", "#41FF54"]);
  });
});
