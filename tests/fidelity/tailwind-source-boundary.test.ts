import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("Tailwind build input boundary", () => {
  test("scans authored product and reference sources without generated output", () => {
    const product = readFileSync(join(root, "resources/js/trigger/tailwind.css"), "utf8");
    const reference = readFileSync(join(root, "tests/fidelity/reference/tailwind.css"), "utf8");

    expect(product).toContain('@import "tailwindcss" source(none);');
    expect(product).toContain('@source "../";');
    expect(reference).toContain('@import "./vendor/tailwind.css" source(none);');
    expect(reference).toContain('@source "./vendor";');
    expect(reference).toContain('@source "./*.{html,ts,tsx}";');
    expect(`${product}\n${reference}`).not.toMatch(/@source\s+["'][^"']*dist/);
  });
});
