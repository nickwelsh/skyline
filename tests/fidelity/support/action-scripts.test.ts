import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { canonicalSourceRunFilterUrl, validateActionScripts } from "./action-scripts";

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
        option: { name: "Failed 8", value: "failed" },
        blur: true,
      },
      { action: "click", target: { selector: "a[href*='direction=forward']" }, blur: true },
      { action: "history", direction: "back" },
    ]);
  });

  test("canonicalizes only the exercised source failed-status query", () => {
    expect(canonicalSourceRunFilterUrl("/runs?statuses=COMPLETED_WITH_ERRORS")).toBe("/runs?status=failed");
    expect(canonicalSourceRunFilterUrl("/runs?cursor=next&direction=forward&statuses=COMPLETED_WITH_ERRORS")).toBe(
      "/runs?cursor=next&direction=forward&status=failed",
    );
    expect(() => canonicalSourceRunFilterUrl("/runs?statuses=EXECUTING")).toThrow("Unmapped source status query: EXECUTING");
  });

  test("rejects an inexact text fallback", () => {
    const actions = JSON.parse(readFileSync(resolve(import.meta.dirname, "../actions.json"), "utf8"));
    actions.scripts.find(({ id }: { id: string }) => id === "filters-pagination").steps[0].target.exactText = "Status ";

    expect(() => validateActionScripts(actions)).toThrow("Semantic text fallback must exactly match its accessible name.");
  });
});
