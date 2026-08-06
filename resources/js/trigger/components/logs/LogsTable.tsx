/*!
 * Adapted from Trigger.dev apps/webapp/app/components/logs/LogsTable.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Tenant path-building and streaming are external; source table geometry and selection remain.
 */
import { LogLevelTooltipInfo } from "~/components/LogLevelTooltipInfo";
import { RunsIcon } from "~/assets/icons/RunsIcon";
import { LinkButton } from "~/components/primitives/Buttons";
import { DateTimeAccurate } from "~/components/primitives/DateTime";
import { Paragraph } from "~/components/primitives/Paragraph";
import { Table, TableBody, TableCell, TableCellMenu, TableHeader, TableHeaderCell, TableRow } from "~/components/primitives/Table";
import { cn } from "~/utils/cn";
import { LogLevel, type LogLevelValue } from "./LogLevel";

export type LogsTableEntry = {
  id: string;
  variant: "operation" | "log";
  timestamp: string;
  runId: string;
  runPath: string;
  jobType: string;
  level: LogLevelValue;
  message?: string;
  name?: string;
};

export function LogsTable({ logs, selectedLogId, onLogSelect, loading, hasAnyTelemetryEvents, hasFilters }: { logs: LogsTableEntry[]; selectedLogId?: string; onLogSelect: (id: string) => void; loading: boolean; hasAnyTelemetryEvents: boolean; hasFilters: boolean }) {
  return (
    <div className="relative h-full overflow-auto border-t scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
      <Table variant="compact/mono" containerClassName="overflow-visible" showTopBorder={false}>
        <TableHeader className="sticky top-0 z-10">
          <TableRow>
            <TableHeaderCell className="min-w-48 whitespace-nowrap">Time</TableHeaderCell>
            <TableHeaderCell className="min-w-24 whitespace-nowrap">Run</TableHeaderCell>
            <TableHeaderCell className="min-w-32 whitespace-nowrap">Job type</TableHeaderCell>
            <TableHeaderCell className="min-w-24 whitespace-nowrap" tooltip={<LogLevelTooltipInfo />} disableTooltipHoverableContent>Level</TableHeaderCell>
            <TableHeaderCell className="w-full min-w-0">Message</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody aria-busy={loading} className={loading ? "opacity-50" : undefined}>
          {logs.length === 0 ? <BlankState filtered={hasAnyTelemetryEvents && hasFilters} /> : logs.map((log) => {
            const selected = selectedLogId === log.id;
            const select = () => onLogSelect(log.id);
            const message = log.variant === "operation" ? log.name : log.message;

            return (
              <TableRow key={log.id} isSelected={selected} aria-selected={selected} className={cn("cursor-pointer transition-colors", !selected && "hover:bg-background-dimmed")}>
                <TableCell onClick={select} isTabbableCell hasAction style={{ boxShadow: levelBoxShadow(log.level) }} className="whitespace-nowrap tabular-nums"><DateTimeAccurate date={log.timestamp} hour12={false} /></TableCell>
                <TableCell onClick={select} hasAction className="min-w-24"><span className="font-mono text-xs">{log.runId}</span></TableCell>
                <TableCell onClick={select} hasAction className="min-w-32"><span className="font-mono text-xs">{log.jobType}</span></TableCell>
                <TableCell onClick={select} hasAction><LogLevel level={log.level} /></TableCell>
                <TableCell onClick={select} hasAction className="max-w-0 truncate"><span className="block truncate font-mono text-xs" title={message}>{message}</span></TableCell>
                <TableCellMenu className="pl-32" hiddenButtons={<LinkButton to={log.runPath} variant="minimal/small" TrailingIcon={RunsIcon} trailingIconClassName="text-text-bright" className="h-5.5 pl-1.5 pr-2"><span className="text-[0.6875rem] text-text-bright">View run</span></LinkButton>} />
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function BlankState({ filtered }: { filtered: boolean }) {
  return <tr><td colSpan={6}><div className="flex min-h-64 flex-col items-center justify-center gap-1"><Paragraph variant="base/bright">{filtered ? "No matching Telemetry events" : "No Telemetry events yet"}</Paragraph><Paragraph variant="small">{filtered ? "Change or clear filters to see more events." : "Operations and application logs will appear here when Skyline observes them."}</Paragraph></div></td></tr>;
}

function levelBoxShadow(level: LogLevelValue): string {
  switch (level) {
    case "ERROR": return "inset 2px 0 0 0 rgb(239, 68, 68)";
    case "WARN": return "inset 2px 0 0 0 rgb(234, 179, 8)";
    case "INFO": return "inset 2px 0 0 0 rgb(59, 130, 246)";
    case "TRACE": return "inset 2px 0 0 0 rgb(168, 85, 247)";
    case "DEBUG": return "none";
  }
}
