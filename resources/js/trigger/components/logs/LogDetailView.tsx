/*!
 * Adapted from Trigger.dev apps/webapp/app/components/logs/LogDetailView.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Fetching, tenant paths, and execution state are external; source detail composition remains.
 */
import { XMarkIcon } from "@heroicons/react/20/solid";
import { Button, LinkButton } from "~/components/primitives/Buttons";
import { Callout } from "~/components/primitives/Callout";
import { CopyableText } from "~/components/primitives/CopyableText";
import { DateTimeShort } from "~/components/primitives/DateTime";
import { Header2 } from "~/components/primitives/Headers";
import * as Property from "~/components/primitives/PropertyTable";
import { CodeBlock } from "~/CodeBlock";
import { LogLevel, type LogLevelValue } from "./LogLevel";

export type LogDetailEntry = {
  id: string;
  variant: "operation" | "log";
  runId: string;
  runPath: string;
  attemptNumber: number | null;
  attemptPath: string | null;
  jobType: string;
  jobPath: string;
  timestamp: string;
  level: LogLevelValue;
  message?: string;
  context?: Record<string, unknown>;
  channel?: string | null;
  name?: string;
  role?: string | null;
  kind?: number;
  status?: "completed" | "failed";
  durationUs?: number;
  operationPath?: string;
  errorPath: string | null;
  relationships: { traceId: string; spanId: string; parentSpanId: string | null };
  attributes?: Record<string, unknown>;
  events?: unknown[];
  links?: unknown[];
  resource?: Record<string, unknown>;
  instrumentation?: Record<string, unknown>;
  capture?: { isTruncated: boolean; truncated: Array<{ path: string; originalBytes: number }> };
};

export function LogDetailView({ log, onClose }: { log: LogDetailEntry; onClose: () => void }) {
  const title = log.variant === "operation" ? log.name ?? "Operation" : log.message ?? "Application log";

  return (
    <section aria-label="Telemetry-event detail" className="grid h-full grid-rows-[auto_1fr] overflow-hidden">
      <div className="flex items-center justify-between overflow-hidden border-b border-grid-dimmed py-2 pl-3 pr-2">
        <Header2 className="truncate">{title}</Header2>
        <Button aria-label="Close Telemetry-event detail" onClick={onClose} variant="minimal/small" TrailingIcon={XMarkIcon} shortcut={{ key: "esc" }} shortcutPosition="before-trailing-icon" className="pl-1" />
      </div>
      <div className="overflow-y-auto px-3 py-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
        <Property.Table>
          <Item label="Run ID"><CopyableText value={log.runId} copyValue={log.runId} asChild /><LinkButton to={log.runPath} variant="secondary/small" shortcut={{ key: "v" }} className="mt-2">View full Run</LinkButton></Item>
          {log.attemptNumber !== null && <Item label="Attempt">{log.attemptPath ? <LinkButton to={log.attemptPath} variant="secondary/small">Attempt {log.attemptNumber}</LinkButton> : `Attempt ${log.attemptNumber}`}</Item>}
          <Item label="Job type"><LinkButton to={log.jobPath} variant="secondary/small">{log.jobType}</LinkButton></Item>
          <Item label="Level"><LogLevel level={log.level} /></Item>
          <Item label="Timestamp"><DateTimeShort date={log.timestamp} /></Item>
          <Item label="Trace ID"><CopyableText value={log.relationships.traceId} /></Item>
          <Item label="Span ID"><CopyableText value={log.relationships.spanId} /></Item>
          <Item label="Parent span ID">{log.relationships.parentSpanId ?? "—"}</Item>
          {log.variant === "operation" && <>
            <Item label="Role">{log.role ?? "—"}</Item><Item label="Kind">{log.kind ?? "—"}</Item><Item label="Status">{log.status ?? "—"}</Item><Item label="Duration">{log.durationUs === undefined ? "—" : `${log.durationUs.toLocaleString()}µs`}</Item>
          </>}
          {log.variant === "log" && <Item label="Channel">{log.channel ?? "—"}</Item>}
        </Property.Table>

        <div className="mt-3 flex flex-wrap gap-2">
          {log.operationPath && <LinkButton to={log.operationPath} variant="secondary/small">Inspect operation</LinkButton>}
          {log.errorPath && <LinkButton to={log.errorPath} variant="secondary/small">View Error group</LinkButton>}
        </div>

        {log.variant === "log" && <Capture title="Message" value={log.message ?? ""} language="text" />}
        {log.variant === "log" && log.context && Object.keys(log.context).length > 0 && <Capture title="Context" value={log.context} />}
        {log.variant === "operation" && <>
          <Capture title="Attributes" value={log.attributes ?? {}} />
          <Capture title="Events" value={log.events ?? []} />
          <Capture title="Links" value={log.links ?? []} />
          <Capture title="Resource" value={log.resource ?? {}} />
          <Capture title="Instrumentation" value={log.instrumentation ?? {}} />
          {log.capture?.isTruncated && <Callout variant="warning" className="mt-4">Captured operation detail was truncated at the recorded presentation boundary.</Callout>}
        </>}
      </div>
    </section>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return <Property.Item><Property.Label>{label}</Property.Label><Property.Value>{children}</Property.Value></Property.Item>;
}

function Capture({ title, value, language = "json" }: { title: string; value: unknown; language?: "json" | "text" }) {
  const code = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return <div className="mb-6 mt-3"><CodeBlock label={title} code={code} language={language} showLineNumbers={false} showCopyButton showTextWrapping showOpenInModal /></div>;
}
