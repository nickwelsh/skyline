import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transformWithEsbuild, type Plugin } from "vite";

const directory = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(directory, "../../../../trigger.dev/apps/webapp/app");

export function pinnedLogs(): Plugin {
  const tableId = "virtual:pinned-trigger-logs-table";
  const detailId = "virtual:pinned-trigger-log-detail";
  const resolvedTable = `\0${tableId}.tsx`;
  const resolvedDetail = `\0${detailId}.tsx`;

  return {
    name: "pinned-trigger-logs",
    resolveId(id) {
      if (id === tableId) return resolvedTable;
      if (id === detailId) return resolvedDetail;
      return undefined;
    },
    async load(id) {
      if (id === resolvedTable) return compile(tableModule(), "PinnedTriggerLogsTable.tsx");
      if (id === resolvedDetail) return compile(detailModule(), "PinnedTriggerLogDetail.tsx");
      return undefined;
    },
  };
}

function tableModule(): string {
  const source = readFileSync(resolve(appRoot, "components/logs/LogsTable.tsx"), "utf8");
  const presenter = source.slice(source.indexOf("type LogsTableProps"));
  if (!presenter.startsWith("type LogsTableProps")) throw new Error("Pinned Trigger LogsTable presenter unavailable.");

  return `
import { ArrowPathIcon } from "@heroicons/react/20/solid";
import { useEffect, useRef, useState } from "react";
import { LogLevelTooltipInfo } from ${path("components/LogLevelTooltipInfo.tsx")};
import { Button, LinkButton } from ${path("components/primitives/Buttons.tsx")};
import { DateTimeAccurate } from ${path("components/primitives/DateTime.tsx")};
import { Paragraph } from ${path("components/primitives/Paragraph.tsx")};
import { Spinner } from ${path("components/primitives/Spinner.tsx")};
import { Table, TableBlankRow, TableBody, TableCell, TableCellMenu, TableHeader, TableHeaderCell, TableRow, type TableVariant } from ${path("components/primitives/Table.tsx")};
import { LogLevel } from ${path("components/logs/LogLevel.tsx")};
import { cn } from ${path("utils/cn.ts")};
const RunsIcon = () => null;
const useOrganization = () => ({ slug: "reference" });
const useProject = () => ({ slug: "reference" });
const useEnvironment = () => ({ slug: "dev" });
const highlightSearchText = (message: string) => message;
const v3RunSpanPath = (_organization: unknown, _project: unknown, _environment: unknown, run: { friendlyId: string }, span: { spanId: string }) => \`/runs/\${run.friendlyId}?span=\${span.spanId}\`;
type LogEntry = { id: string; runId: string; taskIdentifier: string; spanId: string; triggeredTimestamp: string; level: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR"; message: string; attributes: Record<string, unknown> };
${presenter}
export function PinnedTriggerLogsTable({ logs, selectedLogId, onLogSelect }: { logs: LogEntry[]; selectedLogId?: string; onLogSelect: (id: string) => void }) {
  return <LogsTable logs={logs} selectedLogId={selectedLogId} onLogSelect={onLogSelect} />;
}
`;
}

function detailModule(): string {
  const source = readFileSync(resolve(appRoot, "components/logs/LogDetailView.tsx"), "utf8");
  const presenter = source.slice(source.indexOf("type LogDetailViewProps"));
  if (!presenter.startsWith("type LogDetailViewProps")) throw new Error("Pinned Trigger LogDetailView presenter unavailable.");

  return `
import { useEffect, useState, type ReactNode } from "react";
import { Button, LinkButton } from ${path("components/primitives/Buttons.tsx")};
import { CopyableText } from ${path("components/primitives/CopyableText.tsx")};
import { DateTimeAccurate } from ${path("components/primitives/DateTime.tsx")};
import { Header2 } from ${path("components/primitives/Headers.tsx")};
import { Paragraph } from ${path("components/primitives/Paragraph.tsx")};
import * as Property from ${path("components/primitives/PropertyTable.tsx")};
import { Spinner } from ${path("components/primitives/Spinner.tsx")};
import { SimpleTooltip } from ${path("components/primitives/Tooltip.tsx")};
import { LogLevel } from ${path("components/logs/LogLevel.tsx")};
const ExitIcon = () => null;
const PacketDisplay = ({ data, title }: { data: string; title: string; [key: string]: unknown }) => <pre aria-label={title} className="mt-3 whitespace-pre-wrap border border-grid-bright p-2 font-mono text-xs">{data}</pre>;
const TaskRunStatusCombo = () => null;
const descriptionForTaskRunStatus = () => "";
const useOrganization = () => ({ slug: "reference" });
const useProject = () => ({ slug: "reference" });
const useEnvironment = () => ({ slug: "dev" });
const useTypedFetcher = <T,>() => ({ data: undefined as any, state: "idle" as const, load: (_path: string) => {} });
const v3RunSpanPath = (_organization: unknown, _project: unknown, _environment: unknown, run: { friendlyId: string }, span: { spanId: string }) => \`/runs/\${run.friendlyId}?span=\${span.spanId}\`;
type TaskRunStatus = string;
type LogEntry = { id: string; runId: string; taskIdentifier: string; spanId: string; triggeredTimestamp: string; level: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR"; message: string; attributes?: Record<string, unknown> };
declare const logDetailLoader: unknown;
${presenter}
export function PinnedTriggerLogDetail({ log, onClose }: { log: LogEntry; onClose: () => void }) {
  return <section aria-label="Pinned log detail" className="grid h-full grid-rows-[auto_1fr]"><LogDetailView logId={log.id} initialLog={log} onClose={onClose} /></section>;
}
`;
}

function path(relative: string): string {
  return JSON.stringify(resolve(appRoot, relative));
}

async function compile(source: string, filename: string): Promise<string> {
  return (await transformWithEsbuild(source, filename, { loader: "tsx", jsx: "automatic" })).code;
}
