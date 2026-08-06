import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transformWithEsbuild, type Plugin } from "vite";

const directory = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(directory, "../../../../trigger.dev/apps/webapp/app");

export function pinnedLogs(): Plugin {
  const publicId = "virtual:pinned-trigger-logs";
  const resolvedId = `\0${publicId}.tsx`;

  return {
    name: "pinned-trigger-logs",
    resolveId(id) { return id === publicId ? resolvedId : undefined; },
    async load(id) {
      if (id !== resolvedId) return undefined;
      const tableSource = readFileSync(resolve(appRoot, "components/logs/LogsTable.tsx"), "utf8");
      const levelSource = readFileSync(resolve(appRoot, "components/logs/LogLevel.tsx"), "utf8");
      const levelShadow = slice(tableSource, "function getLevelBoxShadow", "\n}\n\nexport function LogsTable") + "\n}";
      const logLevel = levelSource.slice(levelSource.indexOf("export function LogLevel"));
      const table = resolve(appRoot, "components/primitives/Table.tsx");
      const dateTime = resolve(appRoot, "components/primitives/DateTime.tsx");
      const property = resolve(appRoot, "components/primitives/PropertyTable.tsx");
      const resizable = resolve(appRoot, "components/primitives/Resizable.tsx");
      const headers = resolve(appRoot, "components/primitives/Headers.tsx");

      const module = `
import { useState } from "react";
import { DateTimeAccurate } from ${JSON.stringify(dateTime)};
import { Header2 } from ${JSON.stringify(headers)};
import * as Property from ${JSON.stringify(property)};
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from ${JSON.stringify(resizable)};
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from ${JSON.stringify(table)};
const cn = (...values: Array<string | false | undefined>) => values.filter(Boolean).join(" ");
const getLevelColor = (level: string) => ({ TRACE: "border-purple-500/50 text-purple-400", DEBUG: "border-slate-500/50 text-slate-400", INFO: "border-blue-500/50 text-blue-400", WARN: "border-yellow-500/50 text-yellow-400", ERROR: "border-red-500/50 text-red-400" }[level] ?? "");
${logLevel}
${levelShadow}
type Entry = { id: string; runId: string; taskIdentifier: string; spanId: string; triggeredTimestamp: string; level: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR"; message: string; attributes: Record<string, unknown> };
export function PinnedTriggerLogs({ logs }: { logs: Entry[] }) {
  const [selected, setSelected] = useState<Entry>();
  const select = (log: Entry) => { setSelected(log); const url = new URL(window.location.href); url.searchParams.set("log", log.id); window.history.replaceState(null, "", url); };
  const close = () => { setSelected(undefined); const url = new URL(window.location.href); url.searchParams.delete("log"); window.history.replaceState(null, "", url); };
  return <ResizablePanelGroup orientation="horizontal" className="h-screen max-h-full">
    <ResizablePanel id="logs-main" min="200px"><div className="relative h-full overflow-auto border-t scrollbar-thin"><Table variant="compact/mono" containerClassName="overflow-visible" showTopBorder={false}>
      <TableHeader className="sticky top-0 z-10"><TableRow><TableHeaderCell className="min-w-48">Time</TableHeaderCell><TableHeaderCell className="min-w-24">Run</TableHeaderCell><TableHeaderCell className="min-w-32">Task</TableHeaderCell><TableHeaderCell className="min-w-24">Level</TableHeaderCell><TableHeaderCell className="w-full min-w-0">Message</TableHeaderCell></TableRow></TableHeader>
      <TableBody>{logs.map((log) => <TableRow key={log.id} isSelected={selected?.id === log.id} className="cursor-pointer transition-colors hover:bg-background-dimmed"><TableCell onClick={() => select(log)} hasAction style={{ boxShadow: getLevelBoxShadow(log.level) }} className="whitespace-nowrap tabular-nums"><DateTimeAccurate date={log.triggeredTimestamp} hour12={false} /></TableCell><TableCell onClick={() => select(log)}><span className="font-mono text-xs">{log.runId}</span></TableCell><TableCell onClick={() => select(log)}><span className="font-mono text-xs">{log.taskIdentifier}</span></TableCell><TableCell onClick={() => select(log)}><LogLevel level={log.level} /></TableCell><TableCell onClick={() => select(log)} className="max-w-0 truncate"><span className="block truncate font-mono text-xs">{log.message}</span></TableCell></TableRow>)}</TableBody>
    </Table></div></ResizablePanel>
    <ResizableHandle id="logs-handle" className={selected ? "" : "pointer-events-none opacity-0"} />
    {selected ? <ResizablePanel id="log-detail" default="430px" min="430px" max="600px"><section aria-label="Pinned log detail" className="grid h-full grid-rows-[auto_1fr] overflow-hidden"><div className="flex items-center justify-between border-b border-grid-dimmed py-2 pl-3 pr-2"><Header2 className="truncate">{selected.message}</Header2><button aria-label="Close log detail" onClick={close}>Close</button></div><div className="overflow-y-auto px-3 py-3"><Property.Table><Item label="Run ID" value={selected.runId} /><Item label="Task" value={selected.taskIdentifier} /><Property.Item><Property.Label>Level</Property.Label><Property.Value><LogLevel level={selected.level} /></Property.Value></Property.Item><Item label="Timestamp" value={selected.triggeredTimestamp} /></Property.Table><pre aria-label="Message" className="mt-3 whitespace-pre-wrap border border-grid-bright p-2 font-mono text-xs">{selected.message}</pre><pre aria-label="Attributes" className="mt-3 whitespace-pre-wrap border border-grid-bright p-2 font-mono text-xs">{JSON.stringify(selected.attributes, null, 2)}</pre></div></section></ResizablePanel> : null}
  </ResizablePanelGroup>;
}
function Item({ label, value }: { label: string; value: string }) { return <Property.Item><Property.Label>{label}</Property.Label><Property.Value>{value}</Property.Value></Property.Item>; }
`;
      return (await transformWithEsbuild(module, "PinnedTriggerLogs.tsx", { loader: "tsx", jsx: "automatic" })).code;
    },
  };
}

function slice(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  if (startIndex < 0 || endIndex < 0) throw new Error(`Pinned Logs slice ${start} unavailable.`);
  return source.slice(startIndex, endIndex);
}
