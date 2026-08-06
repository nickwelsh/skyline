import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, transformWithEsbuild, type Plugin } from "vite";
import { pinnedStateInspector } from "./pinnedStateInspectorPlugin";

const directory = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(directory, "../../../../trigger.dev");
const appRoot = resolve(sourceRoot, "apps/webapp/app");

export default defineConfig({
  plugins: [pinnedRunError(), pinnedErrors(), pinnedStateInspector(), react(), tailwindcss()],
  resolve: {
    alias: {
      "~": appRoot,
      "@remix-run/react": resolve(sourceRoot, "apps/webapp/node_modules/@remix-run/react"),
    },
    dedupe: ["react", "react-dom", "react-router", "react-router-dom", "@remix-run/react"],
  },
});

function pinnedErrors(): Plugin {
  const publicId = "virtual:pinned-trigger-errors";
  const resolvedId = `\0${publicId}.tsx`;

  return {
    name: "pinned-trigger-errors",
    resolveId(id) {
      return id === publicId ? resolvedId : undefined;
    },
    async load(id) {
      if (id !== resolvedId) return undefined;
      const listRoute = readFileSync(resolve(appRoot, "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors._index/route.tsx"), "utf8");
      const detailRoute = readFileSync(resolve(appRoot, "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors.$fingerprint/route.tsx"), "utf8");
      const list = slice(listRoute, "function ErrorsList(", "function ErrorActionsCell(");
      const detail = slice(detailRoute, "function ErrorGroupDetail(", "function IgnoredDetails(");
      const blankActivity = detailRoute.slice(detailRoute.indexOf("function ActivityChartBlankState()"));
      if (!blankActivity.startsWith("function ActivityChartBlankState()")) {
        throw new Error("Pinned Trigger Error activity blank state could not be extracted.");
      }

      const imports = {
        bugIcon: resolve(appRoot, "assets/icons/BugIcon.tsx"),
        codeBlock: resolve(appRoot, "components/code/CodeBlock.tsx"),
        statusBadge: resolve(appRoot, "components/errors/ErrorStatusBadge.tsx"),
        paragraph: resolve(appRoot, "components/primitives/Paragraph.tsx"),
        headers: resolve(appRoot, "components/primitives/Headers.tsx"),
        property: resolve(appRoot, "components/primitives/PropertyTable.tsx"),
        copyableText: resolve(appRoot, "components/primitives/CopyableText.tsx"),
        dateTime: resolve(appRoot, "components/primitives/DateTime.tsx"),
        resizable: resolve(appRoot, "components/primitives/Resizable.tsx"),
        table: resolve(appRoot, "components/primitives/Table.tsx"),
      };

      const module = `
import { Suspense, useMemo, type ReactNode } from "react";
import { BugIcon } from ${JSON.stringify(imports.bugIcon)};
import { CodeBlock } from ${JSON.stringify(imports.codeBlock)};
import { ErrorStatusBadge } from ${JSON.stringify(imports.statusBadge)};
import { Paragraph } from ${JSON.stringify(imports.paragraph)};
import { Header2, Header3 } from ${JSON.stringify(imports.headers)};
import * as Property from ${JSON.stringify(imports.property)};
import { CopyableText } from ${JSON.stringify(imports.copyableText)};
import { DateTime, RelativeDateTime } from ${JSON.stringify(imports.dateTime)};
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from ${JSON.stringify(imports.resizable)};
import { CopyableTableCell, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from ${JSON.stringify(imports.table)};

type ErrorGroup = {
  fingerprint: string; taskIdentifier: string; errorMessage: string; count: number;
  status: "UNRESOLVED" | "RESOLVED" | "IGNORED"; firstSeen: string; lastSeen: string;
};
type ErrorOccurrences = { data: Record<string, Array<{ date: string; count: number }>> };
type ErrorGroupSummary = ErrorGroup & {
  affectedVersions: string[];
  state: { status: "UNRESOLVED" | "RESOLVED" | "IGNORED" };
};
type ErrorGroupOccurrences = { data: unknown[]; versions: string[] };
type NextRunList = { runs: unknown[]; pagination: { next?: string; previous?: string } };
type TaskRunListSearchFilters = Record<string, unknown>;

const ErrorId = { toFriendlyId: (value: string) => value };
const useOptimisticLocation = () => ({ search: window.location.search });
const useSearchParams = () => ({
  value: (key: string) => new URLSearchParams(window.location.search).get(key),
  values: (key: string) => new URLSearchParams(window.location.search).getAll(key),
});
const useOrganization = () => ({ slug: "reference" });
const useProject = () => ({ slug: "reference" });
const useEnvironment = () => ({ slug: "dev" });
const v3ErrorPath = (_organization: unknown, _project: unknown, _environment: unknown, error: { fingerprint: string }) => \`/errors/\${error.fingerprint}\`;
const v3RunsPath = () => "/runs";
const v3CreateBulkActionPath = () => "/runs";
const TypedAwait = ({ resolve, children }: { resolve: unknown; children: (value: any) => ReactNode; errorElement?: ReactNode }) => <>{children(resolve)}</>;
const ErrorActionsCell = () => null;
const ErrorActivityGraph = () => <div data-reference-error-activity className="h-6 w-28" />;
const ErrorActivityBlankState = () => <div data-reference-error-activity-blank className="flex h-6 w-28" />;
const TimeFilter = () => <button type="button">Occurred</button>;
const LogsVersionFilter = () => null;
const ActivityChart = () => null;
const TaskRunsTable = () => null;
const LinkButton = ({ children }: { children: ReactNode; [key: string]: unknown }) => <a href="/runs">{children}</a>;
const PermissionLink = ({ children }: { children: ReactNode; [key: string]: unknown }) => <span>{children}</span>;
const RunsIcon = () => null;
const ListCheckedIcon = () => null;
const ErrorStatusDropdown = () => null;
const IgnoredDetails = () => null;
const AnimatePresence = ({ children }: { children: ReactNode }) => <>{children}</>;
const motion = { div: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div> };

${list}
${detail}
${blankActivity}

export function PinnedTriggerErrors({ scenario, detail: showDetail }: { scenario: { errorGroups: ErrorGroupSummary[]; occurrences: ErrorOccurrences; activity: ErrorGroupOccurrences }; detail: boolean }) {
  const errorGroup = scenario.errorGroups[0];
  return showDetail ? (
    <ErrorGroupDetail
      errorGroup={errorGroup}
      runList={undefined}
      activity={scenario.activity as unknown as Promise<ErrorGroupOccurrences>}
      organizationSlug="reference"
      projectParam="reference"
      envParam="dev"
      fingerprint={errorGroup.fingerprint}
      canCancelRuns={false}
      canReplayRuns={false}
    />
  ) : (
    <ErrorsList
      errorGroups={scenario.errorGroups}
      occurrences={scenario.occurrences as unknown as Promise<ErrorOccurrences>}
      organizationSlug="reference"
      projectParam="reference"
      envParam="dev"
    />
  );
}
`;
      return (await transformWithEsbuild(module, "PinnedTriggerErrors.tsx", { loader: "tsx", jsx: "automatic" })).code;
    },
  };
}

function slice(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  if (startIndex < 0 || endIndex < 0) throw new Error(`Pinned Trigger Errors slice ${start} could not be extracted.`);
  return source.slice(startIndex, endIndex);
}

function pinnedRunError(): Plugin {
  const publicId = "virtual:pinned-trigger-run-error";
  const resolvedId = `\0${publicId}.tsx`;

  return {
    name: "pinned-trigger-run-error",
    resolveId(id) {
      return id === publicId ? resolvedId : undefined;
    },
    async load(id) {
      if (id !== resolvedId) return undefined;
      const route = readFileSync(resolve(appRoot, "routes/resources.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs.$runParam.spans.$spanParam/route.tsx"), "utf8");
      const runError = route.slice(route.indexOf("function RunError"), route.indexOf("function SpanEntity"));
      const branchStart = runError.indexOf("      const name =");
      const branchEnd = runError.indexOf("\n    }\n  }\n}", branchStart);
      if (branchStart < 0 || branchEnd < 0) throw new Error("Pinned Trigger RunError branch could not be extracted.");
      const branch = runError.slice(branchStart, branchEnd);
      const imports = {
        errors: resolve(sourceRoot, "packages/core/src/v3/errors.ts"),
        common: resolve(sourceRoot, "packages/core/src/v3/schemas/common.ts"),
        codeBlock: resolve(appRoot, "components/code/CodeBlock.tsx"),
        callout: resolve(appRoot, "components/primitives/Callout.tsx"),
        headers: resolve(appRoot, "components/primitives/Headers.tsx"),
      };

      const module = `
import type { ReactNode } from "react";
import { taskRunErrorEnhancer } from ${JSON.stringify(imports.errors)};
import type { TaskRunError } from ${JSON.stringify(imports.common)};
import { CodeBlock } from ${JSON.stringify(imports.codeBlock)};
import { Callout } from ${JSON.stringify(imports.callout)};
import { Header3 } from ${JSON.stringify(imports.headers)};
const EnvelopeIcon = () => null;
const Button = ({ children }: { children: ReactNode; [key: string]: unknown }) => <button>{children}</button>;
const Feedback = ({ button }: { button: ReactNode }) => <>{button}</>;
export function PinnedTriggerRunError({ error }: { error: TaskRunError }) {
  const enhancedError = taskRunErrorEnhancer(error);
  if (enhancedError.type !== "BUILT_IN_ERROR" && enhancedError.type !== "INTERNAL_ERROR") throw new Error("Expected built-in Trigger error fixture.");
${branch}
}
`;
      return (await transformWithEsbuild(module, "PinnedTriggerRunError.tsx", { loader: "tsx", jsx: "automatic" })).code;
    },
  };
}
