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
  for (const rect of [measurement.triggerRelativeRect, measurement.skylineRelativeRect, measurement.anchorRect]) {
    if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) {
      throw new Error(`Invalid NW-223 measurement rect for ${capture}.`);
    }
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
  for (const rule of [...partition.outside, ...partition.inside]) {
    if (!rule.id || !Array.isArray(rule.tags) || !Array.isArray(rule.targets)) throw new Error(`Invalid NW-223 Axe rule for ${application} ${capture}.`);
    for (const target of rule.targets) {
      const path = JSON.parse(target) as unknown;
      if (!Array.isArray(path) || path.length === 0 || path.some((segment) => typeof segment !== "string" || segment.length === 0)) {
        throw new Error(`Invalid NW-223 Axe target for ${application} ${capture}.`);
      }
    }
  }
}
