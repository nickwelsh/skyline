import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, test } from "vitest";
import {
  ReferenceInitialLoadingPage,
  referenceInitialLoadingRoute,
} from "./reference/ReferenceInitialLoadingPage";

afterEach(() => {
  document.body.replaceChildren();
});

describe("pinned reference initial loading page", () => {
  test.each([
    ["jobs", "/skyline/jobs", "Jobs", "Loading Jobs", undefined],
    ["run", "/skyline/runs/run-01", "run-01", "Loading Run", "Runs"],
    ["queue", "/skyline/queues/redis%3Adefault", "redis:default", "Loading Queue target", "Queues"],
  ] as const)("renders %s with Skyline's canonical route header", async (surface, canonicalUrl, title, loadingLabel, backLabel) => {
    const route = referenceInitialLoadingRoute(canonicalUrl);
    const router = createMemoryRouter([{
      path: "*",
      element: createElement(ReferenceInitialLoadingPage, { route }),
    }], { initialEntries: [`/oracle/${surface}-loading`] });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(RouterProvider, { router })));

    expect(container.querySelector("h2")?.textContent).toBe(title);
    expect(container.querySelector(`[aria-label="${loadingLabel}"]`)).not.toBeNull();
    expect(container.querySelector('[aria-label="Loading"]')).toBeNull();
    expect(container.firstElementChild?.getAttribute("class")).toContain("overflow-hidden");
    if (backLabel) expect(container.querySelector("a")?.textContent).toBe(backLabel);
    else expect(container.querySelector("a")).toBeNull();

    router.dispose();
    await act(async () => root.unmount());
  });
});
