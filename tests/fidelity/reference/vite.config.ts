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
const capabilityPolicy = JSON.parse(readFileSync(join(directory, "../reference-capabilities.json"), "utf8"));

export default defineConfig({
  root: directory,
  cacheDir: "/tmp/skyline-fidelity-reference-vite",
  plugins: [capabilityAdapters(), referenceAdapters(), react(), tailwindcss()],
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

function capabilityAdapters(): Plugin {
  const buttonsSource = join(vendorRoot, "components/primitives/Buttons.tsx");
  const queueControlsSource = join(vendorRoot, "components/queues/QueueControls.tsx");
  const queueMetricSource = join(vendorRoot, "components/queues/QueueMetricCards.tsx");
  const queueListSource = join(vendorRoot, "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues/route.tsx");
  const errorsListSource = join(vendorRoot, "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors._index/route.tsx");
  const errorDetailSource = join(vendorRoot, "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors.$fingerprint/route.tsx");
  const sideMenuSource = join(vendorRoot, "components/navigation/SideMenu.tsx");
  const sideMenuItemSource = join(vendorRoot, "components/navigation/SideMenuItem.tsx");
  const sideMenuSectionSource = join(vendorRoot, "components/navigation/SideMenuSection.tsx");
  return {
    name: "skyline-fidelity-reference-capabilities",
    enforce: "pre",
    transform(code, moduleId) {
      const source = moduleId.split("?")[0];
      if (source === queueControlsSource) return conditionQueueControls(code, capabilityPolicy.queues);
      if (source === queueMetricSource) return conditionQueueMetricResources(code, capabilityPolicy.queues);
      if (source === queueListSource) return conditionQueueListMetricResources(code, capabilityPolicy.queues);
      if (source === errorsListSource) return hideErrorsListMutations(code);
      if (source === errorDetailSource) return hideErrorDetailMutations(code);
      if (source === sideMenuSource) return conditionSideMenuShell(code);
      if (source === sideMenuItemSource) return conditionSideMenuItems(code);
      if (source === sideMenuSectionSource) return conditionSideMenuSections(code);
      if (source !== buttonsSource) return undefined;
      const adapted = code
        .replace("export const Button = forwardRef<HTMLButtonElement, ButtonPropsType>(", "const SourceButton = forwardRef<HTMLButtonElement, ButtonPropsType>(")
        .replace("export const LinkButton = ({", "const SourceLinkButton = ({");
      if (adapted === code) throw new Error("Pinned Trigger Buttons declarations changed; capability adapter must be reviewed.");
      return `${adapted}
const policy = ${JSON.stringify(capabilityPolicy.buttons)};
function text(value) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(text).join("");
  return React.isValidElement(value) ? text(value.props.children) : "";
}

function blocked(props, link) {
  const label = text(props.children).trim();
  if (policy.blockedLabels.includes(label)) return true;
  if (link && policy.blockedVariantPrefixes.some((prefix) => String(props.variant ?? "").startsWith(prefix))) return true;
  const target = typeof props.to === "string" ? props.to : "";
  return link && policy.blockedLinkPathFragments.some((fragment) => target.includes(fragment));
}

export const Button = React.forwardRef(function CapabilityButton(props, ref) {
  return blocked(props, false) ? null : <SourceButton {...props} ref={ref} />;
});
export const LinkButton = (props) => blocked(props, true) ? null : <SourceLinkButton {...props} />;
`;
    },
  };
}

export function conditionQueueMetricResources(code: string, policy: { metricSource: string } = capabilityPolicy.queues) {
  if (policy.metricSource !== "observed-fixture") throw new Error("Pinned Trigger Queue metric policy changed; capability adapter must be reviewed.");
  const declaration = "export function useQueueMetric(";
  if (!code.includes(declaration)) throw new Error("Pinned Trigger Queue metric hook changed; capability adapter must be reviewed.");
  const call = /  return useMetricResourceQuery\(query, \{[\s\S]*?\n  \}\);\n\}/;
  const adapted = code.replace(call, `  const rows = (window as any).__TRIGGER_FIDELITY_REFERENCE__?.resource?.("queue-metric", { query }) ?? [];
  return { rows, showLoading: false, failed: false };
}`);
  if (adapted === code) throw new Error("Pinned Trigger Queue metric resource call changed; capability adapter must be reviewed.");
  return adapted;
}

export function conditionQueueListMetricResources(code: string, policy: { metricSource: string; hiddenMutableRegions?: string[] } = capabilityPolicy.queues) {
  if (policy.metricSource !== "observed-fixture") throw new Error("Pinned Trigger Queue metric policy changed; capability adapter must be reviewed.");
  if (!policy.hiddenMutableRegions?.includes("environment-pause-resume")) throw new Error("Pinned Trigger Queue mutation policy changed; capability adapter must be reviewed.");
  const call = "useMetricResourceQuery(";
  if (code.split(call).length - 1 !== 3) throw new Error("Pinned Trigger Queue list metric calls changed; capability adapter must be reviewed.");
  let adapted = code.replaceAll(call, "useReferenceQueueMetric(");
  const environmentDeclaration = "function EnvironmentPauseResumeButton({";
  if (!adapted.includes(environmentDeclaration)) throw new Error("Pinned Trigger Queue environment mutation region changed; capability adapter must be reviewed.");
  adapted = adapted.replace(environmentDeclaration, "function SourceEnvironmentPauseResumeButton({");
  return `${adapted}
function useReferenceQueueMetric(query: string, _options: unknown) {
  const rows = query ? (window as any).__TRIGGER_FIDELITY_REFERENCE__?.resource?.("queue-metric", { query }) ?? [] : [];
  return { rows, showLoading: false, failed: false };
}
const queueCapabilityPolicy = ${JSON.stringify(capabilityPolicy.queues)};
function EnvironmentPauseResumeButton(props: Parameters<typeof SourceEnvironmentPauseResumeButton>[0]) {
  return queueCapabilityPolicy.hiddenMutableRegions.includes("environment-pause-resume")
    ? null
    : <SourceEnvironmentPauseResumeButton {...props} />;
}
`;
}

export function conditionQueueControls(code: string, policy: { hiddenMutableRegions?: string[] } = capabilityPolicy.queues) {
  if (!policy.hiddenMutableRegions?.includes("queue-pause-resume") || !policy.hiddenMutableRegions.includes("queue-concurrency-override")) {
    throw new Error("Pinned Trigger Queue mutation policy changed; capability adapter must be reviewed.");
  }
  const pauseDeclaration = "export function QueuePauseResumeButton(";
  const overrideDeclaration = "export function QueueOverrideConcurrencyButton(";
  if (!code.includes(pauseDeclaration) || !code.includes(overrideDeclaration)) {
    throw new Error("Pinned Trigger Queue mutation controls changed; capability adapter must be reviewed.");
  }
  const adapted = code
    .replace(pauseDeclaration, "function SourceQueuePauseResumeButton(")
    .replace(overrideDeclaration, "function SourceQueueOverrideConcurrencyButton(");
  return `${adapted}
const queueCapabilityPolicy = ${JSON.stringify(capabilityPolicy.queues)};
export function QueuePauseResumeButton(props: Parameters<typeof SourceQueuePauseResumeButton>[0]) {
  return queueCapabilityPolicy.hiddenMutableRegions.includes("queue-pause-resume")
    ? null
    : <SourceQueuePauseResumeButton {...props} />;
}
export function QueueOverrideConcurrencyButton(props: Parameters<typeof SourceQueueOverrideConcurrencyButton>[0]) {
  return queueCapabilityPolicy.hiddenMutableRegions.includes("queue-concurrency-override")
    ? null
    : <SourceQueueOverrideConcurrencyButton {...props} />;
}
`;
}

export function conditionSideMenuItems(code: string) {
  const declaration = "export function SideMenuItem({";
  const adapted = code.replace(declaration, "function SourceSideMenuItem({");
  if (adapted === code) throw new Error("Pinned Trigger SideMenuItem declaration changed; capability adapter must be reviewed.");
  return `${adapted}
const shellCapabilityPolicy = ${JSON.stringify(capabilityPolicy.shell)};
export function SideMenuItem(props: Parameters<typeof SourceSideMenuItem>[0]) {
  const action = props["data-action"];
  return action && !shellCapabilityPolicy.supportedActions.includes(action)
    ? null
    : <SourceSideMenuItem {...props} />;
}
`;
}

export function conditionSideMenuSections(code: string) {
  const declaration = "export function SideMenuSection({";
  const adapted = code.replace(declaration, "function SourceSideMenuSection({");
  if (adapted === code) throw new Error("Pinned Trigger SideMenuSection declaration changed; capability adapter must be reviewed.");
  return `${adapted}
const shellCapabilityPolicy = ${JSON.stringify(capabilityPolicy.shell)};
export function SideMenuSection(props: Parameters<typeof SourceSideMenuSection>[0]) {
  return shellCapabilityPolicy.supportedSections.includes(props.title)
    ? <SourceSideMenuSection {...props} />
    : null;
}
`;
}

export function conditionSideMenuShell(code: string) {
  const account = "            <AccountMenu isAdmin={isAdmin} isImpersonating={user.isImpersonating} />";
  const notification = `          <NotificationPanel
            isCollapsed={isCollapsed}
            hasIncident={incidentStatus.hasIncident}
            organizationId={organization.id}
            projectId={project.id}
          />`;
  const incident = `          <IncidentStatusPanel
            isCollapsed={isCollapsed}
            title={incidentStatus.title}
            hasIncident={incidentStatus.hasIncident}
            isManagedCloud={incidentStatus.isManagedCloud}
          />`;
  const deprecation = `          <V3DeprecationPanel
            isCollapsed={isCollapsed}
            isV3={isV3Project}
            projectCreatedAt={project.createdAt}
            hasIncident={incidentStatus.hasIncident}
            isManagedCloud={incidentStatus.isManagedCloud}
          />`;
  let adapted = code;
  for (const [source, replacement] of [[account, "            {shellCapabilityPolicy.account ? <AccountMenu isAdmin={isAdmin} isImpersonating={user.isImpersonating} /> : null}"], [notification, "          {shellCapabilityPolicy.notifications ? " + notification.trim() + " : null}"], [incident, "          {shellCapabilityPolicy.incidentStatus ? " + incident.trim() + " : null}"], [deprecation, "          {shellCapabilityPolicy.deprecation ? " + deprecation.trim() + " : null}"]] as const) {
    if (!adapted.includes(source)) throw new Error("Pinned Trigger SideMenu shell region changed; capability adapter must be reviewed.");
    adapted = adapted.replace(source, replacement);
  }
  return `${adapted}
const shellCapabilityPolicy = ${JSON.stringify(capabilityPolicy.shell)};
`;
}

function hideErrorsListMutations(code: string) {
  const statusHeader = "          <TableHeaderCell>Status</TableHeaderCell>\n";
  const statusCell = "      <TableCell to={errorPath}>\n        <ErrorStatusBadge status={errorGroup.status} />\n      </TableCell>\n";
  const actionsCell = "      <ErrorActionsCell\n        errorGroup={errorGroup}\n        organizationSlug={organizationSlug}\n        projectParam={projectParam}\n        envParam={envParam}\n      />\n";
  const adapted = code.replace(statusHeader, "").replace(statusCell, "").replace(actionsCell, "");
  if (adapted === code || adapted.includes(statusHeader) || adapted.includes(statusCell) || adapted.includes(actionsCell)) {
    throw new Error("Pinned Trigger Errors list mutations changed; capability adapter must be reviewed.");
  }
  return adapted;
}

function hideErrorDetailMutations(code: string) {
  const start = code.indexOf("            {/* Status */}");
  const end = code.indexOf("            {/* Error message */}", start);
  if (start < 0 || end < 0) {
    throw new Error("Pinned Trigger Error detail status changed; capability adapter must be reviewed.");
  }
  return code.slice(0, start) + code.slice(end);
}

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
