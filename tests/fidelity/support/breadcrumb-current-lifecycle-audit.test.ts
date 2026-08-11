import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import audit from "../breadcrumb-current-lifecycle-audit.json" with { type: "json" };
import policy from "../breadcrumb-rasterization-policy.json" with { type: "json" };
import replacements from "../breadcrumb-stale3-source-replacements.json" with { type: "json" };
import {
  validateBreadcrumbRasterizationObservation,
  validateBreadcrumbRasterizationPolicy,
  type BreadcrumbRasterizationObservation,
  type BreadcrumbRasterizationPolicy,
  type BreadcrumbSideEvidence,
} from "./breadcrumb-rasterization";

const approved = policy as unknown as BreadcrumbRasterizationPolicy;
const mappings = audit.mappings;

describe("breadcrumb current-lifecycle audit approval", () => {
  test("approves audited candidates except exact current-source replacements", () => {
    const superseded = mappings.filter((mapping) => replacements.replacements.some((replacement) =>
      replacement.capture === mapping.capture && replacement.removeCandidateSha256 === mapping.candidateSha256));
    const active = mappings.filter((mapping) => !superseded.includes(mapping));
    const missing = active.filter((mapping) => !approved.captures[mapping.capture].candidates
      .some(({ sha256 }) => sha256 === mapping.candidateSha256));

    expect(audit.reportSha256).toBe("c72b3a458de6c95cc8a9573be59e8e4d611f13d118e0f90743c961caf393e7c5");
    expect(mappings).toHaveLength(54);
    expect(new Set(mappings.map(({ candidateSha256 }) => candidateSha256))).toHaveProperty("size", 15);
    expect(superseded).toEqual([
      { capture: "error-stale-refresh@1440x960-classic", candidateSha256: "64c9263acb0d9783f94350d926e27bb2d824f482e2a184b0f3a2921bbad14cef", stateSha256: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945" },
      { capture: "error-stale-refresh@1440x960-dark", candidateSha256: "a441c92601b7e59ec6ac2f2e4295de67154fb8d9ee17c0bc52d4edb4dc75120a", stateSha256: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945" },
    ]);
    expect(missing).toEqual([]);
    expect(approved.states).toContainEqual(audit.newState);
  });

  test("preserves the exact prior policy while adding only audited evidence", () => {
    const prior = structuredClone(approved);
    for (const replacement of replacements.replacements) {
      prior.captures[replacement.capture].candidates = prior.captures[replacement.capture].candidates
        .map(({ sha256 }) => ({ sha256: sha256 === replacement.addCandidateSha256 ? replacement.removeCandidateSha256 : sha256 }));
    }
    for (const mapping of mappings) {
      prior.captures[mapping.capture].candidates = prior.captures[mapping.capture].candidates
        .filter(({ sha256 }) => sha256 !== mapping.candidateSha256);
    }
    prior.states = prior.states.filter(({ sha256 }) => sha256 !== audit.newState.sha256);
    prior.evidence.observations = 831;
    prior.evidence.finiteStates = 9;
    delete prior.source.currentLifecycleAuditSha256;
    delete prior.source.staleRefreshSourceReplacementSha256;

    expect(digest(prior)).toBe(audit.priorPolicySha256);
    expect(Object.keys(approved.captures)).toHaveLength(196);
    expect(approved.absentCaptures).toHaveLength(243);
    expect(approved.states).toHaveLength(10);
    const crossed = structuredClone(approved);
    crossed.captures["error-found@1024x768-classic"].candidates.push({ sha256: mappings[0].candidateSha256 });
    expect(() => validateBreadcrumbRasterizationPolicy(crossed)).toThrow(/approved policy/i);

    const unknownState = structuredClone(approved);
    unknownState.states.push({ sha256: "f".repeat(64), pixels: [] });
    expect(() => validateBreadcrumbRasterizationPolicy(unknownState)).toThrow(/approved policy/i);
  });

  test("accepts the exact two-pixel state without crossing capture or evidence locks", () => {
    const candidate = audit.newCandidate;
    const observation: BreadcrumbRasterizationObservation = {
      runtime: candidate.runtime,
      viewport: approved.captures[candidate.capture].viewport,
      trigger: candidate.strictEvidence.trigger as BreadcrumbSideEvidence,
      skyline: candidate.strictEvidence.skyline as BreadcrumbSideEvidence,
      pixels: audit.newState.pixels as BreadcrumbRasterizationObservation["pixels"],
    };

    expect(validateBreadcrumbRasterizationObservation(approved, candidate.capture, observation)).toMatchObject({
      status: "visible",
      stateSha256: candidate.stateSha256,
      candidateSha256: candidate.candidateSha256,
    });
    expect(() => validateBreadcrumbRasterizationObservation(approved, "runs-exception@1440x960-dark", observation)).toThrow(/capture evidence/i);
    expect(() => validateBreadcrumbRasterizationObservation(approved, candidate.capture, {
      ...observation,
      trigger: {
        ...observation.trigger!,
        svg: { ...observation.trigger!.svg, semanticDomSha256: "f".repeat(64) },
      },
    })).toThrow(/capture evidence/i);
    expect(() => validateBreadcrumbRasterizationObservation(approved, candidate.capture, {
      ...observation,
      trigger: {
        ...observation.trigger!,
        svg: { ...observation.trigger!.svg, cropSha256: "f".repeat(64) },
      },
    })).toThrow(/capture evidence/i);
    expect(() => validateBreadcrumbRasterizationObservation(approved, candidate.capture, {
      ...observation,
      pixels: [...observation.pixels, { x: 0, y: 0, trigger: [0, 0, 0, 255], skyline: [1, 1, 1, 255] }],
    })).toThrow(/finite state/i);
  });
});

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
