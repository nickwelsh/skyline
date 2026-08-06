import { isDeepStrictEqual } from "node:util";
import type { ActionObservation } from "./actions";

export type FidelityAxis = "pixels" | "accessibility" | "axe" | "url" | "history" | "focus" | "persistence" | "action";
export type FidelityDifference = { axis: FidelityAxis; detail: string };

type FidelityEvidence = {
  differingPixels?: number;
  triggerTree?: unknown;
  skylineTree?: unknown;
  additionalAxeViolations?: unknown[];
  triggerInteractions?: ActionObservation[];
  skylineInteractions?: ActionObservation[];
};

export function collectFidelityDifferences(evidence: FidelityEvidence): FidelityDifference[] {
  const differences: FidelityDifference[] = [];
  if ((evidence.differingPixels ?? 0) > 0) differences.push({ axis: "pixels", detail: `${evidence.differingPixels} unclassified pixels differ` });
  add(differences, "accessibility", evidence.triggerTree, evidence.skylineTree);
  if ((evidence.additionalAxeViolations?.length ?? 0) > 0) differences.push({ axis: "axe", detail: `${evidence.additionalAxeViolations?.length} additional violations: ${summary(evidence.additionalAxeViolations)}` });

  const trigger = evidence.triggerInteractions ?? [];
  const skyline = evidence.skylineInteractions ?? [];
  if (trigger.length !== skyline.length) differences.push({ axis: "action", detail: `transcript length ${trigger.length} != ${skyline.length}` });
  for (let index = 0; index < Math.min(trigger.length, skyline.length); index += 1) {
    const expected = normalizeObservation(trigger[index]);
    const actual = normalizeObservation(skyline[index]);
    const prefix = `${expected.step}: `;
    add(differences, expected.step.includes("history") ? "history" : "url", expected.url, actual.url, prefix);
    add(differences, "focus", expected.activeElement, actual.activeElement, prefix);
    add(differences, "persistence", expected.storage, actual.storage, prefix);
    add(differences, "action", { step: expected.step, visible: expected.visible, clipboard: expected.clipboard }, { step: actual.step, visible: actual.visible, clipboard: actual.clipboard }, prefix);
  }
  return differences;
}

function normalizeObservation(observation: ActionObservation): ActionObservation {
  const url = observation.url.replace(/^\/(?:skyline|reference|oracle)(?=\/|$)/, "") || "/";
  const storage = Object.fromEntries(Object.entries(observation.storage).map(([key, value]) => [
    key.replace(/:\/(?:skyline|reference)$/, ":/application"),
    value,
  ]));
  const activeElement = observation.activeElement?.tag === "BODY" ? { ...observation.activeElement, name: "" } : observation.activeElement;
  return { ...observation, url, storage, activeElement };
}

export function assertNoFidelityDifferences(differences: FidelityDifference[]) {
  if (differences.length === 0) return;
  throw new Error(`Fidelity axes drifted:\n${differences.map(({ axis, detail }) => `[${axis}] ${detail}`).join("\n")}`);
}

function add(differences: FidelityDifference[], axis: FidelityAxis, expected: unknown, actual: unknown, prefix = "") {
  if (expected === undefined && actual === undefined) return;
  if (!isDeepStrictEqual(expected, actual)) differences.push({ axis, detail: `${prefix}${summary(expected)} != ${summary(actual)}` });
}

function summary(value: unknown) {
  const serialized = JSON.stringify(value);
  return serialized && serialized.length > 180 ? `${serialized.slice(0, 177)}...` : (serialized ?? String(value));
}
