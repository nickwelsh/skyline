import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import manifest from "../allowed-differences.json" with { type: "json" };
import persistedLedger from "../nw223-evidence-ledger.json" with { type: "json" };
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
const axeRule = {
  id: "region",
  impact: "moderate",
  tags: ["cat.keyboard"],
  targets: ['["main"]'],
};

function ledger(): Nw223EvidenceLedger {
  return {
    measurements: Object.fromEntries(expectedNw223CaptureIds.map((capture) => [capture, structuredClone(measurement)])),
    interactions: Object.fromEntries(expectedNw223AxeCaptureIds.map((capture) => [capture, { trigger: structuredClone(transcript), skyline: structuredClone(transcript) }])),
    axe: Object.fromEntries(expectedNw223AxeCaptureIds.map((capture) => [capture, structuredClone(axe)])),
  };
}

describe("NW-223 exact evidence ledger schema", () => {
  test("owns the exact manifest measurements and selectors", () => {
    const region = manifest.regions.find(({ id }) => id === "database-state-operation-inspector");
    expect(region).toMatchObject({
      category: "presenter-extension",
      decision: "NW-223",
      captures: expectedNw223CaptureIds,
      triggerSelector: "div[translate='no']",
      skylineSelector: "[data-skyline-extension='database-state-operation-inspector']",
      triggerAnchorSelector: "#tree [role='treeitem'][data-index='5']:has(p)",
      skylineAnchorSelector: "#tree [role='treeitem'][data-index='5']:has(p)",
      skylineAccessibleRole: "region",
      skylineAccessibleName: "Database and state operation inspector",
      anchorAccessibleRole: "treeitem",
      anchorAccessibleName: "",
      measurements: persistedLedger.measurements,
    });
  });

  test("locks the reviewed persisted 54/39/39 ledger", () => {
    const reviewed = validateNw223Ledger(persistedLedger as Nw223EvidenceLedger);
    expect(createHash("sha256").update(JSON.stringify(reviewed)).digest("hex"))
      .toBe("9612871c0df620b6d566c7719224248e918772707287d875f277e55b9716335b");
  });

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

  test("requires exact measurement shape and relative rect parity", () => {
    const unequal = ledger();
    unequal.measurements[expectedNw223CaptureIds[0]].skylineRelativeRect.x = 1;
    expect(() => validateNw223Ledger(unequal)).toThrow(/relative rect/i);

    const extra = ledger();
    Object.assign(extra.measurements[expectedNw223CaptureIds[0]], { wildcard: "*" });
    expect(() => validateNw223Ledger(extra)).toThrow(/measurement keys/i);
  });

  test("requires exact top-level and paired application keys", () => {
    const top = ledger();
    Object.assign(top, { extra: {} });
    expect(() => validateNw223Ledger(top)).toThrow(/ledger keys/i);

    const interaction = ledger();
    Object.assign(interaction.interactions[expectedNw223AxeCaptureIds[0]], { extra: transcript });
    expect(() => validateNw223Ledger(interaction)).toThrow(/interaction pair keys/i);

    const pairedAxe = ledger();
    Object.assign(pairedAxe.axe[expectedNw223AxeCaptureIds[0]], { extra: axe.trigger });
    expect(() => validateNw223Ledger(pairedAxe)).toThrow(/Axe pair keys/i);
  });

  test("requires a nonblank string anchor name", () => {
    const blank = ledger();
    blank.measurements[expectedNw223CaptureIds[0]].anchorAccessibleName = "   ";
    expect(() => validateNw223Ledger(blank)).toThrow(/accessible name/i);

    const wrongType = ledger();
    Object.assign(wrongType.measurements[expectedNw223CaptureIds[0]], { anchorAccessibleName: 7 });
    expect(() => validateNw223Ledger(wrongType)).toThrow(/accessible name/i);
  });

  test.each([
    ["partition extras", (value: Nw223EvidenceLedger) => Object.assign(value.axe[expectedNw223AxeCaptureIds[0]].trigger, { extra: [] })],
    ["rule extras", (value: Nw223EvidenceLedger) => Object.assign(addRule(value), { extra: true })],
    ["wildcard rules", (value: Nw223EvidenceLedger) => { addRule(value).id = "region*"; }],
    ["invalid impact", (value: Nw223EvidenceLedger) => { addRule(value).impact = "catastrophic"; }],
    ["empty tags", (value: Nw223EvidenceLedger) => { addRule(value).tags = [""]; }],
    ["non-string tags", (value: Nw223EvidenceLedger) => { Object.assign(addRule(value), { tags: [7] }); }],
    ["empty targets", (value: Nw223EvidenceLedger) => { addRule(value).targets = []; }],
    ["wildcard target segments", (value: Nw223EvidenceLedger) => { addRule(value).targets = ['["main *"]']; }],
    ["invalid selector syntax", (value: Nw223EvidenceLedger) => { addRule(value).targets = ['["["]']; }],
    ["non-string targets", (value: Nw223EvidenceLedger) => { Object.assign(addRule(value), { targets: [7] }); }],
    ["duplicate rule signatures", (value: Nw223EvidenceLedger) => { const rule = addRule(value); value.axe[expectedNw223AxeCaptureIds[0]].trigger.outside.push(structuredClone(rule)); }],
    ["duplicate target paths", (value: Nw223EvidenceLedger) => { const rule = addRule(value); rule.targets.push(rule.targets[0]); }],
    ["canonical duplicate target paths", (value: Nw223EvidenceLedger) => { const rule = addRule(value); rule.targets.push('[ "main" ]'); }],
  ])("rejects Axe %s", (_label, mutate) => {
    const value = ledger();
    mutate(value);
    expect(() => validateNw223Ledger(value)).toThrow(/Axe/i);
  });
});

function addRule(value: Nw223EvidenceLedger) {
  const rule = structuredClone(axeRule);
  value.axe[expectedNw223AxeCaptureIds[0]].trigger.outside.push(rule);
  return rule;
}
