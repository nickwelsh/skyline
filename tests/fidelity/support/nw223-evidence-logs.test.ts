import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseNw223EvidenceLogs } from "./nw223-evidence-logs";
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
    expect(parseNw223EvidenceLogs([markers])).toEqual({
      measurements: { [capture]: measurement },
      axe: { [capture]: axeLedger },
      interactions: { [capture]: { trigger: transcript, skyline: transcript } },
    });
  });

  test("fails closed on duplicate captures and Axe differences", () => {
    expect(() => parseNw223EvidenceLogs([markers, markers])).toThrow(/duplicate/i);
    expect(() => parseNw223EvidenceLogs([markers.replace('"differences":[]', '"differences":[{"scope":"inside"}]')])).toThrow(/differences/i);
  });

  test.runIf(Boolean(process.env.SKYLINE_NW223_EVIDENCE_DIR))("validates canonical persisted logs", () => {
    const directory = process.env.SKYLINE_NW223_EVIDENCE_DIR!;
    const contents = readdirSync(directory).filter((file) => file.endsWith(".log")).sort().map((file) => readFileSync(join(directory, file), "utf8"));
    const ledger = validateNw223Ledger(parseNw223EvidenceLogs(contents));
    expect(Object.keys(ledger.measurements)).toHaveLength(54);
    expect(Object.keys(ledger.axe)).toHaveLength(39);
    expect(Object.keys(ledger.interactions)).toHaveLength(39);
    if (process.env.SKYLINE_NW223_EVIDENCE_OUTPUT) writeFileSync(process.env.SKYLINE_NW223_EVIDENCE_OUTPUT, `${JSON.stringify(ledger, null, 2)}\n`);
  });
});
