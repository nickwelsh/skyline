import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpAdapter, SkylineApiError } from "./HttpAdapter";

afterEach(() => vi.restoreAllMocks());

describe("HttpAdapter", () => {
  it("encodes Error-group list and occurrence URL state", async () => {
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ errorGroups: [] }))
      .mockResolvedValueOnce(jsonResponse({ errorGroup: {}, failedAttempts: [] }));
    const adapter = new HttpAdapter("/monitoring");

    await adapter.errorGroups({ jobType: "App\\Jobs\\Invoice", exceptionClass: "RuntimeException", period: "7d", cursor: "next" });
    await adapter.errorGroup("error/opaque", { period: "24h", cursor: "older" });

    expect(String(fetch.mock.calls[0][0])).toBe("/monitoring/api/errors?jobType=App%5CJobs%5CInvoice&exceptionClass=RuntimeException&period=7d&cursor=next");
    expect(String(fetch.mock.calls[1][0])).toBe("/monitoring/api/errors/error%2Fopaque?period=24h&cursor=older");
  });

  it("encodes Queue-target list and detail URL state", async () => {
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ queueTargets: [] }))
      .mockResolvedValueOnce(jsonResponse({ queueTarget: {}, runs: [] }));
    const adapter = new HttpAdapter("/monitoring");

    await adapter.queueTargets({ connection: "redis", search: "billing", from: "2026-08-01T00:00:00Z", to: "2026-08-02T00:00:00Z" });
    await adapter.queueTarget("queue/opaque", { status: ["failed"], cursor: "next" });

    expect(String(fetch.mock.calls[0][0])).toBe("/monitoring/api/queues?connection=redis&search=billing&from=2026-08-01T00%3A00%3A00Z&to=2026-08-02T00%3A00%3A00Z");
    expect(String(fetch.mock.calls[1][0])).toBe("/monitoring/api/queues/queue%2Fopaque?cursor=next&status%5B%5D=failed");
  });

  it("encodes Job list and detail URL state", async () => {
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ jobs: [] }))
      .mockResolvedValueOnce(jsonResponse({ job: {}, runs: [] }));
    const adapter = new HttpAdapter("/monitoring");

    await adapter.jobs({ search: "Invoice / Digest", period: "24h" });
    await adapter.job("job/opaque", { status: ["running", "failed"], cursor: "next", period: "7d" });

    expect(String(fetch.mock.calls[0][0])).toBe("/monitoring/api/jobs?search=Invoice+%2F+Digest&period=24h");
    expect(String(fetch.mock.calls[1][0])).toBe("/monitoring/api/jobs/job%2Fopaque?cursor=next&status%5B%5D=running&status%5B%5D=failed&period=7d");
  });

  it("encodes Runs filters and active polling selections", async () => {
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ runs: [] }))
      .mockResolvedValueOnce(jsonResponse({ runs: [], newRunCount: 0, pollCursor: "next" }));
    const adapter = new HttpAdapter("/monitoring");

    await adapter.runs({
      search: "Invoice",
      status: ["running", "failed"],
      cursor: "opaque",
      job: "App\\Jobs\\Invoice",
      connection: "redis",
      queue: "mail",
      trace: "trace-01",
      rootOnly: true,
      triggeredFrom: "2026-08-01T00:00:00Z",
      triggeredTo: "2026-08-02T00:00:00Z",
    });
    await adapter.updates({ status: ["running"] }, "poll", ["run-a", "run-b"]);

    expect(String(fetch.mock.calls[0][0])).toBe("/monitoring/api/runs?cursor=opaque&search=Invoice&status%5B%5D=running&status%5B%5D=failed&job=App%5CJobs%5CInvoice&connection=redis&queue=mail&trace=trace-01&rootOnly=true&triggeredFrom=2026-08-01T00%3A00%3A00Z&triggeredTo=2026-08-02T00%3A00%3A00Z");
    expect(String(fetch.mock.calls[1][0])).toBe("/monitoring/api/runs/updates?status%5B%5D=running&since=poll&runIds%5B%5D=run-a&runIds%5B%5D=run-b");
  });

  it("reuses revision responses after a 304", async () => {
    const payload = { trace: { revision: 4 } };
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(payload, { ETag: '"trace-4"' }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    const adapter = new HttpAdapter("/skyline");

    const first = await adapter.trace("run/encoded", "state");
    expect(first).toStrictEqual(payload);
    expect(await adapter.trace("run/encoded", "state")).toBe(first);
    expect(fetch.mock.calls[1][1]?.headers).toMatchObject({ "If-None-Match": '"trace-4"' });
  });

  it("surfaces structured authorization and read errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({
      error: { code: "forbidden", message: "Not allowed." },
    }, {}, 403));

    await expect(new HttpAdapter("/skyline").runs()).rejects.toEqual(
      new SkylineApiError(403, "forbidden", "Not allowed."),
    );
  });
});

function jsonResponse(value: unknown, headers: Record<string, string> = {}, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
