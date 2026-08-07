import { expect, type Page } from "@playwright/test";
import { normalizeActionTranscript, observeAction, type ActionObservation } from "./actions";

type Target = { role?: string; name?: string; exactText?: string; label?: string; selector?: string };
type Effect = {
  selected: { target: Target; value: string; nativeName: string; customText: string };
  visible: Target[];
  hidden: Target[];
  focus: string;
};
type Step = { action: "click" | "fill" | "select" | "choose" | "press" | "history" | "reload" | "fixture"; target?: Target; option?: { name: string; nativeName?: string; value: string }; effect?: Effect; value?: string; key?: string; direction?: "back" | "forward"; state?: string };
export type ActionScript = { id: string; start: string; steps: Step[] };
type ActionFile = { schemaVersion: number; scripts: ActionScript[] };

const required = ["navigation-history", "dialogs-menus", "filters-pagination", "selection-inspector-timeline-copy", "preferences", "live-error-recovery", "keyboard-focus-shortcuts"];
const actions = new Set(["click", "fill", "select", "choose", "press", "history", "reload", "fixture"]);

export function validateActionScripts(value: ActionFile) {
  if (value.schemaVersion !== 1 || !Array.isArray(value.scripts)) throw new Error("Invalid action-script contract.");
  const ids = value.scripts.map(({ id }) => id);
  if (JSON.stringify(ids) !== JSON.stringify(required)) throw new Error("Action-script coverage drifted.");
  for (const script of value.scripts) {
    if (!script.start || script.steps.length === 0) throw new Error(`Action script ${script.id} is empty.`);
    for (const step of script.steps) {
      if (!actions.has(step.action)) throw new Error(`Action script ${script.id} has an unknown action.`);
      if (step.target?.exactText !== undefined && step.target.exactText.trim() !== step.target.exactText) {
        throw new Error("Semantic fallback text must be exact.");
      }
      if (step.action === "choose" && (!step.option?.name || !step.option.nativeName || !step.option.value)) {
        throw new Error("Semantic choice requires exact custom and native option names.");
      }
    }
  }
  return ids;
}

export async function runActionScript(page: Page, script: ActionScript, options: { basePath: string; fixtureState(state: string): Promise<void>; canonicalizeUrl?(url: string): string }) {
  const transcript: ActionObservation[] = [await observeAction(page, "initial")];
  let effect: Effect | undefined;
  for (const [index, step] of script.steps.entries()) {
    await perform(page, step, options.fixtureState);
    effect = step.effect ?? effect;
    const observation = await observeAction(page, `${index + 1}:${step.action}`);
    if (effect) {
      observation.visible = await assertEffect(page, effect);
      observation.activeElement = { tag: "SEMANTIC", role: "combobox", name: effect.focus };
    }
    transcript.push(observation);
  }
  const normalized = normalizeActionTranscript(transcript, options.basePath);
  return options.canonicalizeUrl
    ? normalized.map((observation) => ({ ...observation, url: options.canonicalizeUrl!(observation.url) }))
    : normalized;
}

export function canonicalSourceRunFilterUrl(url: string) {
  const parsed = new URL(url, "https://fidelity.invalid");
  const statuses = parsed.searchParams.getAll("statuses");
  if (statuses.length === 0) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  if (statuses.length !== 1 || statuses[0] !== "COMPLETED_WITH_ERRORS") {
    throw new Error(`Unmapped source status query: ${statuses.join(",")}`);
  }
  parsed.searchParams.delete("statuses");
  parsed.searchParams.set("status", "failed");
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function locator(page: Page, target?: Target) {
  if (!target) throw new Error("Semantic action target missing.");
  if (target.role && target.name) {
    const named = page.getByRole(target.role as never, { name: target.name, exact: true });
    if (target.exactText) {
      const escaped = target.exactText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return named.or(page.getByRole(target.role as never).filter({ hasText: new RegExp(`^${escaped}$`) }));
    }
    return named;
  }
  if (target.label) return page.getByLabel(target.label, { exact: true });
  if (target.selector) return page.locator(target.selector).first();
  throw new Error("Semantic action target invalid.");
}

async function perform(page: Page, step: Step, fixtureState: (state: string) => Promise<void>) {
  if (step.action === "click") return locator(page, step.target).click();
  if (step.action === "fill") return locator(page, step.target).fill(step.value ?? "");
  if (step.action === "select") return locator(page, step.target).selectOption(step.value ?? "");
  if (step.action === "choose") {
    if (!step.option) throw new Error("Semantic choice option missing.");
    const control = locator(page, step.target);
    if ((await control.evaluate((element) => element.tagName)) === "SELECT") {
      await control.selectOption(step.option.value);
      await expect(control.locator("option:checked")).toHaveText(step.option.nativeName!);
    } else {
      await control.click();
      await page.getByRole("option", { name: step.option.name, exact: true }).click();
      await page.keyboard.press("Escape");
    }
    return;
  }
  if (step.action === "press") return page.keyboard.press(step.key ?? "");
  if (step.action === "history") return step.direction === "back" ? page.goBack() : page.goForward();
  if (step.action === "reload") return page.reload();
  if (step.action === "fixture") return fixtureState(step.state ?? "");
}

async function assertEffect(page: Page, effect: Effect) {
  const selected = locator(page, effect.selected.target);
  await expect(selected).toBeVisible();
  if ((await selected.evaluate((element) => element.tagName)) === "SELECT") {
    await expect(selected).toHaveValue(effect.selected.value);
    await expect(selected.locator("option:checked")).toHaveText(effect.selected.nativeName);
  } else {
    await expect(selected).toHaveText(effect.selected.customText);
  }
  for (const target of effect.visible) await expect(locator(page, target)).toBeVisible();
  for (const target of effect.hidden) await expect(locator(page, target)).toHaveCount(0);
  await selected.focus();
  expect(await selected.evaluate((element) => document.activeElement === element)).toBe(true);
  return [
    `selected:${effect.focus}`,
    ...effect.visible.map((target) => `visible:${target.role}:${target.name}`),
    ...effect.hidden.map((target) => `hidden:${target.role}:${target.name}`),
  ];
}
