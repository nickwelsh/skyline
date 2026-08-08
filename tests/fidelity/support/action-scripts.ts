import { expect, type Page } from "@playwright/test";
import { normalizeActionTranscript, observeAction, type ActionObservation } from "./actions";

type Target = { role?: string; name?: string; exactText?: string; label?: string; selector?: string };
type Effect = {
  selected: { target: Target; value: string; nativeName: string; customText: string };
  visible: Target[];
  hidden: Target[];
  focus: string;
};
type Proof = {
  selection?: string;
  tab?: string;
  visible?: Target[];
  checked?: { target: Target; value: boolean };
  clipboard?: string;
  focus?: { target?: Target; withinRole?: string; name: string };
  timeRange?: boolean;
  timePeriod?: "2h";
};
type Step = { action: "click" | "activate" | "fill" | "select" | "choose" | "press" | "history" | "reload" | "fixture" | "wait"; target?: Target; option?: { name: string; nativeName?: string; value: string }; effect?: Effect; proof?: Proof; value?: string; key?: string; direction?: "back" | "forward"; state?: string };
export type ActionScript = { id: string; start: string; comparePanelPersistence?: boolean; steps: Step[] };
type ActionFile = { schemaVersion: number; scripts: ActionScript[] };

const required = ["navigation-history", "dialogs-menus", "filters-pagination", "selection-inspector-timeline-copy", "preferences", "live-error-recovery", "keyboard-focus-shortcuts"];
const actions = new Set(["click", "activate", "fill", "select", "choose", "press", "history", "reload", "fixture", "wait"]);

export function validateActionScripts(value: ActionFile) {
  if (value.schemaVersion !== 1 || !Array.isArray(value.scripts)) throw new Error("Invalid action-script contract.");
  const ids = value.scripts.map(({ id }) => id);
  if (JSON.stringify(ids) !== JSON.stringify(required)) throw new Error("Action-script coverage drifted.");
  for (const script of value.scripts) {
    if (!script.start || script.steps.length === 0) throw new Error(`Action script ${script.id} is empty.`);
    if (script.comparePanelPersistence === false && script.id !== "selection-inspector-timeline-copy") {
      throw new Error("Panel persistence exclusion is limited to inspector selection.");
    }
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
  const initial = await observeAction(page, "initial");
  if (script.comparePanelPersistence === false) initial.storage = withoutPanelPersistence(initial.storage);
  const transcript: ActionObservation[] = [initial];
  let effect: Effect | undefined;
  for (const [index, step] of script.steps.entries()) {
    await perform(page, step, options.fixtureState);
    const proof = step.proof ? await assertProof(page, step.proof) : undefined;
    effect = step.effect ?? effect;
    const observation = await observeAction(page, `${index + 1}:${step.action}`);
    if (script.comparePanelPersistence === false) observation.storage = withoutPanelPersistence(observation.storage);
    if (effect) {
      observation.visible = await assertEffect(page, effect, step.effect !== undefined);
      observation.activeElement = { tag: "SEMANTIC", role: "combobox", name: effect.focus };
    }
    if (proof) {
      observation.visible = proof.visible;
      if (proof.focus) observation.activeElement = { tag: "SEMANTIC", role: proof.focus.role, name: proof.focus.name };
      observation.clipboard = proof.clipboard;
    }
    transcript.push(observation);
  }
  const normalized = normalizeActionTranscript(transcript, options.basePath);
  return options.canonicalizeUrl
    ? normalized.map((observation) => ({ ...observation, url: options.canonicalizeUrl!(observation.url) }))
    : normalized;
}

function withoutPanelPersistence(storage: Record<string, string>) {
  return Object.fromEntries(Object.entries(storage).flatMap(([key, value]) => {
    if (key === "panel-run-parent-v3" || key === "panel-run-tree") return [];
    if (!key.startsWith("skyline.ui-preferences.v1:")) return [[key, value]];
    const preferences = JSON.parse(value);
    delete preferences.panels;
    return [[key, JSON.stringify(preferences)]];
  }));
}

async function assertProof(page: Page, proof: Proof) {
  const visible: string[] = [];
  if (proof.selection) {
    await expect.poll(() => semanticSelection(page.url())).toBe(proof.selection);
    visible.push(`selection:${proof.selection}`);
  }
  if (proof.tab) {
    await expect.poll(() => new URL(page.url()).searchParams.get("tab")).toBe(proof.tab);
    visible.push(`tab:${proof.tab}`);
  }
  for (const target of proof.visible ?? []) {
    await expect(locator(page, target)).toBeVisible();
    visible.push(`visible:${target.role}:${target.name}`);
  }
  if (proof.checked) {
    const control = locator(page, proof.checked.target);
    await expect(control).toBeChecked({ checked: proof.checked.value });
    visible.push(`checked:${proof.checked.target.role}:${proof.checked.target.name}=${proof.checked.value}`);
  }
  if (proof.clipboard !== undefined) {
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(proof.clipboard);
    visible.push("clipboard:exact");
  }
  if (proof.focus) {
    if (proof.focus.target) {
      await expect(locator(page, proof.focus.target)).toBeFocused();
    } else if (proof.focus.withinRole) {
      await expect.poll(() => page.evaluate((role) => {
        const active = document.activeElement;
        return active instanceof Element && (active.getAttribute("role") === role || active.closest(`[role=${JSON.stringify(role)}]`) !== null);
      }, proof.focus!.withinRole!)).toBe(true);
    } else {
      throw new Error("Semantic focus proof target missing.");
    }
  }
  if (proof.timeRange) {
    const params = new URL(page.url()).searchParams;
    const from = params.get("from") ?? params.get("triggeredFrom");
    const to = params.get("to") ?? params.get("triggeredTo");
    expect(from).toBeTruthy();
    expect(to).toBeTruthy();
    const label = page.locator("[role='combobox']").filter({ hasText: /^Created:/ });
    await expect(label).toHaveCount(1);
    await expect(label).toContainText("–");
    visible.push("time-range:committed");
  }
  if (proof.timePeriod) {
    await expect.poll(() => {
      const params = new URL(page.url()).searchParams;
      if (params.get("period") === proof.timePeriod) return proof.timePeriod;
      const from = params.get("from") ?? params.get("triggeredFrom");
      const to = params.get("to") ?? params.get("triggeredTo");
      return from && to && Date.parse(to) - Date.parse(from) === 2 * 60 * 60 * 1_000 ? "2h" : null;
    }).toBe(proof.timePeriod);
    const label = page.locator("[role='combobox']").filter({ hasText: "Created:2 hours" });
    await expect(label).toHaveCount(1);
    visible.push("time-period:2h");
  }
  return {
    visible,
    focus: proof.focus ? { role: proof.focus.target?.role ?? proof.focus.withinRole ?? null, name: proof.focus.name } : undefined,
    clipboard: proof.clipboard ?? null,
  };
}

function semanticSelection(url: string) {
  const params = new URL(url).searchParams;
  const selection = params.get("span") ?? params.get("node");
  return selection?.startsWith("span_run_") ? `run_${selection.slice("span_".length)}` : selection;
}

export function canonicalSourceRunFilterUrl(url: string) {
  const parsed = new URL(url, "https://fidelity.invalid");
  const sourceFrom = parsed.searchParams.get("from");
  const sourceTo = parsed.searchParams.get("to");
  if (sourceFrom) {
    parsed.searchParams.delete("from");
    parsed.searchParams.set("triggeredFrom", new Date(Number(sourceFrom)).toISOString());
  }
  if (sourceTo) {
    parsed.searchParams.delete("to");
    parsed.searchParams.set("triggeredTo", new Date(Number(sourceTo)).toISOString());
  }
  const triggeredFrom = parsed.searchParams.get("triggeredFrom");
  const triggeredTo = parsed.searchParams.get("triggeredTo");
  if (triggeredFrom && triggeredTo && Date.parse(triggeredTo) - Date.parse(triggeredFrom) === 2 * 60 * 60 * 1_000) {
    parsed.searchParams.delete("triggeredFrom");
    parsed.searchParams.delete("triggeredTo");
    parsed.searchParams.set("period", "2h");
  }
  const statuses = parsed.searchParams.getAll("statuses");
  if (statuses.length === 0) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  if (statuses.length !== 1 || statuses[0] !== "COMPLETED_WITH_ERRORS") {
    throw new Error(`Unmapped source status query: ${statuses.join(",")}`);
  }
  parsed.searchParams.delete("statuses");
  parsed.searchParams.set("status", "failed");
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function canonicalRunInspectorActionUrl(url: string) {
  const parsed = new URL(url, "https://fidelity.invalid");
  if (parsed.searchParams.get("queue") !== "true") return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  const tab = parsed.searchParams.get("tab");
  if (tab !== "detail") throw new Error(`Unmapped inspector queue tab: ${tab ?? "missing"}`);
  parsed.searchParams.delete("queue");
  parsed.searchParams.delete("tab");
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
  if (step.action === "activate") {
    const control = locator(page, step.target);
    await expect(control).toHaveCount(1);
    await expect(control).toBeVisible();
    await expect(control).toBeEnabled();
    await control.focus();
    await expect(control).toBeFocused();
    expect(await control.evaluate((element) => ({
      active: document.activeElement === element,
      name: element.getAttribute("aria-label") ?? element.textContent?.trim(),
      role: element.getAttribute("role") ?? element.tagName.toLowerCase(),
    }))).toEqual({ active: true, name: step.target!.name, role: step.target!.role });
    return page.keyboard.press("Enter");
  }
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
  if (step.action === "wait") {
    const control = locator(page, step.target);
    if (step.state === "hidden") return expect(control).toBeHidden();
    if (step.state === "visible") {
      await expect(control).toHaveCount(1);
      await expect(control).toBeVisible();
      return expect(control).toBeEnabled();
    }
    throw new Error("Semantic wait state invalid.");
  }
}

async function assertEffect(page: Page, effect: Effect, assertFocus: boolean) {
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
  if (assertFocus) {
    await selected.focus();
    expect(await selected.evaluate((element) => document.activeElement === element)).toBe(true);
  }
  return [
    `selected:${effect.focus}`,
    ...effect.visible.map((target) => `visible:${target.role}:${target.name}`),
    ...effect.hidden.map((target) => `hidden:${target.role}:${target.name}`),
  ];
}
