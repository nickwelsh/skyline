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
  const url = normalizeRouterUrl(observation.url);
  const storage = normalizeStorage(observation.storage);
  const activeElement = observation.activeElement?.tag === "BODY" ? { ...observation.activeElement, name: "" } : observation.activeElement;
  return { ...observation, url, storage, activeElement };
}

function normalizeRouterUrl(value: string) {
  const prefixed = value.replace(/^\/(?:skyline|reference|oracle)(?=\/|$)/, "") || "/";
  const url = new URL(prefixed, "https://fidelity.invalid");
  const span = url.searchParams.get("span");
  const node = url.searchParams.get("node");
  const selection = span ?? node;
  if ((span === null) !== (node === null) && /^\/runs\/[^/]+$/.test(url.pathname) && selection?.startsWith("attempt_")) {
    url.searchParams.delete("span");
    url.searchParams.delete("node");
    url.searchParams.set("attempt-selection", selection);
  }
  url.searchParams.sort();
  return `${url.pathname}${url.search}${url.hash}`;
}

function normalizeStorage(storage: Record<string, string>) {
  const normalized: Record<string, string> = {};
  const panels: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(storage)) {
    if (key.startsWith("skyline.ui-preferences.v1:")) {
      const preferences = parseRecord(value);
      normalized["skyline.ui-preferences.v1:/application"] = JSON.stringify({
        version: preferences.version,
        theme: preferences.theme,
        contrast: preferences.contrast,
      });
      for (const [id, panel] of Object.entries(record(preferences.panels))) panels[id] = normalizeAdapterPanel(panel);
      continue;
    }
    if (key === "panel-run-parent-v3" || key === "panel-run-tree") {
      panels[key] = normalizeNativePanel(parseRecord(value));
      continue;
    }
    normalized[key] = value;
  }
  for (const id of Object.keys(panels).sort()) normalized[`panel:${id}`] = JSON.stringify(panels[id]);
  return normalized;
}

function normalizeAdapterPanel(value: unknown) {
  const panel = record(value);
  return panelSnapshot(panel.orientation, panel.itemIds, panel.sizes);
}

function normalizeNativePanel(panel: Record<string, unknown>) {
  const items = Array.isArray(panel.items) ? panel.items.map(record).filter((item) => item.type === "panel") : [];
  const sizes = items.map((item) => {
    const current = record(item.currentValue);
    const fallback = record(item.default);
    return number(current.type === "percent" ? current.value : fallback.value);
  });
  return panelSnapshot(panel.orientation, items.map((item) => item.id), sizes);
}

function panelSnapshot(orientation: unknown, itemIds: unknown, sizes: unknown) {
  const values = Array.isArray(sizes) ? sizes.map(number) : [];
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    orientation,
    itemIds: Array.isArray(itemIds) ? itemIds : [],
    sizes: values.map((value) => Math.round((total > 0 ? value / total : value) * 100) / 100),
  };
}

function parseRecord(value: string) {
  try { return record(JSON.parse(value)); }
  catch { return {}; }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
