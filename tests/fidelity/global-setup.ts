import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import environment from "./environment.json" with { type: "json" };

const root = resolve(import.meta.dirname, "../..");

export default async function globalSetup() {
  const hostOverride = process.env.SKYLINE_ORACLE_ALLOW_HOST === "1";
  assertPinnedRecordingEnvironment(process.env.SKYLINE_ORACLE_RECORD === "1", hostOverride);
  if (!hostOverride && process.platform !== "linux") throw new Error("Fidelity oracle requires its pinned Linux image.");
  if (!hostOverride && process.env.SKYLINE_ORACLE_IMAGE !== environment.linuxImage) throw new Error("Fidelity oracle image digest is not declared.");
  if (!hostOverride && process.versions.node !== environment.nodeVersion) throw new Error(`Fidelity Node drifted: ${process.versions.node}.`);
  if (!hostOverride && process.arch !== environment.architecture) throw new Error(`Fidelity architecture drifted: ${process.arch}.`);
  if (!hostOverride && execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim() !== environment.pnpmVersion) throw new Error("Fidelity pnpm drifted.");
  if (!hostOverride && Intl.DateTimeFormat().resolvedOptions().timeZone !== environment.timezone) throw new Error("Fidelity timezone drifted.");

  const browser = await chromium.launch();
  try {
    if (browser.version() !== environment.chromiumVersion) throw new Error(`Fidelity Chromium drifted: ${browser.version()}.`);
    if (!chromium.executablePath().includes(`chromium-${environment.chromiumRevision}`)) throw new Error("Fidelity Chromium revision drifted.");
  } finally {
    await browser.close();
  }

  for (const [name, expected] of Object.entries(environment.fonts)) {
    assertFont(join(root, "dist"), name, expected);
    assertFont(join(root, "tests/fidelity/reference/dist/assets"), name, expected);
  }
}

export function assertPinnedRecordingEnvironment(record: boolean, hostOverride: boolean) {
  if (record && hostOverride) throw new Error("Oracle recording requires the pinned Linux environment.");
}

function assertFont(directory: string, sourceName: string, expected: string) {
  const stem = sourceName.replace(".woff2", "");
  const file = readdirSync(directory).find((candidate) => candidate.includes(stem) && candidate.endsWith(".woff2"));
  if (!file) throw new Error(`Fidelity font missing: ${sourceName}.`);
  const actual = createHash("sha256").update(readFileSync(join(directory, file))).digest("hex");
  if (actual !== expected) throw new Error(`Fidelity font drifted: ${basename(file)}.`);
}
