import { describe, expect, test } from "vitest";
import type { PairedPresenterAxeLedger } from "./axe";
import { expectedNw223AxeCaptureIds, expectedNw223CaptureIds, validateNw223Ledger, type Nw223EvidenceLedger } from "./nw223-ledger";

const hash = "a".repeat(64);
const measurement = {
  triggerRelativeRect: { x: 0, y: 0, width: 1, height: 1 },
  skylineRelativeRect: { x: 0, y: 0, width: 1, height: 1 },
  triggerComputedStyleSha256: hash,
  skylineComputedStyleSha256: hash,
  triggerAccessibilitySha256: hash,
  skylineAccessibilitySha256: hash,
  anchorRect: { x: 0, y: 0, width: 1, height: 1 },
  anchorComputedStyleSha256: hash,
  anchorAccessibilitySha256: hash,
  anchorAccessibleName: "SQL query",
};
const transcript = {
  dialogCountBefore: 0,
  dialogCountAfterEscape: 0,
  expand: { connected: false, focused: false },
  presenterCount: 0,
  selectedAnchorCount: 1,
  active: { tag: "body", role: "", name: "" },
};
const axe: PairedPresenterAxeLedger = {
  trigger: { outside: [], inside: [] },
  skyline: { outside: [], inside: [] },
};

function ledger(): Nw223EvidenceLedger {
  return {
    measurements: Object.fromEntries(expectedNw223CaptureIds.map((capture) => [capture, structuredClone(measurement)])),
    interactions: Object.fromEntries(expectedNw223AxeCaptureIds.map((capture) => [capture, { trigger: structuredClone(transcript), skyline: structuredClone(transcript) }])),
    axe: Object.fromEntries(expectedNw223AxeCaptureIds.map((capture) => [capture, structuredClone(axe)])),
  };
}

describe("NW-223 exact evidence ledger schema", () => {
  test("requires all 54 measurements and 39 interaction/Axe captures", () => {
    expect(expectedNw223CaptureIds).toHaveLength(54);
    expect(expectedNw223AxeCaptureIds).toHaveLength(39);
    expect(validateNw223Ledger(ledger())).toEqual(ledger());
  });

  test("fails closed on missing, extra, or patterned keys", () => {
    const missing = ledger();
    delete missing.measurements[expectedNw223CaptureIds[0]];
    expect(() => validateNw223Ledger(missing)).toThrow(/measurement keys/i);

    const extra = ledger();
    extra.axe["runs-inspectors-redis-*@1440x960-classic"] = axe;
    expect(() => validateNw223Ledger(extra)).toThrow(/Axe keys/i);
  });

  test("fails closed on changed interactions and malformed evidence", () => {
    const changed = ledger();
    changed.interactions[expectedNw223AxeCaptureIds[0]].skyline.presenterCount = 1;
    expect(() => validateNw223Ledger(changed)).toThrow(/interaction transcript/i);

    const malformed = ledger();
    malformed.measurements[expectedNw223CaptureIds[0]].triggerAccessibilitySha256 = "sentinel";
    expect(() => validateNw223Ledger(malformed)).toThrow(/measurement/i);
  });
});
