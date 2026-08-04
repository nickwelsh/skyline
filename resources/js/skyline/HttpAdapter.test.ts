import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpAdapter, SkylineApiError } from "./HttpAdapter";

afterEach(() => vi.restoreAllMocks());

describe("HttpAdapter", () => {
  it("encodes Runs filters and active polling selections", async () => {
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ runs: [] }))
      .mockResolvedValueOnce(jsonResponse({ runs: [], newRunCount: 0, pollCursor: "next" }));
    const adapter = new HttpAdapter("/monitoring");

    await adapter.runs({ search: "Invoice", status: ["running", "failed"], cursor: "opaque" });
    await adapter.updates({ status: ["running"] }, "poll", ["run-a", "run-b"]);

    expect(String(fetch.mock.calls[0][0])).toBe("/monitoring/api/runs?cursor=opaque&search=Invoice&status%5B%5D=running&status%5B%5D=failed");
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
