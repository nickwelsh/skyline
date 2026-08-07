import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { actionCaptureId, type FidelityMatrix } from "../../scripts/fidelity-oracle.mjs";
import actionFile from "./actions.json" with { type: "json" };
import matrixFile from "./matrix.json" with { type: "json" };
import { canonicalRunInspectorActionUrl, canonicalSourceRunFilterUrl, runActionScript, type ActionScript } from "./support/action-scripts";
import { prepareCapture, settleCapture } from "./support/capture";
import { installSkylineFixture, parseScenario, scenarioPath } from "./support/skyline";
import { createReferenceFixture, installReferenceFixture } from "./support/reference";
import { seedOwnedState } from "./support/states";
import { assertNoFidelityDifferences, collectFidelityDifferences } from "./support/differences";

const root = resolve(import.meta.dirname, "../..");
const record = process.env.SKYLINE_ORACLE_RECORD === "1";
const referenceFixture = createReferenceFixture();
const matrix = matrixFile as unknown as FidelityMatrix;

test.describe.configure({ mode: "serial" });

for (const script of actionFile.scripts as ActionScript[]) {
  test(`shared actions: ${script.id}`, async ({ page, context }) => {
    test.setTimeout(60_000);
    if (script.id === "selection-inspector-timeline-copy") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const capture = actionCaptureId(matrix, script.start);
    const scenario = parseScenario(capture);
    const reference = await context.newPage();
    await Promise.all([prepareCapture(page, capture, "/skyline"), prepareCapture(reference, capture, "/reference")]);
    await Promise.all([seedOwnedState(page, scenario), seedOwnedState(reference, scenario, "/reference")]);
    await installReferenceFixture(reference, await referenceFixture);
    const fixture = await installSkylineFixture(page, scenario);
    await Promise.all([
      page.goto(scenarioPath(scenario, fixture.catalog)),
      reference.goto(`http://127.0.0.1:4185/oracle/${scenario.id}`),
    ]);
    await reference.locator("html[data-oracle-ready='true']").waitFor();
    await Promise.all([settleCapture(page), settleCapture(reference)]);
    if (script.id === "selection-inspector-timeline-copy") {
      await Promise.all([page.evaluate(() => navigator.clipboard.writeText("")), reference.evaluate(() => navigator.clipboard.writeText(""))]);
    }

    const [trigger, skyline] = await Promise.all([
      runActionScript(reference, script, {
        basePath: "/oracle",
        fixtureState: (state) => reference.evaluate((value) => (window as Window & { __oracleSetFixtureState?: (state: string) => void }).__oracleSetFixtureState?.(value), state),
        canonicalizeUrl: canonicalizeActionUrl(script.id),
      }),
      runActionScript(page, script, {
        basePath: "/skyline",
        fixtureState: async (state) => fixture.setState(state),
        canonicalizeUrl: canonicalizeActionUrl(script.id),
      }),
    ]);
    assertNoFidelityDifferences(collectFidelityDifferences({ triggerInteractions: trigger, skylineInteractions: skyline }));
    proof(resolve(root, "tests/fidelity/oracle/actions", `${script.id}.json`), `${JSON.stringify({ trigger, skyline }, null, 2)}\n`);
    await reference.close();
  });
}

function canonicalizeActionUrl(scriptId: string) {
  if (scriptId === "filters-pagination") return canonicalSourceRunFilterUrl;
  if (scriptId === "selection-inspector-timeline-copy") return canonicalRunInspectorActionUrl;
  return undefined;
}

function proof(path: string, contents: string) {
  if (record) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
    return;
  }
  expect(Buffer.from(contents).equals(readFileSync(path)), `Stale action artifact: ${path}`).toBe(true);
}
