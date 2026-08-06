import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { validateActionScripts } from "./action-scripts";

describe("semantic fidelity actions", () => {
  test("cover every required interaction family without application-specific commands", () => {
    const actions = JSON.parse(readFileSync(resolve(import.meta.dirname, "../actions.json"), "utf8"));
    expect(validateActionScripts(actions)).toEqual([
      "navigation-history", "dialogs-menus", "filters-pagination", "selection-inspector-timeline-copy", "preferences", "live-error-recovery", "keyboard-focus-shortcuts",
    ]);
  });
});
