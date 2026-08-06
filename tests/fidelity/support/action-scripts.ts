import type { Page } from "@playwright/test";
import { normalizeActionTranscript, observeAction, type ActionObservation } from "./actions";

type Target = { role?: string; name?: string; label?: string; selector?: string };
type Step = { action: "click" | "fill" | "select" | "press" | "history" | "reload" | "fixture"; target?: Target; value?: string; key?: string; direction?: "back" | "forward"; state?: string };
export type ActionScript = { id: string; start: string; steps: Step[] };
type ActionFile = { schemaVersion: number; scripts: ActionScript[] };

const required = ["navigation-history", "dialogs-menus", "filters-pagination", "selection-inspector-timeline-copy", "preferences", "live-error-recovery", "keyboard-focus-shortcuts"];
const actions = new Set(["click", "fill", "select", "press", "history", "reload", "fixture"]);

export function validateActionScripts(value: ActionFile) {
  if (value.schemaVersion !== 1 || !Array.isArray(value.scripts)) throw new Error("Invalid action-script contract.");
  const ids = value.scripts.map(({ id }) => id);
  if (JSON.stringify(ids) !== JSON.stringify(required)) throw new Error("Action-script coverage drifted.");
  for (const script of value.scripts) {
    if (!script.start || script.steps.length === 0) throw new Error(`Action script ${script.id} is empty.`);
    for (const step of script.steps) if (!actions.has(step.action)) throw new Error(`Action script ${script.id} has an unknown action.`);
  }
  return ids;
}

export async function runActionScript(page: Page, script: ActionScript, options: { basePath: string; fixtureState(state: string): Promise<void> }) {
  const transcript: ActionObservation[] = [await observeAction(page, "initial")];
  for (const [index, step] of script.steps.entries()) {
    await perform(page, step, options.fixtureState);
    transcript.push(await observeAction(page, `${index + 1}:${step.action}`));
  }
  return normalizeActionTranscript(transcript, options.basePath);
}

function locator(page: Page, target?: Target) {
  if (!target) throw new Error("Semantic action target missing.");
  if (target.role && target.name) return page.getByRole(target.role as never, { name: target.name, exact: true });
  if (target.label) return page.getByLabel(target.label, { exact: true });
  if (target.selector) return page.locator(target.selector).first();
  throw new Error("Semantic action target invalid.");
}

async function perform(page: Page, step: Step, fixtureState: (state: string) => Promise<void>) {
  if (step.action === "click") return locator(page, step.target).click();
  if (step.action === "fill") return locator(page, step.target).fill(step.value ?? "");
  if (step.action === "select") return locator(page, step.target).selectOption(step.value ?? "");
  if (step.action === "press") return page.keyboard.press(step.key ?? "");
  if (step.action === "history") return step.direction === "back" ? page.goBack() : page.goForward();
  if (step.action === "reload") return page.reload();
  if (step.action === "fixture") return fixtureState(step.state ?? "");
}
