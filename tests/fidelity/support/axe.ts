import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

export async function captureAxe(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  return result.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    tags: [...violation.tags].sort(),
    nodes: violation.nodes.map((node) => ({
      target: node.target.map(String).sort(),
      failureSummary: node.failureSummary?.replaceAll(/\s+/g, " ").trim(),
    })).sort((left, right) => JSON.stringify(left.target).localeCompare(JSON.stringify(right.target))),
  })).sort((left, right) => left.id.localeCompare(right.id));
}
