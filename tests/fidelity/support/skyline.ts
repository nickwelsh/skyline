import type { Page, Route } from "@playwright/test";
import { FixtureAdapter } from "../../../resources/js/skyline/FixtureAdapter";

const rootStates = new Set(["loading", "populated", "initial-empty", "filtered-empty", "api-error"]);
const detailStates = new Set(["loading", "found", "stale-refresh", "api-error", "not-found"]);

export type FidelityScenario = { id: string; surface: string; state: string; kind: "root" | "detail" | "owned" };
export type FixtureCatalog = { job: string; run: string; error: string; log: string; queue: string };

export function parseScenario(capture: string): FidelityScenario {
  const id = capture.slice(0, capture.indexOf("@"));
  const separator = id.indexOf("-");
  const surface = id.slice(0, separator);
  const state = id.slice(separator + 1);
  return { id, surface, state, kind: rootStates.has(state) ? "root" : detailStates.has(state) ? "detail" : "owned" };
}

export async function fixtureCatalog(adapter = new FixtureAdapter()): Promise<FixtureCatalog> {
  const [jobs, runs, errors, logs, queues] = await Promise.all([
    adapter.jobs(), adapter.runs(), adapter.errorGroups(), adapter.telemetryEvents(), adapter.queueTargets(),
  ]);
  return {
    job: jobs.jobTypes[0].id,
    run: runs.runs[0].id,
    error: errors.errorGroups[0].id,
    log: logs.telemetryEvents[0].id,
    queue: queues.queueTargets[0].id,
  };
}

export function scenarioPath(scenario: FidelityScenario, catalog: FixtureCatalog) {
  const roots: Record<string, string> = { jobs: "/skyline/jobs", runs: "/skyline/runs", errors: "/skyline/errors", logs: "/skyline/logs", queues: "/skyline/queues" };
  const details: Record<string, string> = {
    job: `/skyline/jobs/${catalog.job}`,
    run: `/skyline/runs/${catalog.run}`,
    error: `/skyline/errors/${catalog.error}`,
    log: `/skyline/logs?event=${catalog.log}`,
    queue: `/skyline/queues/${catalog.queue}`,
  };
  if (scenario.surface === "shell") return "/skyline/runs";
  if (scenario.kind === "detail") return details[scenario.surface];
  return roots[scenario.surface] ?? roots.runs;
}

export async function installSkylineFixture(page: Page, scenario: FidelityScenario, adapter = new FixtureAdapter()) {
  const catalog = await fixtureCatalog(adapter);
  await page.route("**/skyline/api/**", async (route) => fulfillApi(route, scenario, adapter));
  return catalog;
}

async function fulfillApi(route: Route, scenario: FidelityScenario, adapter: FixtureAdapter) {
  const url = new URL(route.request().url());
  const path = url.pathname.replace(/^\/skyline\/api\//, "");
  const detailRequest = /^(jobs|errors|logs|queues)\/[^/]+$/.test(path) || /^runs\/[^/]+(?:\/nodes\/[^/]+)?$/.test(path);
  const applies = scenario.kind === "root" ? !detailRequest && path !== "runs/updates" : scenario.kind === "detail" ? detailRequest : false;
  if (applies && scenario.state === "loading") return;
  if (applies && scenario.state === "api-error") return route.fulfill({ status: 500, json: { error: { code: "read_failed", message: "Deterministic telemetry error." } } });
  if (applies && scenario.state === "not-found") return route.fulfill({ status: 404, json: { error: { code: "not_found", message: "Deterministic telemetry evidence was not found." } } });

  try {
    const response = await responseFor(path, url.searchParams, adapter);
    const transformed = applies && scenario.kind === "root" && (scenario.state === "initial-empty" || scenario.state === "filtered-empty")
      ? emptyRoot(response, scenario.surface, scenario.state === "filtered-empty")
      : response;
    await route.fulfill({ json: transformed });
  } catch (error) {
    await route.fulfill({ status: 404, json: { error: { code: "not_found", message: error instanceof Error ? error.message : "Fixture missing." } } });
  }
}

async function responseFor(path: string, search: URLSearchParams, adapter: FixtureAdapter): Promise<unknown> {
  if (path === "jobs") return adapter.jobs({ search: search.get("search") ?? undefined, period: search.get("period") ?? undefined });
  if (path.startsWith("jobs/")) return adapter.job(decodeURIComponent(path.slice(5)), { cursor: search.get("cursor") ?? undefined, status: search.getAll("status[]") as never, period: search.get("period") ?? undefined });
  if (path === "runs") return adapter.runs({ cursor: search.get("cursor") ?? undefined, search: search.get("search") ?? undefined, status: search.getAll("status[]") as never, job: search.get("job") ?? undefined, connection: search.get("connection") ?? undefined, queue: search.get("queue") ?? undefined, trace: search.get("trace") ?? undefined, rootOnly: search.has("rootOnly") ? search.get("rootOnly") === "true" : undefined, triggeredFrom: search.get("triggeredFrom") ?? undefined, triggeredTo: search.get("triggeredTo") ?? undefined });
  if (path === "runs/updates") return adapter.updates({}, search.get("since") ?? "0", search.getAll("runIds[]"));
  const inspector = path.match(/^runs\/([^/]+)\/nodes\/(.+)$/);
  if (inspector) return { node: await adapter.inspector(decodeURIComponent(inspector[2]), decodeURIComponent(inspector[1])) };
  const run = path.match(/^runs\/([^/]+)$/);
  if (run) return adapter.trace(decodeURIComponent(run[1]), search.get("tableState") ?? undefined);
  if (path === "errors") return adapter.errorGroups({ jobType: search.get("jobType") ?? undefined, exceptionClass: search.get("exceptionClass") ?? undefined, period: search.get("period") ?? undefined, cursor: search.get("cursor") ?? undefined });
  if (path.startsWith("errors/")) return adapter.errorGroup(decodeURIComponent(path.slice(7)), { period: search.get("period") ?? undefined, cursor: search.get("cursor") ?? undefined });
  if (path === "logs") return adapter.telemetryEvents({ levels: search.getAll("levels[]") as never, jobType: search.get("jobType") ?? undefined, runId: search.get("runId") ?? undefined, period: search.get("period") ?? undefined, cursor: search.get("cursor") ?? undefined });
  if (path.startsWith("logs/")) return adapter.telemetryEvent(decodeURIComponent(path.slice(5)));
  if (path === "queues") return adapter.queueTargets({ cursor: search.get("cursor") ?? undefined, connection: search.get("connection") ?? undefined, search: search.get("search") ?? undefined, from: search.get("from") ?? undefined, to: search.get("to") ?? undefined });
  if (path.startsWith("queues/")) return adapter.queueTarget(decodeURIComponent(path.slice(7)), { cursor: search.get("cursor") ?? undefined, search: search.get("search") ?? undefined, from: search.get("from") ?? undefined, to: search.get("to") ?? undefined, status: search.getAll("status[]") as never });
  throw new Error(`Unknown fidelity API path: ${path}`);
}

function emptyRoot(response: unknown, surface: string, filtered: boolean) {
  const clone = structuredClone(response) as Record<string, unknown>;
  const collections: Record<string, string> = { jobs: "jobTypes", runs: "runs", errors: "errorGroups", logs: "telemetryEvents", queues: "queueTargets" };
  const flags: Record<string, string> = { jobs: "hasAnyJobTypes", runs: "hasAnyRuns", errors: "hasAnyErrorGroups", logs: "hasAnyTelemetryEvents", queues: "hasAnyQueueTargets" };
  clone[collections[surface]] = [];
  clone[flags[surface]] = filtered;
  if (filtered && typeof clone.filters === "object" && clone.filters) (clone.filters as Record<string, unknown>).search = "missing";
  return clone;
}
