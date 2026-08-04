import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "resources/js/trigger/import-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const sourceIndex = args.indexOf("--source");
const source = sourceIndex >= 0 ? resolve(args[sourceIndex + 1] ?? "") : undefined;

const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const fail = (message) => {
  throw new Error(message);
};

if (!Array.isArray(manifest.files) || manifest.files.length === 0) fail("Trigger import manifest has no files.");
if (!manifest.adaptedTargets || typeof manifest.adaptedTargets !== "object") fail("Trigger import manifest has no adapted target hashes.");

const seen = new Set();
for (const file of manifest.files) {
  if (seen.has(file.source)) fail(`Duplicate Trigger source: ${file.source}`);
  seen.add(file.source);
  if (!/^[a-f0-9]{64}$/.test(file.sha256)) fail(`Invalid hash for ${file.source}`);
  if (!existsSync(join(root, file.target))) fail(`Missing vendored target: ${file.target}`);
  if (file.mode === "exact" && digest(join(root, file.target)) !== file.sha256) {
    fail(`Exact vendored target drifted: ${file.target}`);
  }
  if (file.mode === "adapted") {
    const targetHash = manifest.adaptedTargets[file.target];
    if (!/^[a-f0-9]{64}$/.test(targetHash ?? "")) fail(`Missing adapted target hash: ${file.target}`);
    if (digest(join(root, file.target)) !== targetHash) fail(`Adapted vendored target drifted: ${file.target}`);
    if (!readFileSync(join(root, file.target), "utf8").includes(manifest.commit)) fail(`Adapted target lacks provenance: ${file.target}`);
  }
}

if (checkOnly) {
  process.stdout.write(`Verified ${manifest.files.length} vendored Trigger sources at ${manifest.commit}.\n`);
  process.exit(0);
}

if (!source) fail("Pass --source /path/to/trigger.dev checkout.");
const revision = execFileSync("git", ["-C", source, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (revision !== manifest.commit) fail(`Expected Trigger commit ${manifest.commit}; got ${revision}.`);

const staging = join(root, ".trigger-import", manifest.commit);
for (const file of manifest.files) {
  const upstream = join(source, file.source);
  if (!existsSync(upstream)) fail(`Missing upstream source: ${file.source}`);
  if (digest(upstream) !== file.sha256) fail(`Upstream hash mismatch: ${file.source}`);

  const staged = join(staging, file.source);
  mkdirSync(dirname(staged), { recursive: true });
  cpSync(upstream, staged);

  if (file.mode === "exact") {
    const target = join(root, file.target);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(upstream, target);
  }
}

process.stdout.write(`Imported ${manifest.files.length} verified sources into ${staging}. Adapted files require deliberate review.\n`);
