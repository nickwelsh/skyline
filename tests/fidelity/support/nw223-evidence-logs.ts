import { createHash } from "node:crypto";
import type { PairedPresenterAxeLedger } from "./axe";
import type { PresenterExtensionMeasurement } from "./difference-regions";
import { expectedNw223AxeCaptureIds, expectedNw223CaptureIds, type Nw223EvidenceLedger } from "./nw223-ledger";

const measurementPrefix = "NW223_PRESENTER_MEASUREMENT=";
const axePrefix = "NW223_AXE_PREFLIGHT=";
const interactionPrefix = "NW223_ESCAPE_PREFLIGHT=";
type EvidenceLog = { name: string; content: string };

export const expectedNw223LogSha256: Record<string, string> = {
  "01-sql-start.log": "cd4bf1b874e5034ba42de7822454fff93a757ad9a3fb9f89f4bfc93fc41b46cf",
  "02-sql-detail.log": "ed895f23164265283362e4e3edcae2013a78b39d78ef2da04b6a613c19f1764c",
  "03-failure-transaction.log": "61126387c8ad9dc800886cfc12e988e747c85098aa7e2695c3bf7af5819e213d",
  "04-transaction-cache.log": "841a9ca7cda5b61cf85c98c263ae004fd4da03e9c849e0137cc053427d64a538",
  "05-cache-redis.log": "c2a4f039f61885d95657a130aa030df2078a30a66db88aa141e5404a26dc49ce",
  "06-redis-end.log": "06e44fc7918bd86e0f482e809db077fbe10d38429357b23e95d6edad339c648e",
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
