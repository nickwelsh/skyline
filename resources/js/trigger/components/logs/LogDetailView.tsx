/*!
 * Adapted from Trigger.dev apps/webapp/app/components/logs/LogDetailView.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Fetching, tenant paths, and execution state are external; source detail composition remains.
 */
import { ExitIcon } from "~/assets/icons/ExitIcon";
import { Button, LinkButton } from "~/components/primitives/Buttons";
import { Callout } from "~/components/primitives/Callout";
import { CopyableText } from "~/components/primitives/CopyableText";
import { DateTimeAccurate } from "~/components/primitives/DateTime";
import { Header2, Header3 } from "~/components/primitives/Headers";
import * as Property from "~/components/primitives/PropertyTable";
import { PacketDisplay } from "~/components/runs/v3/PacketDisplay";
import { LogLevel, type LogLevelValue } from "./LogLevel";

type LogDetailShared = {
  id: string;
  runId: string;
  runPath: string;
  attemptNumber: number | null;
  attemptPath: string | null;
  jobType: string;
  jobPath: string;
  timestamp: string;
  level: LogLevelValue;
  errorPath: string | null;
  relationships: { traceId: string; spanId: string; parentSpanId: string | null };
  attributes: Record<string, unknown>;
  capture: { isTruncated: boolean; truncated: Array<{ path: string; originalBytes: number }> };
};
type OperationLogDetailEntry = LogDetailShared & { variant: "operation"; name: string; role: string | null; kind: number; status: "completed" | "failed"; durationUs: number; operationPath: string; events: unknown[]; links: unknown[]; resource: Record<string, unknown>; instrumentation: Record<string, unknown> };
type ApplicationLogDetailEntry = LogDetailShared & { variant: "log"; message: string; context: Record<string, unknown>; channel: string | null };
export type LogDetailEntry = OperationLogDetailEntry | ApplicationLogDetailEntry;

export function LogDetailView({ log, onClose }: { log: LogDetailEntry; onClose: () => void }) {
  const title = log.variant === "operation" ? log.name : log.message;

  return (
    <section aria-label="Telemetry-event detail" className="grid h-full grid-rows-[auto_1fr] overflow-hidden">
      <div className="flex items-center justify-between overflow-hidden border-b border-grid-dimmed py-2 pl-3 pr-2">
        <Header2 className="truncate">{title}</Header2>
        <Button aria-label="Close Telemetry-event detail" onClick={onClose} variant="minimal/small" TrailingIcon={ExitIcon} shortcut={{ key: "esc" }} shortcutPosition="before-trailing-icon" className="pl-1" />
      </div>
      <div className="overflow-y-auto px-3 py-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
        <Property.Table>
          <Item label="Run ID"><CopyableText value={log.runId} copyValue={log.runId} asChild /><LinkButton to={log.runPath} variant="secondary/small" shortcut={{ key: "v" }} className="mt-2">View full Run</LinkButton></Item>
          {log.variant === "operation" && <Item label="Status">{log.status}</Item>}
          <Item label="Job type"><CopyableText value={log.jobType} copyValue={log.jobType} asChild /><LinkButton to={log.jobPath} variant="secondary/small" className="mt-2">View Job</LinkButton></Item>
          <Item label="Level"><LogLevel level={log.level} /></Item>
          <Item label="Timestamp"><DateTimeAccurate date={log.timestamp} /></Item>
        </Property.Table>

        {log.variant === "log" && <Capture title="Message" value={log.message} language="text" />}
        {log.variant === "log" && Object.keys(log.attributes).length > 0 && <Capture title="Attributes" value={log.attributes} />}

        <Header3 className="mb-2 mt-6">Telemetry</Header3>
        <Property.Table>
          {log.attemptNumber !== null && <Item label="Attempt">{log.attemptPath ? <LinkButton to={log.attemptPath} variant="secondary/small">Attempt {log.attemptNumber}</LinkButton> : `Attempt ${log.attemptNumber}`}</Item>}
          <Item label="Trace ID"><CopyableText value={log.relationships.traceId} /></Item>
          <Item label="Span ID"><CopyableText value={log.relationships.spanId} /></Item>
          <Item label="Parent span ID">{log.relationships.parentSpanId ?? "—"}</Item>
          {log.variant === "operation" && <>
            <Item label="Role">{log.role ?? "—"}</Item><Item label="Kind">{log.kind}</Item><Item label="Duration">{`${log.durationUs.toLocaleString()}µs`}</Item>
          </>}
          {log.variant === "log" && <Item label="Channel">{log.channel ?? "—"}</Item>}
        </Property.Table>

        <div className="mt-3 flex flex-wrap gap-2">
          {log.variant === "operation" && <LinkButton to={log.operationPath} variant="secondary/small">Inspect operation</LinkButton>}
          {log.errorPath && <LinkButton to={log.errorPath} variant="secondary/small">View Error group</LinkButton>}
        </div>

        {log.variant === "log" && Object.keys(log.context).length > 0 && <Capture title="Context" value={log.context} />}
        {log.variant === "operation" && <>
          <Capture title="Attributes" value={log.attributes} />
          <Capture title="Events" value={log.events} />
          <Capture title="Links" value={log.links} />
          <Capture title="Resource" value={log.resource} />
          <Capture title="Instrumentation" value={log.instrumentation} />
        </>}
        {log.capture.isTruncated && <Callout variant="warning" className="mt-4">Captured {log.variant === "operation" ? "operation" : "log"} detail was truncated at the recorded presentation boundary.</Callout>}
      </div>
    </section>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return <Property.Item><Property.Label>{label}</Property.Label><Property.Value>{children}</Property.Value></Property.Item>;
}

function Capture({ title, value, language = "json" }: { title: string; value: unknown; language?: "json" | "text" }) {
  const code = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return <div className="mb-6 mt-3"><PacketDisplay data={code} dataType={language === "text" ? "text/plain" : "application/json"} title={title} wrap={language === "text"} /></div>;
}
