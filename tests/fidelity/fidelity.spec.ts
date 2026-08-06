import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { expectedCaptureIds, type FidelityMatrix } from "../../scripts/fidelity-oracle.mjs";
import matrix from "./matrix.json" with { type: "json" };
import { captureAccessibilityTree } from "./support/accessibility";
import { observeAction } from "./support/actions";
import { captureAxe } from "./support/axe";
import { applyLiveSystemChange, assertFixedCanvas, prepareCapture, settleCapture } from "./support/capture";
import { comparePixels } from "./support/pixels";
import { createReferenceFixture, installReferenceFixture } from "./support/reference";
import { installSkylineFixture, parseScenario, scenarioPath } from "./support/skyline";
import { exposeOwnedState, seedOwnedState } from "./support/states";

const root = resolve(import.meta.dirname, "../..");
const captures = expectedCaptureIds(matrix as unknown as FidelityMatrix);
const record = process.env.SKYLINE_ORACLE_RECORD === "1";
const referenceFixture = createReferenceFixture();

test.describe.configure({ mode: "serial" });

for (const capture of captures) {
  test(capture, async ({ page, context }) => {
    test.setTimeout(60_000);
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
    if (scenario.state === "stale-refresh") {
      fixture.setState("loading");
      await page.evaluate(() => {
        const url = new URL(location.href);
        url.searchParams.set("oracleRefresh", "1");
        history.pushState(null, "", url);
        dispatchEvent(new PopStateEvent("popstate"));
      });
      await page.clock.runFor(10);
    }
    await Promise.all([exposeOwnedState(page, scenario), exposeOwnedState(reference, scenario)]);
    await Promise.all([applyLiveSystemChange(page, capture), applyLiveSystemChange(reference, capture)]);
    await Promise.all([settleCapture(page), settleCapture(reference)]);
    await Promise.all([assertFixedCanvas(page, capture), assertFixedCanvas(reference, capture)]);

    const [triggerPng, skylinePng, triggerTree, skylineTree, triggerAxe, skylineAxe, triggerInteraction, skylineInteraction] = await Promise.all([
      reference.screenshot({ animations: "disabled", caret: "hide" }),
      page.screenshot({ animations: "disabled", caret: "hide" }),
      captureAccessibilityTree(reference),
      captureAccessibilityTree(page),
      captureAxe(reference),
      captureAxe(page),
      observeAction(reference, "captured"),
      observeAction(page, "captured"),
    ]);
    expect.soft(skylineTree, "Accessibility tree drifted from Trigger.").toEqual(triggerTree);
    expect.soft(additionalAxeViolations(triggerAxe, skylineAxe), "Skyline added Axe violations.").toEqual([]);
    const comparison = comparePixels(triggerPng, skylinePng, []);

    const directory = resolve(root, "tests/fidelity/oracle/artifacts", capture);
    proof(`${directory}/trigger.png`, triggerPng);
    proof(`${directory}/skyline.png`, skylinePng);
    proof(`${directory}/comparison.json`, json(comparison));
    proof(`${directory}/accessibility.json`, json({ trigger: triggerTree, skyline: skylineTree, axe: { trigger: triggerAxe, skyline: skylineAxe } }));
    proof(`${directory}/interactions.json`, json({ trigger: triggerInteraction, skyline: skylineInteraction }));
    if (capture.includes("-system-")) {
      const explicit = capture.replace(/-system-(light|dark)$/, "-$1");
      expect(triggerPng.equals(readFileSync(resolve(root, "tests/fidelity/oracle/artifacts", explicit, "trigger.png"))), "System Trigger output must equal its explicit theme.").toBe(true);
      expect(skylinePng.equals(readFileSync(resolve(root, "tests/fidelity/oracle/artifacts", explicit, "skyline.png"))), "System Skyline output must equal its explicit theme.").toBe(true);
    }
    await reference.close();
  });
}

function additionalAxeViolations(trigger: Awaited<ReturnType<typeof captureAxe>>, skyline: Awaited<ReturnType<typeof captureAxe>>) {
  const upstream = new Set(trigger.map((violation) => JSON.stringify(violation)));
  return skyline.filter((violation) => !upstream.has(JSON.stringify(violation)));
}

function proof(path: string, value: Buffer | string) {
  const contents = typeof value === "string" ? Buffer.from(value) : value;
  if (record) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
    return;
  }
  expect(contents.equals(readFileSync(path)), `Stale oracle artifact: ${path}`).toBe(true);
}

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
