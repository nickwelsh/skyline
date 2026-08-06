import { describe, expect, test } from "vitest";
import { FixtureAdapter } from "../../../resources/js/skyline/FixtureAdapter";
import { nw222InspectorState, nw222TraceState } from "./nw222";

const runId = "run_01J8R4NQX6K3PV4W0A1H2Z7M9C";
const firstAttempt = `attempt_${runId}_1`;
const secondAttempt = `attempt_${runId}_2`;

describe("NW-222 fidelity states", () => {
  test("provides captured application, vendor, and source-link evidence", async () => {
    const adapter = new FixtureAdapter();
    const inspector = nw222InspectorState(await adapter.inspector(firstAttempt, runId), firstAttempt, "exception");

    expect(inspector.exception).toMatchObject({
      class: "Illuminate\\Database\\DeadlockException",
      location: {
        file: "app/Jobs/GenerateMonthlyInvoices.php",
        line: 58,
        href: "https://example.test/source/app/Jobs/GenerateMonthlyInvoices.php#L58",
      },
      frames: [
        expect.objectContaining({ isVendor: false, href: "https://example.test/source/app/Jobs/GenerateMonthlyInvoices.php#L58" }),
        expect.objectContaining({ isVendor: true, href: null }),
      ],
    });
  });

  test("keeps long evidence and unavailable evidence distinct", async () => {
    const adapter = new FixtureAdapter();
    const source = await adapter.inspector(firstAttempt, runId);

    expect(nw222InspectorState(source, firstAttempt, "exception-long").exception?.frames.length).toBeGreaterThan(20);
    expect(nw222InspectorState(source, firstAttempt, "exception-unavailable").exception).toBeNull();
  });

  test("keeps retry failures causally distinct", async () => {
    const adapter = new FixtureAdapter();
    const detail = nw222TraceState(await adapter.trace(runId), "exception-retry");
    const retry = nw222InspectorState(await adapter.inspector(secondAttempt, runId), secondAttempt, "exception-retry");

    expect(detail.attempts.map(({ status }) => status)).toEqual(["failed", "failed"]);
    expect(detail.attempts[1].failure).toMatchObject({ class: "LogicException", message: "Retry failed differently." });
    expect(retry.exception).toMatchObject({ class: "LogicException", message: "Retry failed differently.", location: null, frames: [] });
  });
});
