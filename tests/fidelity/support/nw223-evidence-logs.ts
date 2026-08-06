import { createHash } from "node:crypto";
import type { PairedPresenterAxeLedger } from "./axe";
import type { PresenterExtensionMeasurement } from "./difference-regions";
import { expectedNw223AxeCaptureIds, expectedNw223CaptureIds, type Nw223EvidenceLedger } from "./nw223-ledger";

const measurementPrefix = "NW223_PRESENTER_MEASUREMENT=";
const axePrefix = "NW223_AXE_PREFLIGHT=";
const interactionPrefix = "NW223_ESCAPE_PREFLIGHT=";
type EvidenceLog = { name: string; content: string };

export const expectedNw223LogSha256: Record<string, string> = {
  "01-parameterized.log": "71a32c92fd433625dcb3378e8a77774a76bf2f7660ee6dc3d5740107fab49d3e",
  "02-applied-missing.log": "5feded3b5088e2959b902f2868cb9418b9b7a7e4c4ef169e768a26fcf5db69d4",
  "03-result-source.log": "3f42f98cb0000d2dbaa07eb9ce0818a10b70de2a377304d1b3397f022fc83dbd",
  "04-long-failed.log": "9862181bf0565affff704e5403a765229c137b4f27ba95b3394bda8bfcecf8e1",
  "05-limited-transaction.log": "5db93c5f4c5a7d1bb3d631847f5a0722b4581be41a405a3bbbd3e9938ddfda68",
  "06-transaction-cache.log": "db6e440ff84121f20a4302a304ac2124939808b3da9d537ef3c089c529dd87a9",
  "07-cache-failure-long.log": "ad78230a03306452409271714a0791d16816bec7139ca1a124d75f86040bff95",
  "08-cache-unavailable-redis.log": "fb2dbad958a92c5ca5050466ad0fbd770edb36225f51eb98a1d1f7c3e52f9f04",
  "09-redis-failure-long.log": "67502bfcbe528a4db50d46a6116de839494bf39286ea1615ed215bea94e28039",
  "10-redis-unavailable.log": "84d72bcb4df04382ee48b802034e1001486ba374aad485c45c04acef22860c3d",
};

export function parseNw223EvidenceLogs(logs: readonly EvidenceLog[]): Nw223EvidenceLedger {
  const ledger: Nw223EvidenceLedger = { measurements: {}, interactions: {}, axe: {} };
  const lines = [...logs].sort((left, right) => left.name.localeCompare(right.name)).flatMap(({ content }) => content.split(/\r?\n/));
  for (const line of lines) {
    if (line.startsWith(measurementPrefix)) {
      const payload = JSON.parse(line.slice(measurementPrefix.length)) as Record<string, PresenterExtensionMeasurement>;
      const entries = Object.entries(payload);
      if (entries.length !== 1) throw new Error("NW-223 measurement marker must own exactly one capture.");
      setUnique(ledger.measurements, entries[0][0], entries[0][1]);
      continue;
    }
    if (line.startsWith(axePrefix)) {
      const payload = JSON.parse(line.slice(axePrefix.length)) as { capture: string; differences: unknown[]; axeLedger: PairedPresenterAxeLedger };
      assertKeys("Axe marker", payload, ["axeLedger", "capture", "differences"]);
      if (!Array.isArray(payload.differences) || payload.differences.length !== 0) throw new Error(`NW-223 Axe differences found for ${payload.capture}.`);
      setUnique(ledger.axe, payload.capture, payload.axeLedger);
      continue;
    }
    if (line.startsWith(interactionPrefix)) {
      const payload = JSON.parse(line.slice(interactionPrefix.length)) as { capture: string; trigger: Nw223EvidenceLedger["interactions"][string]["trigger"]; skyline: Nw223EvidenceLedger["interactions"][string]["skyline"] };
      assertKeys("interaction marker", payload, ["capture", "skyline", "trigger"]);
      setUnique(ledger.interactions, payload.capture, { trigger: payload.trigger, skyline: payload.skyline });
    }
  }
  return {
    measurements: orderRecord(ledger.measurements, expectedNw223CaptureIds),
    interactions: orderRecord(ledger.interactions, expectedNw223AxeCaptureIds),
    axe: orderRecord(ledger.axe, expectedNw223AxeCaptureIds),
  };
}

export function validateNw223EvidenceLogProvenance(logs: readonly EvidenceLog[]) {
  assertKeys("log provenance", Object.fromEntries(logs.map(({ name }) => [name, true])), Object.keys(expectedNw223LogSha256));
  for (const { name, content } of logs) {
    const actual = createHash("sha256").update(content).digest("hex");
    if (actual !== expectedNw223LogSha256[name]) throw new Error(`NW-223 log provenance differs for ${name}.`);
  }
}

function setUnique<T>(record: Record<string, T>, capture: string, value: T) {
  if (typeof capture !== "string" || capture.length === 0) throw new Error("NW-223 evidence marker lacks capture identity.");
  if (Object.hasOwn(record, capture)) throw new Error(`Duplicate NW-223 evidence capture: ${capture}.`);
  record[capture] = value;
}

function orderRecord<T>(record: Record<string, T>, expected: readonly string[]) {
  const known = expected.filter((capture) => Object.hasOwn(record, capture));
  const unknown = Object.keys(record).filter((capture) => !expected.includes(capture)).sort();
  return Object.fromEntries([...known, ...unknown].map((capture) => [capture, record[capture]]));
}

function assertKeys(label: string, value: object, expected: readonly string[]) {
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) throw new Error(`NW-223 ${label} keys differ.`);
}
