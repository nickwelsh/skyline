import type { Page } from "@playwright/test";

type AxValue = { value?: unknown };
export type RawAccessibilityNode = { nodeId: string; ignored?: boolean; role?: AxValue; name?: AxValue; value?: AxValue; description?: AxValue; childIds?: string[]; properties?: Array<{ name: string; value?: AxValue }> };
export type NormalizedAccessibilityNode = { role: string; name?: string; value?: unknown; description?: string; states?: Record<string, unknown>; children?: NormalizedAccessibilityNode[] };

const retainedStates = new Set(["checked", "disabled", "expanded", "focused", "level", "modal", "multiselectable", "orientation", "pressed", "readonly", "required", "selected"]);

export async function captureAccessibilityTree(page: Page) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Accessibility.enable");
    const result = await session.send("Accessibility.getFullAXTree") as { nodes: RawAccessibilityNode[] };
    return normalizeAccessibilityTree(result.nodes);
  } finally {
    await session.detach();
  }
}

export function normalizeAccessibilityTree(nodes: RawAccessibilityNode[]): NormalizedAccessibilityNode | null {
  const visible = nodes.filter((node) => !node.ignored && typeof node.role?.value === "string");
  if (visible.length === 0) return null;
  const byId = new Map(visible.map((node) => [node.nodeId, node]));
  const childIds = new Set(visible.flatMap((node) => node.childIds ?? []));
  const root = visible.find((node) => !childIds.has(node.nodeId)) ?? visible[0];

  const visit = (node: RawAccessibilityNode): NormalizedAccessibilityNode => {
    const states = Object.fromEntries((node.properties ?? []).filter(({ name }) => retainedStates.has(name)).map(({ name, value }) => [name, value?.value]));
    const children = (node.childIds ?? []).flatMap((id) => byId.get(id) ?? []).map(visit);
    return compact({
      role: String(node.role?.value),
      name: stringValue(node.name),
      value: node.value?.value,
      description: stringValue(node.description),
      states: Object.keys(states).length ? states : undefined,
      children: children.length ? children : undefined,
    });
  };
  return visit(root);
}

function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== "")) as T;
}

function stringValue(value?: AxValue) {
  return typeof value?.value === "string" ? value.value : undefined;
}
