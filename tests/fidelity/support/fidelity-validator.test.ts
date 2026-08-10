import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { validateAllowedDifferences } from "../../../scripts/fidelity-oracle.mjs";
import manifest from "../allowed-differences.json" with { type: "json" };
import persistedLedger from "../nw223-evidence-ledger.json" with { type: "json" };
import { expectedNw223CaptureIds, validateNw223Ledger, type Nw223EvidenceLedger } from "./nw223-ledger";

const rendererIds = [
  "error-codeblock-corner-rasterization",
  "error-codeblock-classic-rasterization",
  "error-codeblock-classic-right-rasterization",
  "error-codeblock-light-rasterization",
  "error-codeblock-light-right-rasterization",
  "error-codeblock-dark-rasterization",
];

describe("fidelity manifest validator", () => {
  test("accepts the exact seven renderer policies and an empty definition-level NW-223 anchor name", () => {
    const candidate = validationCandidate();
    const renderers = regions(candidate).filter(({ category }) => category === "renderer-rasterization");
    const nw223 = region(candidate, "database-state-operation-inspector");

    expect(renderers.map(({ id }) => id)).toEqual([...rendererIds, "run-breadcrumb-rasterization"]);
    expect(nw223.anchorAccessibleName).toBe("");
    expect(() => validateAllowedDifferences(candidate)).not.toThrow();
  });

  test.each(["missing", "non-string"])("rejects a %s definition-level NW-223 anchor name", (variant) => {
    const candidate = validationCandidate();
    const nw223 = region(candidate, "database-state-operation-inspector");
    if (variant === "missing") Reflect.deleteProperty(nw223, "anchorAccessibleName");
    else nw223.anchorAccessibleName = 7;

    expect(() => validateAllowedDifferences(candidate)).toThrow(/presenter-extension/i);
  });

  test("keeps every NW-223 per-capture anchor name nonempty", () => {
    const candidate = structuredClone(persistedLedger) as Nw223EvidenceLedger;
    candidate.measurements[expectedNw223CaptureIds[0]].anchorAccessibleName = "";

    expect(() => validateNw223Ledger(candidate)).toThrow(/accessible name/i);
  });

  test.each(["citations", "captures", "measurements"])("rejects changed renderer %s", (field) => {
    const candidate = validationCandidate();
    const renderer = region(candidate, rendererIds[1]);
    if (field === "citations") (renderer.citations as string[]).push("https://example.invalid");
    if (field === "captures") (renderer.captures as string[]).pop();
    if (field === "measurements") {
      const capture = (renderer.captures as string[])[0];
      const measurement = (renderer.measurements as Record<string, { trigger: { cropSha256: string } }>)[capture];
      measurement.trigger.cropSha256 = "0".repeat(64);
    }

    expect(() => validateAllowedDifferences(candidate)).toThrow(/renderer-rasterization/i);
  });

  test("pins the unchanged breadcrumb policy digest", () => {
    const breadcrumb = region(manifest, "run-breadcrumb-rasterization");
    const policy = JSON.parse(readFileSync(resolve(import.meta.dirname, "../breadcrumb-rasterization-policy.json"), "utf8"));
    const digest = createHash("sha256").update(JSON.stringify(policy)).digest("hex");

    expect(breadcrumb.policySha256).toBe("477b6f07cd22b699988290c021f2d866a44229970364b689d25e94357df48b66");
    expect(digest).toBe(breadcrumb.policySha256);
  });
});

function regions(candidate: unknown): Array<Record<string, unknown>> {
  return (candidate as { regions: Array<Record<string, unknown>> }).regions;
}

function region(candidate: unknown, id: string): Record<string, unknown> {
  const value = regions(candidate).find((entry) => entry.id === id);
  if (!value) throw new Error(`Missing region ${id}.`);
  return value;
}

function validationCandidate(): unknown {
  const candidate = structuredClone(manifest) as unknown as { regions: Array<Record<string, unknown>> };
  candidate.regions = candidate.regions.filter(({ id }) => id === "database-state-operation-inspector" || id === "run-breadcrumb-rasterization" || rendererIds.includes(String(id)));
  return candidate;
}
