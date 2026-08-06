import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { QueueEnvironmentCharts } from "./QueueTargetCharts";

describe("QueueEnvironmentCharts", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("does not invent history from current queue snapshots", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);

    flushSync(() => root.render(<QueueEnvironmentCharts />));

    expect(container.querySelectorAll('[role="img"]')).toHaveLength(4);
    expect(container.querySelectorAll(".recharts-responsive-container")).toHaveLength(0);
    expect(container.textContent?.match(/No activity/g)).toHaveLength(4);
    expect(Array.from(container.querySelectorAll("h3")).every((header) => header.querySelector(":scope > div > .min-h-6"))).toBe(true);

    flushSync(() => root.unmount());
  });
});
