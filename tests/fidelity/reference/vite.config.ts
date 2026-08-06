import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const directory = dirname(fileURLToPath(import.meta.url));
const vendorRoot = join(directory, "vendor");
const repositoryRoot = resolve(directory, "../../..");
const triggerPackage = resolve(repositoryRoot, "../trigger.dev/apps/webapp/package.json");
const triggerRequire = createRequire(triggerPackage);
const localRequire = createRequire(join(repositoryRoot, "package.json"));

export default defineConfig({
  root: directory,
  cacheDir: "/tmp/skyline-fidelity-reference-vite",
  plugins: [referenceAdapters(), react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "~", replacement: vendorRoot },
      { find: /^@remix-run\/react$/, replacement: resolveImportPackage("@remix-run/react")! },
    ],
    conditions: ["@triggerdotdev/source", "browser", "module", "import", "default"],
    dedupe: ["react", "react-dom", "react-router", "react-router-dom", "@remix-run/react"],
  },
  build: {
    outDir: join(directory, "dist"),
    emptyOutDir: true,
    sourcemap: false,
  },
});

function referenceAdapters(): Plugin {
  const imports = collectImports(vendorRoot);
  const prefix = "\0skyline-fidelity-reference-adapter:";
  return {
    name: "skyline-fidelity-reference-adapters",
    enforce: "pre",
    resolveId(source, importer) {
      if (source.startsWith("\0")) return undefined;
      if (source === "react" || source.startsWith("react/") || source === "react-dom" || source.startsWith("react-dom/")) {
        return localRequire.resolve(source);
      }
      if (source === "react-router" || source.startsWith("react-router/") || source === "react-router-dom" || source.startsWith("react-router-dom/")) {
        return localRequire.resolve(source);
      }
      if (isExternalAdapter(source, importer)) {
        const adapterId = source.startsWith(vendorRoot) ? `~/${relative(vendorRoot, source)}` : source;
        return `${prefix}${encodeURIComponent(adapterId)}`;
      }
      if (source.startsWith(".") || source.startsWith("~/") || source.startsWith("/") || source.startsWith("virtual:")) return undefined;
      if (importer && !importer.startsWith(vendorRoot) && !importer.startsWith(directory)) return undefined;
      const importEntry = resolveImportPackage(source);
      if (importEntry) return importEntry;
      for (const resolver of [localRequire, triggerRequire]) {
        try { return resolver.resolve(source); } catch { /* try the next pinned package graph */ }
      }
      return undefined;
    },
    load(id) {
      if (!id.startsWith(prefix)) return undefined;
      const source = decodeURIComponent(id.slice(prefix.length));
      return adapterModule(imports.get(source) ?? new Set());
    },
  };
}

function resolveImportPackage(source: string) {
  const parts = source.split("/");
  const packageName = source.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  const subpath = source.slice(packageName.length).replace(/^\//, "");
  const packageRoot = resolve(repositoryRoot, "../trigger.dev/apps/webapp/node_modules", packageName);
  const packageJson = join(packageRoot, "package.json");
  if (!existsSync(packageJson)) return undefined;
  const metadata = JSON.parse(readFileSync(packageJson, "utf8"));
  const exported = metadata.exports?.[subpath ? `./${subpath}` : "."];
  const importTarget = exported?.import;
  const target = exported === undefined && !subpath
    ? metadata.module ?? (typeof metadata.browser === "string" ? metadata.browser : undefined) ?? metadata.main
    : typeof exported === "string"
    ? exported
    : typeof exported?.browser === "string"
      ? exported.browser
    : typeof importTarget === "string"
      ? importTarget
      : importTarget?.["@triggerdotdev/source"] ?? importTarget?.browser ?? importTarget?.default ?? exported?.["@triggerdotdev/source"] ?? exported?.browser ?? exported?.default;
  return typeof target === "string" ? realpathSync(join(packageRoot, target)) : undefined;
}

function isExternalAdapter(source: string, importer?: string) {
  if ((source === "@remix-run/node" || source === "@remix-run/server-runtime") && importer?.startsWith(vendorRoot)) return true;
  if (source.startsWith(vendorRoot) && (/\/(?:models|presenters|services|runEngine|v3\/services)\//.test(source) || source.includes("/routes/resources."))) return true;
  if (source.includes(".server") || source.startsWith("~/models/") || source.startsWith("~/presenters/") || source.startsWith("~/services/") || source.startsWith("~/runEngine/") || source.startsWith("~/v3/services/") || source.startsWith("~/routes/resources.")) return true;
  if (!importer || !source.startsWith(".")) return false;
  const target = resolve(dirname(importer.split("?")[0]), source);
  if (existsSync(target) || existsSync(`${target}.ts`) || existsSync(`${target}.tsx`)) return false;
  return importer.startsWith(vendorRoot);
}

function collectImports(root: string) {
  const result = new Map<string, Set<string>>();
  for (const path of walk(root)) {
    if (!/[.][cm]?[jt]sx?$/.test(path)) continue;
    const contents = readFileSync(path, "utf8");
    const pattern = /import\s+(?!type\s)([\s\S]*?)\s+from\s+["']([^"']+)["']/g;
    let match;
    while ((match = pattern.exec(contents))) {
      if (!isExternalAdapter(match[2], path)) continue;
      const names = result.get(match[2]) ?? new Set<string>();
      const clause = match[1].trim();
      if (!clause.startsWith("{") && !clause.startsWith("*")) names.add("default");
      const named = clause.match(/{([\s\S]*?)}/)?.[1] ?? "";
      for (const part of named.split(",")) {
        const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0];
        if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
      }
      result.set(match[2], names);
    }
  }
  return result;
}

function adapterModule(names: Set<string>) {
  const exports = [...names].filter((name) => name !== "default").map((name) => `export const ${name} = adapter;`).join("\n");
  return `
const adapter = new Proxy(function referenceAdapter() { return adapter; }, {
  apply() { return adapter; },
  construct() { return adapter; },
  get(_target, property) {
    if (property === "then") return undefined;
    if (property === Symbol.iterator) return function* emptyReferenceAdapter() {};
    return adapter;
  },
});
${names.has("default") ? "export default adapter;" : ""}
${exports}
`;
}

function* walk(root: string): Generator<string> {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(extname(path))) yield path;
  }
}
