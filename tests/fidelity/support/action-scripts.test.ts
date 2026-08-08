import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { canonicalRunInspectorActionUrl, canonicalSourceRunFilterUrl, validateActionScripts } from "./action-scripts";

describe("semantic fidelity actions", () => {
  test("cover every required interaction family without application-specific commands", () => {
    const actions = JSON.parse(readFileSync(resolve(import.meta.dirname, "../actions.json"), "utf8"));
    expect(validateActionScripts(actions)).toEqual([
      "navigation-history", "dialogs-menus", "filters-pagination", "selection-inspector-timeline-copy", "preferences", "live-error-recovery", "keyboard-focus-shortcuts",
    ]);
  });

  test("drives the source status filter through its exact accessible contract", () => {
    const actions = JSON.parse(readFileSync(resolve(import.meta.dirname, "../actions.json"), "utf8"));
    const filters = actions.scripts.find(({ id }: { id: string }) => id === "filters-pagination");

    expect(filters.steps).toEqual([
      {
        action: "choose",
        target: { role: "combobox", name: "Status", exactText: "Status" },
        option: { name: "Failed 8", nativeName: "failed", value: "failed" },
        effect: {
          selected: {
            target: { role: "combobox", name: "Status", exactText: "Status:Failed" },
            value: "failed",
            nativeName: "failed",
            customText: "Status:Failed",
          },
          visible: [{ role: "link", name: "RPXQ0VC2" }],
          hidden: [{ role: "link", name: "1H2Z7M9C" }],
          focus: "status=failed",
        },
      },
      { action: "click", target: { selector: "a[href*='direction=forward']" } },
      { action: "history", direction: "back" },
      { action: "click", target: { selector: "[role='combobox']:has-text('Created:')" } },
      { action: "click", target: { role: "button", name: "Yesterday" } },
      { action: "click", target: { role: "button", name: "Apply" } },
      { action: "click", target: { selector: "[role='combobox']:has-text('Created:')" } },
      { action: "fill", target: { selector: "input[placeholder='Custom']" }, value: "2" },
      { action: "click", target: { role: "button", name: "hours" } },
      { action: "press", key: "Control+Enter" },
    ]);
  });

  test("proves inspector selection, timeline state, and copied operation text through shared semantics", () => {
    const actions = JSON.parse(readFileSync(resolve(import.meta.dirname, "../actions.json"), "utf8"));
    const inspector = actions.scripts.find(({ id }: { id: string }) => id === "selection-inspector-timeline-copy");

    expect(inspector.comparePanelPersistence).toBe(false);
    expect(inspector.steps).toEqual([
      {
        action: "click",
        target: { role: "treeitem", name: "GenerateMonthlyInvoices Root" },
        proof: {
          selection: "run_run_01J8R4NQX6K3PV4W0A1H2Z7M9C",
          focus: { withinRole: "tree", name: "run-trace" },
        },
      },
      {
        action: "press",
        key: "d",
        proof: { tab: "detail", focus: { withinRole: "tree", name: "run-trace" } },
      },
      {
        action: "click",
        target: { role: "switch", name: "Queue time" },
        proof: {
          checked: { target: { role: "switch", name: "Queue time" }, value: true },
          focus: { target: { role: "switch", name: "Queue time" }, name: "queue-time" },
        },
      },
      {
        action: "click",
        target: { role: "treeitem", name: "insert into `invoices` (`customer_id`, `total`, `created_at`) values (?, ?, ?)" },
        proof: {
          selection: "span_4f24adb545b26d31",
          visible: [{ role: "button", name: "Copy" }],
          focus: { withinRole: "tree", name: "run-trace" },
        },
      },
      {
        action: "click",
        target: { role: "button", name: "Copy" },
        proof: {
          clipboard: "insert into `invoices` (`customer_id`, `total`, `created_at`) values (?, ?, ?)",
          focus: { target: { role: "button", name: "Copy" }, name: "copy-message" },
        },
      },
    ]);
  });

  test("canonicalizes only the exercised source failed-status query", () => {
    expect(canonicalSourceRunFilterUrl("/runs?statuses=COMPLETED_WITH_ERRORS")).toBe("/runs?status=failed");
    expect(canonicalSourceRunFilterUrl("/runs?cursor=next&direction=forward&statuses=COMPLETED_WITH_ERRORS")).toBe(
      "/runs?cursor=next&direction=forward&status=failed",
    );
    expect(() => canonicalSourceRunFilterUrl("/runs?statuses=EXECUTING")).toThrow("Unmapped source status query: EXECUTING");
  });

  test("canonicalizes only adapter-encoded timeline state after the shared switch", () => {
    expect(canonicalRunInspectorActionUrl("/runs/run_1?node=run_run_1&tab=detail&queue=true")).toBe(
      "/runs/run_1?node=run_run_1",
    );
    expect(canonicalRunInspectorActionUrl("/runs/run_1?node=run_run_1&tab=detail")).toBe(
      "/runs/run_1?node=run_run_1&tab=detail",
    );
    expect(() => canonicalRunInspectorActionUrl("/runs/run_1?node=run_run_1&tab=overview&queue=true")).toThrow(
      "Unmapped inspector queue tab: overview",
    );
    expect(() => canonicalRunInspectorActionUrl("/runs/run_1?node=run_run_1&queue=true")).toThrow(
      "Unmapped inspector queue tab: missing",
    );
  });

  test("rejects panel-persistence exclusion outside its exact action", () => {
    const actions = JSON.parse(readFileSync(resolve(import.meta.dirname, "../actions.json"), "utf8"));
    actions.scripts[0].comparePanelPersistence = false;

    expect(() => validateActionScripts(actions)).toThrow("Panel persistence exclusion is limited to inspector selection.");
  });

  test("rejects an inexact text fallback", () => {
    const actions = JSON.parse(readFileSync(resolve(import.meta.dirname, "../actions.json"), "utf8"));
    actions.scripts.find(({ id }: { id: string }) => id === "filters-pagination").steps[0].target.exactText = "Status ";

    expect(() => validateActionScripts(actions)).toThrow("Semantic fallback text must be exact.");
  });

  test("rejects a choice without an exact native option name", () => {
    const actions = JSON.parse(readFileSync(resolve(import.meta.dirname, "../actions.json"), "utf8"));
    delete actions.scripts.find(({ id }: { id: string }) => id === "filters-pagination").steps[0].option.nativeName;

    expect(() => validateActionScripts(actions)).toThrow("Semantic choice requires exact custom and native option names.");
  });
});
