// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, test } from "vitest";
import policy from "./reference-capabilities.json" with { type: "json" };
import { conditionQueueControls, conditionQueueListMetricResources, conditionQueueMetricResources, conditionSideMenuItems, conditionSideMenuSections, conditionSideMenuShell } from "./reference/vite.config";
import { conditionErrorDetailCapabilities, conditionQueueBigNumberMarkers, conditionQueueDetailMarkers, conditionQueueListMarkers, conditionQueueMetricCardMarkers, conditionQueueMiniChartMarkers, conditionReferencePathName, conditionQueueTableMarkers, conditionQueueTimeFilterAnchor } from "./reference/capability-adapters";

const root = resolve(import.meta.dirname, "../..");
const vendor = resolve(root, "tests/fidelity/reference/vendor/components/navigation");
const queueMetrics = resolve(root, "tests/fidelity/reference/vendor/components/queues/QueueMetricCards.tsx");
const queueList = resolve(root, "tests/fidelity/reference/vendor/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues/route.tsx");
const queueControls = resolve(root, "tests/fidelity/reference/vendor/components/queues/QueueControls.tsx");
const queueDetail = resolve(root, "tests/fidelity/reference/vendor/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues_.$queueParam/route.tsx");
const bigNumber = resolve(root, "tests/fidelity/reference/vendor/components/metrics/BigNumber.tsx");
const table = resolve(root, "tests/fidelity/reference/vendor/components/primitives/Table.tsx");
const miniChart = resolve(root, "tests/fidelity/reference/vendor/components/metrics/MiniLineChart.tsx");
const sharedFilters = resolve(root, "tests/fidelity/reference/vendor/components/runs/v3/SharedFilters.tsx");
const pathNameHook = resolve(root, "tests/fidelity/reference/vendor/hooks/usePathName.ts");
const referenceErrorDetail = resolve(root, "tests/fidelity/reference/vendor/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors.$fingerprint/route.tsx");
const skylineErrorDetail = resolve(root, "resources/js/trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors.$fingerprint/route.tsx");

describe("pinned shell capability adapters", () => {
  test("locks the reviewed policy digest", () => {
    const source = readFileSync(resolve(root, "tests/fidelity/reference-capabilities.json"));
    const expected = readFileSync(resolve(root, "tests/fidelity/reference-capabilities.sha256"), "utf8").split(" ")[0];

    expect(createHash("sha256").update(source).digest("hex")).toBe(expected);
    expect(policy.shell).toEqual({
      supportedActions: ["tasks", "runs", "logs", "errors", "queues", "favorite"],
      supportedSections: ["Favorites", "Observability"],
      account: false,
      notifications: false,
      incidentStatus: false,
      deprecation: false,
    });
    expect(policy.queues).toEqual({
      metricSource: "observed-fixture",
      knownMetricQueries: ["gate", "peak", "concurrency", "queueDepth", "throughput", "schedulingDelay", "throttled", "environmentSaturation", "environmentBacklog", "environmentLive", "live"],
      knownEmptyMetricQueries: ["live"],
      hiddenMutableRegions: ["environment-pause-resume", "queue-pause-resume", "queue-concurrency-override"],
    });
  });

  test("adapts exact pinned declarations and fails closed on source drift", () => {
    const item = readFileSync(resolve(vendor, "SideMenuItem.tsx"), "utf8");
    const section = readFileSync(resolve(vendor, "SideMenuSection.tsx"), "utf8");
    const shell = readFileSync(resolve(vendor, "SideMenu.tsx"), "utf8");

    expect(conditionSideMenuItems(item)).toContain("shellCapabilityPolicy.supportedActions");
    expect(conditionSideMenuItems(item)).toContain("badge={action ? undefined : props.badge}");
    expect(conditionSideMenuSections(section)).toContain("shellCapabilityPolicy.supportedSections");
    const conditionedShell = conditionSideMenuShell(shell);
    expect(conditionedShell).toContain("shellCapabilityPolicy.account");
    expect(conditionedShell).toContain("shellCapabilityPolicy.supportedActions.includes(item.dataAction)");
    expect(conditionedShell).not.toContain("data-trigger-anchor");
    expect(() => conditionSideMenuItems(item.replace("export function SideMenuItem({", "export function Changed({"))).toThrow(/must be reviewed/i);
    expect(() => conditionSideMenuSections(section.replace("export function SideMenuSection({", "export function Changed({"))).toThrow(/must be reviewed/i);
    expect(() => conditionSideMenuShell(shell.replace("<AccountMenu isAdmin={isAdmin} isImpersonating={user.isImpersonating} />", "<AccountMenu />"))).toThrow(/must be reviewed/i);
  });

  test("routes pinned active navigation through the exact source fixture path", () => {
    const hook = readFileSync(pathNameHook, "utf8");
    const adapted = conditionReferencePathName(hook);

    expect(adapted).toContain("sourcePathName?.(location.pathname) ?? location.pathname");
    expect(adapted).toContain("sourcePathName?.(navigation.location.pathname) ?? navigation.location.pathname");
    expect(() => conditionReferencePathName(hook.replace("return location.pathname;", "return changed;"))).toThrow(/must be reviewed/i);
    expect(() => conditionReferencePathName(hook.replace("return navigation.location.pathname;", "return changed;"))).toThrow(/must be reviewed/i);
  });

  test("adapts supported shell links at the public routing boundary", () => {
    const item = readFileSync(resolve(vendor, "SideMenuItem.tsx"), "utf8");
    const adapted = conditionSideMenuItems(item);

    expect(adapted).toContain('tasks: "/skyline/jobs"');
    expect(adapted).toContain('runs: "/skyline/runs"');
    expect(adapted).toContain('logs: "/skyline/logs"');
    expect(adapted).toContain('errors: "/skyline/errors"');
    expect(adapted).toContain('queues: "/skyline/queues"');
    expect(adapted).toContain('to={shellPublicRoutes[dataAction ?? ""] ?? to}');
    expect(adapted).toContain("<SourceSideMenuItem {...props} badge={action ? undefined : props.badge} />");
  });

  test("keeps required Error detail pagination present on both sides", () => {
    const reference = conditionErrorDetailCapabilities(readFileSync(referenceErrorDetail, "utf8"), policy.errors);
    const skyline = readFileSync(skylineErrorDetail, "utf8");

    expect(policy.errors.detailPagination).toBe(true);
    expect(reference).toContain("<ListPagination list={runList} />");
    expect(reference).not.toContain("errorCapabilityPolicy.detailPagination ?");
    expect(skyline).toContain("<ListPagination list={data} />");
  });

  test("routes pinned Queue metric queries through observed fixture resources", () => {
    const source = readFileSync(queueMetrics, "utf8");
    const list = readFileSync(queueList, "utf8");
    const controls = readFileSync(queueControls, "utf8");
    expect(conditionQueueMetricResources(source)).toContain('resource?.("queue-metric", { query })');
    expect(conditionQueueListMetricResources(list)).toContain("useReferenceQueueMetric(tile.query");
    expect(conditionQueueListMetricResources(list)).toContain("SourceEnvironmentPauseResumeButton");
    expect(conditionQueueControls(controls)).toContain("SourceQueuePauseResumeButton");
    expect(() => conditionQueueMetricResources(source.replace("export function useQueueMetric(", "export function changed("))).toThrow(/must be reviewed/i);
    expect(() => conditionQueueListMetricResources(list.replace("useMetricResourceQuery(tile.query", "changed(tile.query"))).toThrow(/must be reviewed/i);
    expect(() => conditionQueueControls(controls.replace("export function QueuePauseResumeButton(", "export function changed("))).toThrow(/must be reviewed/i);
    expect(() => conditionQueueMetricResources(source, { ...policy.queues, metricSource: "unknown" })).toThrow(/must be reviewed/i);
  });

  test("adds unique semantic Queue capability markers without owning broad chrome", () => {
    const list = conditionQueueListMarkers(readFileSync(queueList, "utf8"));
    const detail = conditionQueueDetailMarkers(readFileSync(queueDetail, "utf8"));
    const number = conditionQueueBigNumberMarkers(readFileSync(bigNumber, "utf8"));
    const cells = conditionQueueTableMarkers(readFileSync(table, "utf8"));
    const sparkline = conditionQueueMiniChartMarkers(readFileSync(miniChart, "utf8"));
    const metric = conditionQueueMetricCardMarkers(readFileSync(queueMetrics, "utf8"));

    for (const marker of ["queue-root-running", "queue-root-environment-limit", "queue-target-${queue.id}-limit", "queue-target-${queue.id}-limited-by", "queue-target-${queue.id}-backlog", "queue-target-${queue.id}-pause-resume", "queue-target-${queue.id}-warning", "queue-target-${queue.id}-health"]) {
      expect(list).toContain(marker);
    }
    for (const marker of ["queue-detail-concurrency", "queue-detail-concurrency-limit", "queue-detail-throttled"]) expect(detail).toContain(marker);
    expect(list).toContain("QueueHealth & { capabilityMarker?: string }");
    expect(list).toContain("data-trigger-capability={health.capabilityMarker}");
    expect(list).toContain('data-trigger-anchor="queue-filter-controls"');
    expect(list).toContain('role="search" aria-label="Queue search"');
    const diagnostics = ts.transpileModule(list, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true }).diagnostics ?? [];
    expect(diagnostics.filter(({ category }) => category === ts.DiagnosticCategory.Error)).toEqual([]);
    expect(number).toContain("data-trigger-capability={capabilityMarker}");
    expect(cells).toContain("data-trigger-capability={capabilityMarker}");
    expect(sparkline.match(/data-trigger-capability={capabilityMarker}/g)).toHaveLength(2);
    expect(metric).toContain("data-trigger-capability={capabilityMarker}");
    expect(list).not.toContain("data-trigger-capability=\"queue-header");
    expect(detail).not.toContain("queue-recorded-runs");
    expect(() => conditionQueueListMarkers(readFileSync(queueList, "utf8").replace("              value={envRunningLive}", "              value={changed}"))).toThrow(/must be reviewed/i);
  });

  test("anchors the real pinned Period Select without changing its structure", () => {
    const source = readFileSync(sharedFilters, "utf8");
    const adapted = conditionQueueTimeFilterAnchor(source);
    expect(adapted).toContain('data-trigger-anchor="queue-period-filter"');
    expect(adapted).toContain('aria-label={`${constrained.label}: ${constrained.valueLabel}`}');
    expect(adapted).toContain('className="group cursor-pointer focus-custom"');
    expect(adapted.match(/data-trigger-anchor="queue-period-filter"/g)).toHaveLength(1);
    expect(() => conditionQueueTimeFilterAnchor(source.replace('className="group cursor-pointer focus-custom"', 'className="changed"'))).toThrow(/must be reviewed/i);
  });
});
