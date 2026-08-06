import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { expectedNw223LogSha256, parseNw223EvidenceLogs, validateNw223EvidenceLogProvenance } from "./nw223-evidence-logs";
import { validateNw223Ledger } from "./nw223-ledger";

const capture = "runs-inspectors-sql-applied@1440x960-classic";
const measurement = { triggerRelativeRect: { x: 1, y: 2, width: 3, height: 4 } };
const axeLedger = { trigger: { outside: [], inside: [] }, skyline: { outside: [], inside: [] } };
const transcript = { dialogCountBefore: 0 };
const markers = [
  `NW223_PRESENTER_MEASUREMENT=${JSON.stringify({ [capture]: measurement })}`,
  `NW223_AXE_PREFLIGHT=${JSON.stringify({ capture, differences: [], axeLedger })}`,
  `NW223_ESCAPE_PREFLIGHT=${JSON.stringify({ capture, trigger: transcript, skyline: transcript })}`,
].join("\n");

describe("NW-223 persisted evidence logs", () => {
  test("parses exact measurement, Axe, and interaction markers", () => {
    expect(parseNw223EvidenceLogs([{ name: "fixture.log", content: markers }])).toEqual({
      measurements: { [capture]: measurement },
      axe: { [capture]: axeLedger },
      interactions: { [capture]: { trigger: transcript, skyline: transcript } },
    });
  });

  test("fails closed on duplicate captures and Axe differences", () => {
    expect(() => parseNw223EvidenceLogs([{ name: "a.log", content: markers }, { name: "b.log", content: markers }])).toThrow(/duplicate/i);
    expect(() => parseNw223EvidenceLogs([{ name: "fixture.log", content: markers.replace('"differences":[]', '"differences":[{"scope":"inside"}]') }])).toThrow(/differences/i);
  });

  test("normalizes reversed logs and markers to exact capture order", () => {
    const reversed = markers.split("\n").reverse().join("\n");
    expect(JSON.stringify(parseNw223EvidenceLogs([{ name: "b.log", content: reversed }]))).toBe(JSON.stringify(parseNw223EvidenceLogs([{ name: "a.log", content: markers }])));
  });

  test("rejects extra marker payload keys", () => {
    expect(() => parseNw223EvidenceLogs([{ name: "fixture.log", content: markers.replace('"differences":[]', '"differences":[],"extra":true') }])).toThrow(/marker keys/i);
    expect(() => parseNw223EvidenceLogs([{ name: "fixture.log", content: markers.replace(`NW223_ESCAPE_PREFLIGHT={"capture":"${capture}",`, `NW223_ESCAPE_PREFLIGHT={"capture":"${capture}","extra":true,`) }])).toThrow(/marker keys/i);
  });

  test("pins every canonical raw log hash", () => {
    expect(Object.keys(expectedNw223LogSha256)).toHaveLength(6);
    expect(() => validateNw223EvidenceLogProvenance([{ name: "fixture.log", content: markers }])).toThrow(/provenance/i);
  });

  test.runIf(Boolean(process.env.SKYLINE_NW223_EVIDENCE_DIR))("validates canonical persisted logs", () => {
    const directory = process.env.SKYLINE_NW223_EVIDENCE_DIR!;
    const logs = readdirSync(directory).filter((file) => file.endsWith(".log")).sort().map((name) => ({ name, content: readFileSync(join(directory, name), "utf8") }));
    validateNw223EvidenceLogProvenance(logs);
    const ledger = validateNw223Ledger(parseNw223EvidenceLogs(logs));
    expect(Object.keys(ledger.measurements)).toHaveLength(54);
    expect(Object.keys(ledger.axe)).toHaveLength(39);
    expect(Object.keys(ledger.interactions)).toHaveLength(39);
    if (process.env.SKYLINE_NW223_EVIDENCE_OUTPUT) writeFileSync(process.env.SKYLINE_NW223_EVIDENCE_OUTPUT, `${JSON.stringify(ledger, null, 2)}\n`);
  });
});
