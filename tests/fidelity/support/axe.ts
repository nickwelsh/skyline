import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

export async function captureAxe(page: Page) {
  const [result, radixIds] = await Promise.all([
    new AxeBuilder({ page }).analyze(),
    page.locator("[id^='radix-']").evaluateAll((elements) => elements.map((element) => (element as HTMLElement).id)),
  ]);
  const violations = result.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    tags: [...violation.tags].sort(),
    nodes: violation.nodes.map((node) => ({
      target: normalizeTargetPath(node.target),
      failureSummary: node.failureSummary?.replaceAll(/\s+/g, " ").trim(),
    })).sort((left, right) => JSON.stringify(left.target).localeCompare(JSON.stringify(right.target))),
  })).sort((left, right) => left.id.localeCompare(right.id));
  return normalizeRadixTargets(violations, radixIds);
}

export type AxeEvidence = Array<{
  id: string;
  impact: string | null | undefined;
  tags: string[];
  nodes: Array<{ target: string[]; failureSummary: string | undefined }>;
}>;

export type PartitionedAxeEvidence = { outside: AxeEvidence; inside: AxeEvidence };

export async function capturePartitionedAxe(page: Page, presenterSelector: string): Promise<PartitionedAxeEvidence> {
  const evidence = await captureAxe(page);
  const targets = evidence.flatMap((violation) => violation.nodes.map((node) => node.target));
  const presenterCount = await page.locator(presenterSelector).count();
  if (presenterCount !== 1) throw new Error(`Expected one Axe presenter region for ${presenterSelector}; found ${presenterCount}.`);
  const inside = await page.evaluate(({ selector, targets: targetPaths }) => {
    const presenter = document.querySelector(selector);
    if (!presenter) throw new Error(`Missing Axe presenter region for ${selector}.`);
    return targetPaths.map((path) => {
      let root: Document | ShadowRoot = document;
      let target: Element | null = null;
      for (const [index, segment] of path.entries()) {
        const matches: NodeListOf<Element> = root.querySelectorAll(segment);
        if (matches.length !== 1) throw new Error(`Axe target segment must resolve uniquely: ${JSON.stringify({ path, segment, count: matches.length })}.`);
        const match = matches.item(0);
        if (!match) throw new Error(`Axe target segment missing after unique resolution: ${JSON.stringify({ path, segment })}.`);
        target = match;
        if (index < path.length - 1) {
          if (match instanceof HTMLIFrameElement && match.contentDocument) root = match.contentDocument;
          else if (match.shadowRoot) root = match.shadowRoot;
          else throw new Error(`Axe target traversal root missing: ${JSON.stringify({ path, segment })}.`);
        }
      }
      return presenter.contains(target);
    });
  }, { selector: presenterSelector, targets });
  const insideTargets = new Set(targets.filter((_target, index) => inside[index]).map(targetSignature));
  return partitionAxeEvidence(evidence, insideTargets);
}

export function normalizeRadixTargets(violations: AxeEvidence, domOrderedIds: string[]): AxeEvidence {
  const generatedIds = domOrderedIds.filter((id) => /^radix-:r[a-z0-9]+:$/i.test(id));
  if (new Set(generatedIds).size !== generatedIds.length) throw new Error("Generated Radix ID collision in Axe evidence.");
  const targets = violations.flatMap((violation) => violation.nodes.flatMap((node) => node.target));
  const targetedIds = generatedIds.filter((id) => targets.some((target) => target.includes(escapedIdSelector(id))));
  const replacements = targetedIds.map((id, ordinal) => [escapedIdSelector(id), `#radix-generated-${ordinal}`] as const);

  return violations.map((violation) => ({
    ...violation,
    nodes: violation.nodes.map((node) => ({
      ...node,
      target: node.target.map((target) => replacements.reduce((normalized, [source, replacement]) => normalized.replaceAll(source, replacement), target)),
    })),
  }));
}

export function normalizeTargetPath(target: unknown[]) {
  return target.map(String);
}

export function resolveUniqueAxeTarget(root: Document | ShadowRoot, path: string[]) {
  let queryRoot = root;
  let target: Element | null = null;
  for (const [index, segment] of path.entries()) {
    const matches: NodeListOf<Element> = queryRoot.querySelectorAll(segment);
    if (matches.length !== 1) throw new Error(`Axe target segment must resolve uniquely: ${JSON.stringify({ path, segment, count: matches.length })}.`);
    const match = matches.item(0);
    if (!match) throw new Error(`Axe target segment missing after unique resolution: ${JSON.stringify({ path, segment })}.`);
    target = match;
    if (index < path.length - 1) {
      if (match instanceof HTMLIFrameElement && match.contentDocument) queryRoot = match.contentDocument;
      else if (match.shadowRoot) queryRoot = match.shadowRoot;
      else throw new Error(`Axe target traversal root missing: ${JSON.stringify({ path, segment })}.`);
    }
  }
  return target;
}

export function additionalAxeViolations(trigger: AxeEvidence, skyline: AxeEvidence) {
  const upstream = new Set(trigger.map((violation) => JSON.stringify(violation)));
  return skyline.filter((violation) => !upstream.has(JSON.stringify(violation)));
}

export function partitionAxeEvidence(evidence: AxeEvidence, insideTargets: ReadonlySet<string>): PartitionedAxeEvidence {
  const partition = (selectInside: boolean) => evidence.flatMap((violation) => {
    const nodes = violation.nodes.filter((node) => insideTargets.has(targetSignature(node.target)) === selectInside);
    return nodes.length > 0 ? [{ ...violation, nodes }] : [];
  });
  return { outside: partition(false), inside: partition(true) };
}

export type PartitionedAxeLedger = ReturnType<typeof normalizedPartitionLedger>;
export type PairedPresenterAxeLedger = { trigger: PartitionedAxeLedger; skyline: PartitionedAxeLedger };

export function pairedPresenterAxeDifferences(trigger: PartitionedAxeEvidence, skyline: PartitionedAxeEvidence, expected?: PairedPresenterAxeLedger) {
  const differences: Array<{ scope: "outside" | "inside"; reason: string; evidence: unknown }> = [];
  if (expected) {
    for (const [application, actual, baseline] of [
      ["trigger", normalizedPartitionLedger(trigger), expected.trigger],
      ["skyline", normalizedPartitionLedger(skyline), expected.skyline],
    ] as const) {
      for (const scope of ["outside", "inside"] as const) {
        if (JSON.stringify(actual[scope]) !== JSON.stringify(baseline[scope])) {
          differences.push({ scope, reason: `${application} capture differs from exact Axe ledger`, evidence: { expected: baseline[scope], actual: actual[scope] } });
        }
      }
    }
  }

  const triggerInside = new Map(normalizedTargetLedger(trigger.inside).map((entry) => [ruleSignature(entry), entry.targets]));
  for (const entry of normalizedTargetLedger(skyline.inside)) {
    const triggerTargets = triggerInside.get(ruleSignature(entry));
    if (!triggerTargets) {
      differences.push({ scope: "inside", reason: "new rule signature", evidence: entry });
      continue;
    }
    const available = multiset(triggerTargets);
    for (const target of entry.targets) {
      const count = available.get(target) ?? 0;
      if (count === 0) differences.push({ scope: "inside", reason: "new or additional target", evidence: { rule: ruleSignature(entry), target } });
      else available.set(target, count - 1);
    }
  }
  return differences;
}

export function normalizedPartitionLedger(evidence: PartitionedAxeEvidence) {
  return { outside: normalizedTargetLedger(evidence.outside), inside: normalizedTargetLedger(evidence.inside) };
}

export function normalizedTargetLedger(evidence: AxeEvidence) {
  return evidence.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    tags: [...violation.tags].sort(),
    targets: violation.nodes.map((node) => targetSignature(node.target)).sort(),
  })).sort((left, right) => ruleSignature(left).localeCompare(ruleSignature(right)));
}

function ruleSignature(rule: { id: string; impact: string | null | undefined; tags: string[] }) {
  return JSON.stringify({ id: rule.id, impact: rule.impact, tags: [...rule.tags].sort() });
}

function targetSignature(target: string[]) {
  return JSON.stringify(target);
}

function multiset(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function escapedIdSelector(id: string) {
  return `#${id.replaceAll(":", "\\:")}`;
}
