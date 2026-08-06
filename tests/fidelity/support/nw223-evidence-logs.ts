import type { PairedPresenterAxeLedger } from "./axe";
import type { PresenterExtensionMeasurement } from "./difference-regions";
import type { Nw223EvidenceLedger } from "./nw223-ledger";

const measurementPrefix = "NW223_PRESENTER_MEASUREMENT=";
const axePrefix = "NW223_AXE_PREFLIGHT=";
const interactionPrefix = "NW223_ESCAPE_PREFLIGHT=";

export function parseNw223EvidenceLogs(contents: readonly string[]): Nw223EvidenceLedger {
  const ledger: Nw223EvidenceLedger = { measurements: {}, interactions: {}, axe: {} };
  for (const line of contents.flatMap((content) => content.split(/\r?\n/))) {
    if (line.startsWith(measurementPrefix)) {
      const payload = JSON.parse(line.slice(measurementPrefix.length)) as Record<string, PresenterExtensionMeasurement>;
      const entries = Object.entries(payload);
      if (entries.length !== 1) throw new Error("NW-223 measurement marker must own exactly one capture.");
      setUnique(ledger.measurements, entries[0][0], entries[0][1]);
      continue;
    }
    if (line.startsWith(axePrefix)) {
      const payload = JSON.parse(line.slice(axePrefix.length)) as { capture: string; differences: unknown[]; axeLedger: PairedPresenterAxeLedger };
      if (!Array.isArray(payload.differences) || payload.differences.length !== 0) throw new Error(`NW-223 Axe differences found for ${payload.capture}.`);
      setUnique(ledger.axe, payload.capture, payload.axeLedger);
      continue;
    }
    if (line.startsWith(interactionPrefix)) {
      const payload = JSON.parse(line.slice(interactionPrefix.length)) as { capture: string; trigger: Nw223EvidenceLedger["interactions"][string]["trigger"]; skyline: Nw223EvidenceLedger["interactions"][string]["skyline"] };
      setUnique(ledger.interactions, payload.capture, { trigger: payload.trigger, skyline: payload.skyline });
    }
  }
  return ledger;
}

function setUnique<T>(record: Record<string, T>, capture: string, value: T) {
  if (typeof capture !== "string" || capture.length === 0) throw new Error("NW-223 evidence marker lacks capture identity.");
  if (Object.hasOwn(record, capture)) throw new Error(`Duplicate NW-223 evidence capture: ${capture}.`);
  record[capture] = value;
}
