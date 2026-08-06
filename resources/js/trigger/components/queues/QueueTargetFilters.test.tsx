import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { QueueConnectionFilter, QueuePeriodFilter } from "./QueueTargetFilters";

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

describe("QueueConnectionFilter", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("uses server options and preserves selected URL state through history and reload", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);

    flushSync(() => root.render(
      <MemoryRouter initialEntries={["/queues?cursor=next&direction=forward"]}>
        <QueueConnectionFilter connections={["database", "redis", "sqs"]} />
        <LocationProbe />
        <HistoryControls />
      </MemoryRouter>,
    ));

    const select = container.querySelector<HTMLSelectElement>('select[data-skyline-extension="queue-connection-filter"]')!;
    expect(select.getAttribute("aria-label")).toBe("Connection");
    expect([...select.options].map(({ value }) => value)).toEqual(["", "database", "redis", "sqs"]);

    flushSync(() => {
      select.value = "database";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const query = new URLSearchParams(container.querySelector("output")!.textContent ?? "");
    expect(query.get("connection")).toBe("database");
    expect(query.has("cursor")).toBe(false);
    expect(query.has("direction")).toBe(false);

    flushSync(() => container.querySelector<HTMLButtonElement>('[aria-label="Back"]')!.click());
    expect(select.value).toBe("");
    flushSync(() => container.querySelector<HTMLButtonElement>('[aria-label="Forward"]')!.click());
    expect(select.value).toBe("database");

    const reloadEntry = container.querySelector("output")!.textContent ?? "";
    flushSync(() => root.unmount());
    const reloadRoot = createRoot(container);
    flushSync(() => reloadRoot.render(
      <MemoryRouter initialEntries={[`/queues${reloadEntry}`]}>
        <QueueConnectionFilter connections={["database", "redis", "sqs"]} />
      </MemoryRouter>,
    ));
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Connection"]')!.value).toBe("database");

    flushSync(() => reloadRoot.unmount());
  });
});

function LocationProbe() {
  const location = useLocation();
  return <output>{location.search}</output>;
}

function HistoryControls() {
  const navigate = useNavigate();
  return <><button aria-label="Back" onClick={() => navigate(-1)} /><button aria-label="Forward" onClick={() => navigate(1)} /></>;
}
