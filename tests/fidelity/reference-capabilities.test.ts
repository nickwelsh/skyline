// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import policy from "./reference-capabilities.json" with { type: "json" };
import { conditionQueueControls, conditionQueueListMetricResources, conditionQueueMetricResources, conditionSideMenuItems, conditionSideMenuSections, conditionSideMenuShell } from "./reference/vite.config";

const root = resolve(import.meta.dirname, "../..");
const vendor = resolve(root, "tests/fidelity/reference/vendor/components/navigation");
const queueMetrics = resolve(root, "tests/fidelity/reference/vendor/components/queues/QueueMetricCards.tsx");
const queueList = resolve(root, "tests/fidelity/reference/vendor/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues/route.tsx");
const queueControls = resolve(root, "tests/fidelity/reference/vendor/components/queues/QueueControls.tsx");

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
    expect(conditionSideMenuSections(section)).toContain("shellCapabilityPolicy.supportedSections");
    expect(conditionSideMenuShell(shell)).toContain("shellCapabilityPolicy.account");
    expect(() => conditionSideMenuItems(item.replace("export function SideMenuItem({", "export function Changed({"))).toThrow(/must be reviewed/i);
    expect(() => conditionSideMenuSections(section.replace("export function SideMenuSection({", "export function Changed({"))).toThrow(/must be reviewed/i);
    expect(() => conditionSideMenuShell(shell.replace("<AccountMenu isAdmin={isAdmin} isImpersonating={user.isImpersonating} />", "<AccountMenu />"))).toThrow(/must be reviewed/i);
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
});
