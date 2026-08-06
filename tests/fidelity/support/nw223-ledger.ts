import type { PairedPresenterAxeLedger, PartitionedAxeLedger } from "./axe";
import type { PresenterExtensionMeasurement } from "./difference-regions";
import { expectedExpandedDialogTranscript } from "./dialog-lifecycle";
import { nw223InteractionStates, nw223States } from "./nw223";

const themes = ["classic", "dark", "light"] as const;
const hash = /^[a-f0-9]{64}$/;

export const expectedNw223CaptureIds = nw223States.flatMap((state) => themes.map((theme) => `runs-${state}@1440x960-${theme}`));
export const expectedNw223AxeCaptureIds = nw223InteractionStates.flatMap((state) => themes.map((theme) => `runs-${state}@1440x960-${theme}`));

type InteractionTranscript = ReturnType<typeof expectedExpandedDialogTranscript>;
export type Nw223EvidenceLedger = {
  measurements: Record<string, PresenterExtensionMeasurement>;
  interactions: Record<string, { trigger: InteractionTranscript; skyline: InteractionTranscript }>;
  axe: Record<string, PairedPresenterAxeLedger>;
};

export function validateNw223Ledger(ledger: Nw223EvidenceLedger) {
  assertExactKeys("measurement", ledger.measurements, expectedNw223CaptureIds);
  assertExactKeys("interaction", ledger.interactions, expectedNw223AxeCaptureIds);
  assertExactKeys("Axe", ledger.axe, expectedNw223AxeCaptureIds);

  for (const capture of expectedNw223CaptureIds) assertMeasurement(capture, ledger.measurements[capture]);
  for (const capture of expectedNw223AxeCaptureIds) {
    const interaction = ledger.interactions[capture];
    if (JSON.stringify(interaction.trigger) !== JSON.stringify(expectedExpandedDialogTranscript("trigger"))
      || JSON.stringify(interaction.skyline) !== JSON.stringify(expectedExpandedDialogTranscript("skyline"))) {
      throw new Error(`NW-223 interaction transcript differs for ${capture}.`);
    }
    assertAxePartition(capture, "trigger", ledger.axe[capture].trigger);
    assertAxePartition(capture, "skyline", ledger.axe[capture].skyline);
  }
  return ledger;
}

function assertExactKeys(label: string, record: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(record).sort();
  const exact = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(exact)) throw new Error(`NW-223 ${label} keys differ.`);
}

function assertMeasurement(capture: string, measurement: PresenterExtensionMeasurement) {
  if (!measurement) throw new Error(`Missing NW-223 measurement for ${capture}.`);
  assertObjectKeys("measurement", measurement, [
    "anchorAccessibilitySha256", "anchorAccessibleName", "anchorComputedStyleSha256", "anchorRect",
    "skylineAccessibilitySha256", "skylineComputedStyleSha256", "skylineRelativeRect",
    "triggerAccessibilitySha256", "triggerComputedStyleSha256", "triggerRelativeRect",
  ]);
  for (const rect of [measurement.triggerRelativeRect, measurement.skylineRelativeRect, measurement.anchorRect]) {
    assertObjectKeys("measurement rect", rect, ["height", "width", "x", "y"]);
    if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) {
      throw new Error(`Invalid NW-223 measurement rect for ${capture}.`);
    }
  }
  if (JSON.stringify(measurement.triggerRelativeRect) !== JSON.stringify(measurement.skylineRelativeRect)) {
    throw new Error(`NW-223 relative rect differs for ${capture}.`);
  }
  for (const value of [
    measurement.triggerComputedStyleSha256,
    measurement.skylineComputedStyleSha256,
    measurement.triggerAccessibilitySha256,
    measurement.skylineAccessibilitySha256,
    measurement.anchorComputedStyleSha256,
    measurement.anchorAccessibilitySha256,
  ]) if (!hash.test(value)) throw new Error(`Invalid NW-223 measurement hash for ${capture}.`);
  if (measurement.anchorAccessibleName.length === 0) throw new Error(`Invalid NW-223 measurement accessible name for ${capture}.`);
}

function assertAxePartition(capture: string, application: "trigger" | "skyline", partition: PartitionedAxeLedger) {
  if (!partition || !Array.isArray(partition.outside) || !Array.isArray(partition.inside)) throw new Error(`Invalid NW-223 Axe partition for ${application} ${capture}.`);
  assertObjectKeys("Axe partition", partition, ["inside", "outside"]);
  for (const scope of ["outside", "inside"] as const) {
    const signatures = new Set<string>();
    for (const rule of partition[scope]) {
      assertObjectKeys("Axe rule", rule, ["id", "impact", "tags", "targets"]);
      if (typeof rule.id !== "string" || rule.id.length === 0 || rule.id === "*") throw new Error(`Invalid NW-223 Axe rule for ${application} ${capture}.`);
      if (rule.impact !== null && (typeof rule.impact !== "string" || rule.impact.length === 0)) throw new Error(`Invalid NW-223 Axe impact for ${application} ${capture}.`);
      if (!Array.isArray(rule.tags) || rule.tags.some((tag) => typeof tag !== "string" || tag.length === 0) || new Set(rule.tags).size !== rule.tags.length) {
        throw new Error(`Invalid NW-223 Axe tags for ${application} ${capture}.`);
      }
      if (!Array.isArray(rule.targets) || rule.targets.some((target) => typeof target !== "string") || new Set(rule.targets).size !== rule.targets.length) {
        throw new Error(`Invalid NW-223 Axe targets for ${application} ${capture}.`);
      }
      const signature = JSON.stringify({ id: rule.id, impact: rule.impact, tags: [...rule.tags].sort() });
      if (signatures.has(signature)) throw new Error(`Duplicate NW-223 Axe rule signature for ${application} ${capture}.`);
      signatures.add(signature);
      for (const target of rule.targets) {
        const path = JSON.parse(target) as unknown;
        if (!Array.isArray(path) || path.length === 0 || path.some((segment) => typeof segment !== "string" || segment.length === 0 || segment === "*" || !validSelector(segment))) {
          throw new Error(`Invalid NW-223 Axe target for ${application} ${capture}.`);
        }
      }
    }
  }
}

function assertObjectKeys(label: string, value: object, expected: readonly string[]) {
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) throw new Error(`NW-223 ${label} keys differ.`);
}

function validSelector(selector: string) {
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
}
