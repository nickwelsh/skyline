import type { SkylineBootstrap, SkylineCapabilities } from "./dto";

const capabilityKeys = {
  navigation: ["jobs", "runs", "sessions", "prompts", "models", "errors", "logs", "queues", "query", "dashboards", "deployments", "environmentVariables", "previewBranches", "regions", "waitpointTokens", "batches", "bulkActions", "apiKeys", "concurrency", "limits", "integrations", "schedules", "waitpoints", "alerts", "settings"],
  runs: ["view", "cancel", "replay", "bulkCancel", "bulkReplay"],
  jobs: ["view", "testJob", "configure", "schedule"],
  errors: ["view", "assign", "ignore", "resolve", "alerts", "replay", "cancel", "versions", "bulkActions"],
  logs: ["view"],
  queues: ["view", "pause", "concurrency", "workers", "rateLimits"],
  shell: ["appearance", "sidebarCustomization", "favorites", "panelPersistence", "shortcuts", "account", "notifications", "jobGuidance", "organizationSwitching", "projectSwitching", "environmentSwitching", "accountOpening"],
  help: ["menu", "shortcuts", "askAi", "documentation", "status", "suggestFeature", "contact", "changelog"],
} as const;

export function readBootstrap(): SkylineBootstrap {
  const element = document.getElementById("skyline-bootstrap");

  if (!(element instanceof HTMLScriptElement) || element.type !== "application/json") {
    throw new Error("Skyline bootstrap is missing.");
  }

  const value = JSON.parse(element.textContent ?? "null") as Partial<SkylineBootstrap> | null;

  if (
    value === null
    || value.schemaVersion !== 1
    || typeof value.basePath !== "string"
    || typeof value.applicationName !== "string"
    || typeof value.environmentLabel !== "string"
    || typeof value.capabilities !== "object"
    || value.capabilities === null
  ) {
    throw new Error("Skyline bootstrap is invalid.");
  }

  return {
    schemaVersion: 1,
    basePath: value.basePath,
    applicationName: value.applicationName,
    environmentLabel: value.environmentLabel,
    capabilities: normalizeCapabilities(value.capabilities),
  };
}

function normalizeCapabilities(value: object): SkylineCapabilities {
  const input = value as Record<string, unknown>;
  const normalized: Record<string, Record<string, boolean>> = {};

  for (const [group, keys] of Object.entries(capabilityKeys)) {
    const rawGroup = typeof input[group] === "object" && input[group] !== null
      ? input[group] as Record<string, unknown>
      : {};
    normalized[group] = Object.fromEntries(keys.map((key) => [key, rawGroup[key] === true]));
  }

  return normalized as SkylineCapabilities;
}
