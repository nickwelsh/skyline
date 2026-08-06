// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import policy from "./reference-capabilities.json" with { type: "json" };
import { conditionSideMenuItems, conditionSideMenuSections, conditionSideMenuShell } from "./reference/vite.config";

const root = resolve(import.meta.dirname, "../..");
const vendor = resolve(root, "tests/fidelity/reference/vendor/components/navigation");

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
});
