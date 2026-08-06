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
      target: node.target.map(String).sort(),
      failureSummary: node.failureSummary?.replaceAll(/\s+/g, " ").trim(),
    })).sort((left, right) => JSON.stringify(left.target).localeCompare(JSON.stringify(right.target))),
  })).sort((left, right) => left.id.localeCompare(right.id));
  return normalizeRadixTargets(violations, radixIds);
}

type AxeEvidence = Array<{
  id: string;
  impact: string | null | undefined;
  tags: string[];
  nodes: Array<{ target: string[]; failureSummary: string | undefined }>;
}>;

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

export function additionalAxeViolations(trigger: AxeEvidence, skyline: AxeEvidence) {
  const upstream = new Set(trigger.map((violation) => JSON.stringify(violation)));
  return skyline.filter((violation) => !upstream.has(JSON.stringify(violation)));
}

function escapedIdSelector(id: string) {
  return `#${id.replaceAll(":", "\\:")}`;
}
