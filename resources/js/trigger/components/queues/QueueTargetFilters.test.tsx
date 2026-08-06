import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { QueuePeriodFilter } from "./QueueTargetFilters";

describe("QueuePeriodFilter", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("matches source chrome while keeping shareable native selection", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);

    flushSync(() => root.render(
      <MemoryRouter initialEntries={["/queues?cursor=next&direction=forward"]}>
        <QueuePeriodFilter generatedAt="2026-08-05T12:00:00.000Z" timeRanges={[
          { value: "1h", label: "Last hour", durationSeconds: 3_600 },
          { value: "24h", label: "Last 24 hours", durationSeconds: 86_400 },
        ]} />
        <LocationProbe />
      </MemoryRouter>,
    ));

    expect(container.textContent).toContain("Period: 1hr");
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Period"]')!;
    expect(select.value).toBe("1h");

    flushSync(() => {
      select.value = "24h";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).toContain("Period: 24hr");
    const query = new URLSearchParams(container.querySelector("output")!.textContent ?? "");
    expect(query.get("range")).toBe("24h");
    expect(query.has("cursor")).toBe(false);
    expect(query.has("direction")).toBe(false);
    expect(query.get("from")).toBe("2026-08-04T12:00:00.000Z");
    expect(query.get("to")).toBe("2026-08-05T12:00:00.000Z");

    flushSync(() => root.unmount());
  });
});

function LocationProbe() {
  const location = useLocation();
  return <output>{location.search}</output>;
}
