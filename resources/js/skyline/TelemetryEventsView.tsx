import { ExitIcon } from "~/assets/icons/ExitIcon";
import { LogDetailView } from "~/components/logs/LogDetailView";
import { LogsTable } from "~/components/logs/LogsTable";
import { LogLevel } from "~/components/logs/LogLevel";
import { Button, LinkButton } from "~/components/primitives/Buttons";
import { Callout } from "~/components/primitives/Callout";
import { CopyableText } from "~/components/primitives/CopyableText";
import { DateTimeAccurate } from "~/components/primitives/DateTime";
import { Header2, Header3 } from "~/components/primitives/Headers";
import { Paragraph } from "~/components/primitives/Paragraph";
import * as Property from "~/components/primitives/PropertyTable";
import { PacketDisplay } from "~/components/runs/v3/PacketDisplay";
import type { LogEntry } from "~/presenters/v3/LogsListPresenter.server";
import type { PresentedTelemetryEvent, PresentedTelemetryEventDetail } from "./TelemetryEventsAdapter";

export function TelemetryEventsTable({ events, selectedId, onSelect, loading, hasAnyEvents, hasFilters }: {
  events: PresentedTelemetryEvent[];
  selectedId?: string;
  onSelect: (id: string) => void;
  loading: boolean;
  hasAnyEvents: boolean;
  hasFilters: boolean;
}) {
  const empty = events.length === 0;

  return <div className="relative h-full">
    <LogsTable logs={events.map(toTriggerLog)} selectedLogId={selectedId} onLogSelect={onSelect} isLoading={loading || empty} />
    {empty && !loading && <div className="pointer-events-none absolute inset-x-0 top-24 flex min-h-64 flex-col items-center justify-center gap-1">
      <Paragraph variant="base/bright">{hasAnyEvents && hasFilters ? "No matching Telemetry events" : "No Telemetry events yet"}</Paragraph>
      <Paragraph variant="small">{hasAnyEvents && hasFilters ? "Change or clear filters to see more events." : "Operations and application logs will appear here when Skyline observes them."}</Paragraph>
    </div>}
  </div>;
}

export function TelemetryEventDetailView({ event, onClose }: { event: PresentedTelemetryEventDetail; onClose: () => void }) {
  if (event.variant === "operation") return <OperationDetail event={event} onClose={onClose} />;

  return <section aria-label="Telemetry-event detail" className="grid h-full grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
    <div className="min-h-0"><LogDetailView logId={event.id} initialLog={toTriggerLog(event)} onClose={onClose} /></div>
    <div className="border-t border-grid-dimmed px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {event.attemptNumber !== null && (event.attemptPath ? <LinkButton to={event.attemptPath} variant="secondary/small">Attempt {event.attemptNumber}</LinkButton> : <span className="text-xs text-text-dimmed">Attempt {event.attemptNumber}</span>)}
        <LinkButton to={event.jobPath} variant="secondary/small">View Job</LinkButton>
        {event.errorPath && <LinkButton to={event.errorPath} variant="secondary/small">View Error group</LinkButton>}
      </div>
      {event.capture.isTruncated && <Callout variant="warning" className="mt-2">Captured log detail was truncated at the recorded presentation boundary.</Callout>}
    </div>
  </section>;
}

export function toTriggerLog(event: PresentedTelemetryEvent | PresentedTelemetryEventDetail): LogEntry {
  const attributes = event.variant === "log" && "attributes" in event
    ? {
        ...event.attributes,
        "skyline.context": event.context,
        "skyline.channel": event.channel,
        "skyline.trace_id": event.relationships.traceId,
        "skyline.span_id": event.relationships.spanId,
        "skyline.parent_span_id": event.relationships.parentSpanId,
      }
    : undefined;

  return {
    id: event.id,
    runId: event.runId,
    taskIdentifier: event.jobType,
    spanId: event.spanId,
    triggeredTimestamp: event.timestamp,
    level: event.level,
    message: event.variant === "operation" ? event.name : event.message,
    attributes,
  };
}

function OperationDetail({ event, onClose }: { event: Extract<PresentedTelemetryEventDetail, { variant: "operation" }>; onClose: () => void }) {
  return <section aria-label="Telemetry-event detail" className="grid h-full grid-rows-[auto_1fr] overflow-hidden">
    <div className="flex items-center justify-between overflow-hidden border-b border-grid-dimmed py-2 pl-3 pr-2">
      <Header2 className="truncate">{event.name}</Header2>
      <Button aria-label="Close Telemetry-event detail" onClick={onClose} variant="minimal/small" TrailingIcon={ExitIcon} shortcut={{ key: "esc" }} shortcutPosition="before-trailing-icon" className="pl-1" />
    </div>
    <div className="overflow-y-auto px-3 py-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
      <Property.Table>
        <Item label="Run ID"><CopyableText value={event.runId} copyValue={event.runId} asChild /><LinkButton to={event.runPath} variant="secondary/small" shortcut={{ key: "v" }} className="mt-2">View full Run</LinkButton></Item>
        <Item label="Status">{event.status}</Item>
        <Item label="Job type"><CopyableText value={event.jobType} copyValue={event.jobType} asChild /><LinkButton to={event.jobPath} variant="secondary/small" className="mt-2">View Job</LinkButton></Item>
        <Item label="Level"><LogLevel level={event.level} /></Item>
        <Item label="Timestamp"><DateTimeAccurate date={event.timestamp} /></Item>
      </Property.Table>
      <Header3 className="mb-2 mt-6">Telemetry</Header3>
      <Property.Table>
        {event.attemptNumber !== null && <Item label="Attempt">{event.attemptPath ? <LinkButton to={event.attemptPath} variant="secondary/small">Attempt {event.attemptNumber}</LinkButton> : `Attempt ${event.attemptNumber}`}</Item>}
        <Item label="Trace ID"><CopyableText value={event.relationships.traceId} /></Item>
        <Item label="Span ID"><CopyableText value={event.relationships.spanId} /></Item>
        <Item label="Parent span ID">{event.relationships.parentSpanId ?? "—"}</Item>
        <Item label="Role">{event.role ?? "—"}</Item>
        <Item label="Kind">{event.kind}</Item>
        <Item label="Duration">{`${event.durationUs.toLocaleString()}µs`}</Item>
      </Property.Table>
      <div className="mt-3 flex flex-wrap gap-2">
        <LinkButton to={event.operationPath} variant="secondary/small">Inspect operation</LinkButton>
        {event.errorPath && <LinkButton to={event.errorPath} variant="secondary/small">View Error group</LinkButton>}
      </div>
      <Capture title="Attributes" value={event.attributes} />
      <Capture title="Events" value={event.events} />
      <Capture title="Links" value={event.links} />
      <Capture title="Resource" value={event.resource} />
      <Capture title="Instrumentation" value={event.instrumentation} />
      {event.capture.isTruncated && <Callout variant="warning" className="mt-4">Captured operation detail was truncated at the recorded presentation boundary.</Callout>}
    </div>
  </section>;
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return <Property.Item><Property.Label>{label}</Property.Label><Property.Value>{children}</Property.Value></Property.Item>;
}

function Capture({ title, value }: { title: string; value: unknown }) {
  return <div className="mb-6 mt-3"><PacketDisplay data={JSON.stringify(value, null, 2)} dataType="application/json" title={title} /></div>;
}
