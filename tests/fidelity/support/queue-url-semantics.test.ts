import { describe, expect, it } from "vitest";
import { collectFidelityDifferences } from "./differences";
import { normalizeQueueFilterUrl } from "./queue-url-semantics";

describe("NW-221 Queue filter URL semantics", () => {
  it("maps source query to Skyline search and accepts one observed Connection value", () => {
    expect(normalizeQueueFilterUrl("/queues?query=reports", "trigger")).toBe("/queues?search=reports");
    expect(normalizeQueueFilterUrl("/queues?connection=database&search=reports", "skyline")).toBe("/queues?search=reports");
    expect(collectFidelityDifferences({
      triggerInteractions: [observation("/queues?query=reports")],
      skylineInteractions: [observation("/skyline/queues?connection=database&search=reports")],
    })).toEqual([]);
  });

  it.each(["database", "redis", "sqs"])("accepts observed connection %s", (connection) => {
    expect(normalizeQueueFilterUrl(`/queues?connection=${connection}`, "skyline")).toBe("/queues");
  });

  it("fails closed for wrong-side fields, duplicate fields, and unobserved Connection values", () => {
    const cases = [
      ["/queues?search=reports", "trigger"],
      ["/queues?connection=database", "trigger"],
      ["/queues?query=reports", "skyline"],
      ["/queues?query=one&query=two", "trigger"],
      ["/queues?search=one&search=two", "skyline"],
      ["/queues?connection=database&connection=redis", "skyline"],
      ["/queues?connection=unknown", "skyline"],
      ["/queues?connection=", "skyline"],
      ["/queues?query=", "trigger"],
      ["/queues?search=", "skyline"],
    ] as const;
    for (const [url, application] of cases) {
      expect(normalizeQueueFilterUrl(url, application)).toContain(`invalid-${application}-queue-filter:`);
    }
  });

  it("preserves unrelated parameters and does not touch non-list routes", () => {
    expect(normalizeQueueFilterUrl("/queues?query=reports&range=24h&extra=value", "trigger"))
      .toBe("/queues?extra=value&range=24h&search=reports");
    expect(normalizeQueueFilterUrl("/queues?connection=redis&extra=value&range=24h&search=reports", "skyline"))
      .toBe("/queues?extra=value&range=24h&search=reports");
    expect(normalizeQueueFilterUrl("/queues/queue_1?query=reports", "trigger"))
      .toBe("/queues/queue_1?query=reports");
  });

  it.each([
    ["/queues?search=reports", "/skyline/queues?search=reports"],
    ["/queues?query=one&query=two", "/skyline/queues?search=one&search=two"],
    ["/queues", "/skyline/queues?connection=unknown"],
    ["/queues?query=reports", "/skyline/queues?search=reports&unknown=value"],
  ])("reports invalid or unpaired Queue filter semantics: %s vs %s", (triggerUrl, skylineUrl) => {
    expect(collectFidelityDifferences({
      triggerInteractions: [observation(triggerUrl)],
      skylineInteractions: [observation(skylineUrl)],
    })).toEqual([expect.objectContaining({ axis: "url" })]);
  });
});

function observation(url: string) {
  return { step: "captured", url, activeElement: null, visible: [], storage: {}, clipboard: null };
}
