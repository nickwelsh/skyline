import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { captureEnvironment, installDeterministicSplineViewer, loadingBarCaptureContract, stabilizeLoadingBarCapture } from "./capture";

afterEach(() => {
  document.body.replaceChildren();
  document.head.querySelectorAll("style[data-fidelity-loading-bar-capture]").forEach((element) => element.remove());
});

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

  test("stabilizes exactly one pending loading bar and remains idempotent", () => {
    expect(stabilizeLoadingBarCapture(loadingBarCaptureContract)).toBe(0);
    const loading = document.createElement("div");
    loading.className = loadingBarCaptureContract.className;
    document.body.append(loading);

    for (const left of ["20%", "40%", "60%"] ) {
      loading.style.left = left;
      expect(stabilizeLoadingBarCapture(loadingBarCaptureContract)).toBe(1);
      expect(document.querySelectorAll(`style[${loadingBarCaptureContract.styleMarker}]`)).toHaveLength(1);
    }

    const rule = document.querySelector<HTMLStyleElement>(`style[${loadingBarCaptureContract.styleMarker}]`)!;
    expect(rule.textContent).toBe(loadingBarCaptureContract.styleText);
    expect(rule.sheet?.cssRules[0]?.cssText).toContain("left: -100% !important");
    expect(rule.sheet?.cssRules[0]?.cssText).toContain("width: 100% !important");
    rule.textContent = `${loadingBarCaptureContract.selector} { left: 0; }`;
    expect(() => stabilizeLoadingBarCapture(loadingBarCaptureContract)).toThrow(/stabilization rule/);
  });

  test("leaves unrelated finite elements untouched and rejects selector drift", () => {
    const finite = document.createElement("div");
    finite.className = "finite-loading-indicator";
    finite.style.left = "50%";
    document.body.append(finite);
    expect(stabilizeLoadingBarCapture(loadingBarCaptureContract)).toBe(0);
    expect(finite.style.left).toBe("50%");

    const mutated = document.createElement("div");
    mutated.className = loadingBarCaptureContract.className.replace(" via-blue-500", "");
    document.body.append(mutated);
    expect(() => stabilizeLoadingBarCapture(loadingBarCaptureContract)).toThrow(/literal source LoadingBarDivider/);
  });

  test("locks the full pinned loading-bar keyframes and timing outside visual stabilization", () => {
    const paths = [
      resolve(import.meta.dirname, "../../../resources/js/trigger/components/primitives/LoadingBarDivider.tsx"),
      resolve(import.meta.dirname, "../reference/vendor/components/primitives/LoadingBarDivider.tsx"),
    ];
    for (const path of paths) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain('{ left: ["-100%", "100%"], width: "100%" }');
      expect(source).toContain('{ duration: 2, ease: "easeOut", repeat: Infinity }');
      expect(source).toContain(`className="${loadingBarCaptureContract.className}"`);
    }
  });
});
