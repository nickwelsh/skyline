import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const commit = "ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const referenceRoot = join(root, "tests/fidelity/reference");
const vendorRoot = join(referenceRoot, "vendor");
const manifestPath = join(root, "tests/fidelity/reference-import-manifest.json");
const sourceIndex = process.argv.indexOf("--source");
const source = sourceIndex >= 0 ? resolve(process.argv[sourceIndex + 1] ?? "") : undefined;
const checkOnly = process.argv.includes("--check");
const appPrefix = "apps/webapp/app/";
const entrypoints = [
  "components/primitives/LocaleProvider.tsx",
  "components/primitives/OperatingSystemProvider.tsx",
  "components/primitives/ShortcutsProvider.tsx",
  "root.tsx",
  "routes/account._index/route.tsx",
  "routes/_app.orgs.$organizationSlug.projects.$projectParam/route.tsx",
  "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam._index/route.tsx",
  "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors/route.tsx",
  "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors.$fingerprint/route.tsx",
  "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors._index/route.tsx",
  "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.logs/route.tsx",
  "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues/route.tsx",
  "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues_.$queueParam/route.tsx",
  "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs/route.tsx",
  "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs.$runParam/route.tsx",
  "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs._index/route.tsx",
  "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.tasks.standard.$taskParam/route.tsx",
  "tailwind.css",
];
const codeExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const assetExtensions = [".css", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".woff", ".woff2"];
const allExtensions = [...codeExtensions, ...assetExtensions];
const externalLocalPatterns = [
  /\.server(?:\.[cm]?[jt]sx?)?$/,
  /^~\/(?:db|env|features|metrics|redis)\.server$/,
  /^~\/(?:models|presenters|services|runEngine|v3\/services)\//,
  /^~\/routes\/resources\./,
];

if (checkOnly) {
  verifyTrackedReference();
  process.stdout.write(`Verified pinned Trigger reference (${commit}).\n`);
  process.exit(0);
}

if (!source) throw new Error("Pass --source /path/to/trigger.dev checkout.");
const sourceCommit = git(source, ["rev-parse", "HEAD"]).toString().trim();
if (sourceCommit !== commit) throw new Error(`Expected Trigger ${commit}; got ${sourceCommit}.`);

const treeEntries = git(source, ["ls-tree", "-r", "-z", commit, "--", appPrefix])
  .toString()
  .split("\0")
  .filter(Boolean);
const blobs = new Map(treeEntries.map((entry) => {
  const tab = entry.indexOf("\t");
  const metadata = entry.slice(0, tab).split(" ");
  return [entry.slice(tab + 1), metadata[2]];
}));
const sourceFiles = new Set(blobs.keys());
const queue = entrypoints.map((path) => `${appPrefix}${path}`);
const included = new Set();
const externals = new Set();

while (queue.length > 0) {
  const path = queue.pop();
  if (!path || included.has(path)) continue;
  if (!sourceFiles.has(path)) throw new Error(`Pinned Trigger file unavailable: ${path}`);
  included.add(path);
  if (!codeExtensions.some((extension) => path.endsWith(extension)) && !path.endsWith(".css")) continue;

  const contents = show(source, path).toString("utf8");
  for (const specifier of imports(contents, path)) {
    const resolved = resolveLocalImport(specifier, path, sourceFiles);
    if (resolved) queue.push(resolved);
    else if (isLocal(specifier)) externals.add(specifier);
  }
}

const files = [...included].sort().map((path) => {
  const contents = show(source, path);
  const target = join(vendorRoot, path.slice(appPrefix.length));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
  return {
    source: path,
    target: relative(root, target),
    gitBlob: blobs.get(path),
    sha256: sha256(contents),
  };
});

const manifest = {
  schemaVersion: 1,
  repository: "https://github.com/triggerdotdev/trigger.dev.git",
  commit,
  sourcePrefix: appPrefix,
  entrypoints,
  files,
  adapterExternals: [...externals].sort(),
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`Imported ${files.length} exact Trigger reference files from ${commit}.\n`);

function verifyTrackedReference() {
  if (!existsSync(manifestPath)) throw new Error("Missing Trigger reference import manifest.");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.commit !== commit) throw new Error(`Reference commit must be ${commit}.`);
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) throw new Error("Reference manifest has no files.");
  const expectedTargets = new Set();
  for (const file of manifest.files) {
    if (!file.source.startsWith(appPrefix)) throw new Error(`Reference source escapes application root: ${file.source}`);
    if (!/^[a-f0-9]{40}$/.test(file.gitBlob)) throw new Error(`Invalid Git blob for ${file.source}.`);
    if (!/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error(`Invalid SHA-256 for ${file.source}.`);
    const target = join(root, file.target);
    if (!target.startsWith(`${vendorRoot}/`)) throw new Error(`Reference target escapes vendor root: ${file.target}`);
    if (!existsSync(target)) throw new Error(`Missing reference target: ${file.target}`);
    if (sha256(readFileSync(target)) !== file.sha256) throw new Error(`Reference target drifted: ${file.target}`);
    if (expectedTargets.has(file.target)) throw new Error(`Duplicate reference target: ${file.target}`);
    expectedTargets.add(file.target);
  }
  for (const target of walkFiles(vendorRoot)) {
    const relativeTarget = relative(root, target);
    if (!expectedTargets.has(relativeTarget)) throw new Error(`Unmanifested reference target: ${relativeTarget}`);
  }
}

function imports(contents, sourcePath) {
  const values = [];
  const pattern = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']|import\(["']([^"']+)["']\)/g;
  let match;
  while ((match = pattern.exec(contents))) values.push(match[1] ?? match[2]);
  if (sourcePath.endsWith(".css")) {
    const cssPattern = /@import\s+["']([^"']+)["']/g;
    while ((match = cssPattern.exec(contents))) values.push(match[1]);
  }
  return values;
}

function resolveLocalImport(specifier, importer, files) {
  if (!isLocal(specifier)) return undefined;
  if (externalLocalPatterns.some((pattern) => pattern.test(specifier))) return undefined;
  const withoutQuery = specifier.replace(/[?#].*$/, "");
  const base = withoutQuery.startsWith("~/")
    ? `${appPrefix}${withoutQuery.slice(2)}`
    : posix.normalize(posix.join(posix.dirname(importer), withoutQuery));
  const candidates = [base, ...allExtensions.map((extension) => `${base}${extension}`), ...allExtensions.map((extension) => `${base}/index${extension}`)];
  return candidates.find((candidate) => files.has(candidate));
}

function isLocal(specifier) {
  return specifier.startsWith("~/") || specifier.startsWith(".");
}

function show(repository, path) {
  return git(repository, ["show", `${commit}:${path}`]);
}

function git(repository, args) {
  return execFileSync("git", ["-C", repository, ...args], { encoding: null, maxBuffer: 64 * 1024 * 1024 });
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function* walkFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* walkFiles(path);
    else yield path;
  }
}
