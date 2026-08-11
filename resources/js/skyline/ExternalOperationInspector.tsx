/*!
 * Adapted from Trigger.dev SpanEntity in
 * apps/webapp/app/routes/resources.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs.$runParam.spans.$spanParam/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Retains the source Span body while exposing Skyline's recorded operation
 * evidence through the shared Run inspector tabs.
 */
import { ClipboardCheckIcon, ClipboardIcon } from "lucide-react";
import type { Language } from "prism-react-renderer";
import { useState, type ReactNode } from "react";
import { CodeBlock } from "../trigger/CodeBlock";
import { interpolateSql } from "../trigger/capture-formatting";
import { Header3 } from "../trigger/components/primitives/Headers";
import { DateTimeAccurate } from "../trigger/components/primitives/DateTime";
import * as Property from "../trigger/components/primitives/PropertyTable";
import { TaskRunStatusCombo, type RunStatus } from "../trigger/components/runs/v3/TaskRunStatus";
import type {
  CapturedValue,
  HttpMessageCapture,
  InspectorFailure,
  InspectorDto,
  InspectorPresentation,
  InspectorTiming,
  TextCapture,
} from "./dto";

export type ExternalInspector = InspectorDto & {
  detailSections: Array<{ label: string; value: unknown }>;
  context?: { value: unknown; isTruncated: boolean };
};

type PresentationOf<Type extends InspectorPresentation["type"]> = Extract<InspectorPresentation, { type: Type }>;

export type ExternalInspectorSection = "overview" | "detail";

export function ExternalOperationInspector({ inspector, section = "detail" }: { inspector: ExternalInspector; section?: ExternalInspectorSection }) {
  const presentation = inspector.presentation;

  if (inspector.kind && !["run", "attempt"].includes(inspector.kind)) {
    return section === "overview"
      ? <SourceSpanOverview inspector={inspector} />
      : <SourceSpanDetail inspector={inspector}>{presentation ? presentationDetails(presentation, inspector) : <GenericInspector inspector={inspector} />}</SourceSpanDetail>;
  }

  if (!presentation) return <GenericInspector inspector={inspector} />;

  switch (presentation.type) {
    case "sql":
      return <SqlInspector presentation={presentation} />;
    case "transaction":
      return <TransactionInspector presentation={presentation} />;
    case "cache":
      return <CacheInspector presentation={presentation} />;
    case "redis":
      return <RedisInspector presentation={presentation} />;
    case "http":
      return <HttpInspector presentation={presentation} overview={inspector.overview} />;
    case "delivery":
      return <DeliveryInspector presentation={presentation} />;
    case "storage":
      return <StorageInspector presentation={presentation} />;
    case "process":
      return <ProcessInspector presentation={presentation} />;
    case "breadcrumb":
      return <BreadcrumbInspector presentation={presentation} />;
    case "custom":
      return <CustomInspector presentation={presentation} />;
    case "summary":
      return <SummaryInspector presentation={presentation} />;
    case "generic":
      return <GenericInspector inspector={inspector} presentation={presentation} />;
  }
}

function presentationDetails(presentation: InspectorPresentation, inspector: ExternalInspector) {
  switch (presentation.type) {
    case "sql": return <SqlInspector presentation={presentation} />;
    case "transaction": return <TransactionInspector presentation={presentation} />;
    case "cache": return <CacheInspector presentation={presentation} />;
    case "redis": return <RedisInspector presentation={presentation} />;
    case "http": return <HttpInspector presentation={presentation} overview={inspector.overview} />;
    case "delivery": return <DeliveryInspector presentation={presentation} />;
    case "storage": return <StorageInspector presentation={presentation} />;
    case "process": return <ProcessInspector presentation={presentation} />;
    case "breadcrumb": return <BreadcrumbInspector presentation={presentation} />;
    case "custom": return <CustomInspector presentation={presentation} />;
    case "summary": return <SummaryInspector presentation={presentation} />;
    case "generic": return <GenericInspector inspector={inspector} presentation={presentation} />;
  }
}

function SourceSpanOverview({ inspector }: { inspector: ExternalInspector }) {
  const properties = Object.entries(inspector.overview).filter(([, value]) => value !== null && value !== undefined && value !== "");

  return (
    <div className="flex flex-col gap-4 py-3">
      <div className="border-b border-grid-bright pb-3">
        <TaskRunStatusCombo status={sourceStatus(inspector)} className="text-sm" />
      </div>
      <SourceSpanTimeline inspector={inspector} />
      <Property.Table>
        <Property.Item>
          <Property.Label className="flex items-center justify-between">
            <span>Message</span>
            <CopyTextLink value={inspector.label} />
          </Property.Label>
          <Property.Value className="whitespace-pre-wrap wrap-break-word">{inspector.label}</Property.Value>
        </Property.Item>
        {properties.map(([key, value]) => <Item key={key} label={overviewLabel(key)} value={value} breakWords />)}
      </Property.Table>
      {(inspector.timelineEvents?.length ?? 0) > 0 && <SourceSpanEvents inspector={inspector} />}
      <SourceSpanEvidence inspector={inspector} />
    </div>
  );
}

function SourceSpanDetail({ inspector, children }: { inspector: ExternalInspector; children: ReactNode }) {
  const presentation = inspector.presentation;
  const extension = presentation && ["sql", "transaction", "cache", "redis"].includes(presentation.type);

  return (
    <div
      className="py-3"
      data-skyline-extension={extension ? "database-state-operation-inspector" : undefined}
      role={extension ? "region" : undefined}
      aria-label={extension ? "Database and state operation inspector" : undefined}
    >
      {children}
    </div>
  );
}

function overviewLabel(key: string): string {
  const labels: Record<string, string> = {
    runId: "Run ID",
    attemptNumber: "Attempt",
    traceId: "Trace ID",
    spanId: "Span ID",
    parentSpanId: "Parent span ID",
  };
  return labels[key] ?? key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

function SourceSpanEvidence({ inspector }: { inspector: ExternalInspector }) {
  const eventNames = metadataEventNames(inspector.metadata.value);
  if (!inspector.source && !inspector.telemetryEventHref && eventNames.length === 0) return null;

  return (
    <section role="region" aria-label="Span evidence" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {inspector.source && (inspector.source.href
        ? <a href={inspector.source.href} className="font-mono text-text-link">{inspector.source.file}:{inspector.source.line}</a>
        : <span className="font-mono text-text-dimmed">{inspector.source.file}:{inspector.source.line}</span>)}
      {inspector.telemetryEventHref && <a href={inspector.telemetryEventHref} className="text-text-link">Telemetry event</a>}
      {eventNames.map((name) => <span key={name} className="text-text-dimmed">Metadata · {name}</span>)}
    </section>
  );
}

function metadataEventNames(metadata: Record<string, unknown>): string[] {
  if (!Array.isArray(metadata.events)) return [];
  return [...new Set(metadata.events.flatMap((event) => {
    if (!event || typeof event !== "object" || !("name" in event) || typeof event.name !== "string") return [];
    return [event.name];
  }))];
}

function SourceSpanTimeline({ inspector }: { inspector: ExternalInspector }) {
  const startedAt = inspector.presentation && "timing" in inspector.presentation
    ? inspector.presentation.timing?.startedAt ?? null
    : null;
  const finishedAt = inspector.presentation && "timing" in inspector.presentation
    ? inspector.presentation.timing?.endedAt ?? null
    : null;
  const state = inspector.isError ? "error" : inspector.isPartial ? "inprogress" : undefined;

  return (
    <div className="min-w-fit max-w-80">
      <SourceTimelineEvent title="Started" timestamp={startedAt} state={state} variant="start" />
      <div className="grid h-6 grid-cols-[1.125rem_1fr] gap-1 text-xs">
        <div className="flex items-stretch justify-center"><div className={`w-1.75 ${inspector.isError ? "bg-error" : inspector.isPartial ? "bg-text-dimmed" : "bg-text-dimmed"}`} /></div>
        <div className="flex items-center justify-between gap-3"><span className="text-text-dimmed">{formatMicroseconds(inspector.durationUs)}</span></div>
      </div>
      <SourceTimelineEvent title="Finished" timestamp={finishedAt} state={state} variant="end" />
    </div>
  );
}

function SourceTimelineEvent({ title, timestamp, state, variant }: { title: string; timestamp: string | null; state?: "error" | "inprogress"; variant: "start" | "end" }) {
  const color = state === "error" ? "bg-error" : "bg-text-dimmed";
  return (
    <div className="grid h-5 grid-cols-[1.125rem_1fr] gap-1 text-sm">
      <div className="relative flex flex-col items-center justify-center"><div className={`${color} h-full w-1.75 ${variant === "start" ? "rounded-t-xs" : "rounded-b-xs"}`} /></div>
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <div className="min-w-0 max-w-full cursor-default text-left"><div className="truncate font-medium text-text-bright">{title}</div></div>
        {timestamp && <span className="whitespace-nowrap text-xs tabular-nums text-text-dimmed"><DateTimeAccurate date={timestamp} /></span>}
      </div>
    </div>
  );
}

function SourceSpanEvents({ inspector }: { inspector: ExternalInspector }) {
  return (
    <div className="flex flex-col gap-4">
      {inspector.timelineEvents.map((event, index) => (
        <div key={`${event.name}-${index}`} className="flex flex-col gap-2">
          <div className="flex items-center justify-between"><Header3>{event.name}</Header3></div>
        </div>
      ))}
    </div>
  );
}

function CopyTextLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  };
  return (
    <button type="button" onClick={copy} className={`inline-flex cursor-pointer items-center gap-1 text-xs transition-colors ${copied ? "text-success" : "text-text-dimmed hover:text-text-bright"}`}>
      {copied ? "Copied" : "Copy"}
      {copied ? <ClipboardCheckIcon className="size-3" /> : <ClipboardIcon className="size-3" />}
    </button>
  );
}

function sourceStatus(inspector: ExternalInspector): RunStatus {
  if (inspector.isError || inspector.status === "failed") return "failed";
  if (inspector.isPartial || inspector.status === "running") return "running";
  if (inspector.status === "queued") return "queued";
  if (inspector.status === "retrying" || inspector.status === "released") return "retrying";
  return "completed";
}

function SqlInspector({ presentation }: { presentation: PresentationOf<"sql"> }) {
  const { statement, bindings, result } = presentation.sql;

  return (
    <InspectorLayout title="SQL query" timing={presentation.timing} failure={presentation.failure}>
      <RecordedCode label="Parameterized SQL" code={statement.value} language="sql" truncated={statement.isTruncated} />
      {bindings && bindings.items.length > 0 && (
        <RecordedCode
          label="SQL with bindings"
          code={interpolateSql(statement.value, bindings.items)}
          language="sql"
          truncated={statement.isTruncated || bindings.truncated}
        />
      )}
      {!bindings && <Unavailable>Bindings not captured</Unavailable>}
      {result
        ? <RecordedJson label="Result preview" value={result} truncated={result.truncated} summary={result.kind === "rows" ? `${result.rowCount.toLocaleString()} rows` : `${result.affectedRows.toLocaleString()} affected`} />
        : <Unavailable>Result not captured</Unavailable>}
    </InspectorLayout>
  );
}

function TransactionInspector({ presentation }: { presentation: PresentationOf<"transaction"> }) {
  const { transaction } = presentation;

  return (
    <InspectorLayout title="Database transaction" timing={presentation.timing} failure={presentation.failure}>
      <Property.Table>
        <Item label="Connection" value={transaction.connection} />
        <Item label="Driver" value={transaction.driver} />
        <Item label="Depth" value={transaction.depth} />
        <Item label="Outcome" value={transaction.outcome} />
        <Item label="Query time" value={transaction.queryTimeMs === null ? null : `${transaction.queryTimeMs} ms`} />
      </Property.Table>
    </InspectorLayout>
  );
}

function CacheInspector({ presentation }: { presentation: PresentationOf<"cache"> }) {
  const { cache } = presentation;

  return (
    <InspectorLayout title="Cache operation" timing={presentation.timing} failure={presentation.failure}>
      <Property.Table>
        <Item label="Operation" value={cache.operation} />
        <Item label="Store" value={cache.store} />
        <Item label={cache.keyCaptured ? "Key" : "Key fingerprint"} value={cache.key} breakWords />
        <Item label="Key count" value={cache.keyCount} />
        <Item label="Strategy" value={cache.strategy} />
        <Item label="Outcome" value={cache.outcome} />
        <Item label="Hit" value={cache.hit === null ? "Not captured" : cache.hit ? "Yes" : "No"} />
        <Item label="TTL" value={cache.ttlSeconds === null ? null : `${cache.ttlSeconds} s`} />
        <Item label="Fresh TTL" value={cache.freshTtlSeconds === null ? null : `${cache.freshTtlSeconds} s`} />
        <Item label="Forever" value={cache.forever === null ? "Not captured" : cache.forever ? "Yes" : "No"} />
      </Property.Table>
      <CapturedValuePreview label="Value" capture={cache.value} />
    </InspectorLayout>
  );
}

function RedisInspector({ presentation }: { presentation: PresentationOf<"redis"> }) {
  const { redis } = presentation;

  return (
    <InspectorLayout title="Redis command" timing={presentation.timing} failure={presentation.failure}>
      <Property.Table>
        <Item label="Command" value={redis.command} />
        <Item label="Connection" value={redis.connection} />
        <Item label="Outcome" value={redis.outcome} />
      </Property.Table>
      <CapturedValuePreview label="Arguments" capture={redis.arguments} />
    </InspectorLayout>
  );
}

function HttpInspector({ presentation, overview }: { presentation: PresentationOf<"http">; overview: ExternalInspector["overview"] }) {
  const { http } = presentation;
  const query = httpQueryParameters(http.url);

  return (
    <InspectorLayout title="HTTP request" timing={presentation.timing} failure={presentation.failure}>
      <Property.Table>
        <Item label="Method" value={http.method} />
        <Item label="URL" value={http.url} breakWords />
        <Item label="Status" value={http.statusCode} />
      </Property.Table>
      {query && <RecordedJson label="Query parameters" value={query} />}
      <MessageCapture title="Request" capture={http.request} />
      <MessageCapture title="Response" capture={http.response} />
      <RecordedJson label="Context" value={overview} />
    </InspectorLayout>
  );
}

function httpQueryParameters(url: string): Record<string, string | string[]> | null {
  try {
    const parsed = new URL(url, "http://skyline.invalid");
    const query: Record<string, string | string[]> = {};
    for (const [key, value] of parsed.searchParams) {
      const current = query[key];
      query[key] = current === undefined ? value : Array.isArray(current) ? [...current, value] : [current, value];
    }
    return Object.keys(query).length > 0 ? query : null;
  } catch {
    return null;
  }
}

function DeliveryInspector({ presentation }: { presentation: PresentationOf<"delivery"> }) {
  const { delivery } = presentation;

  return (
    <InspectorLayout title={delivery.kind === "mail" ? "Mail delivery" : "Notification delivery"} timing={presentation.timing} failure={presentation.failure}>
      <Property.Table>
        <Item label="Type" value={delivery.messageType} />
        <Item label={delivery.kind === "mail" ? "Transport" : "Channel"} value={delivery.transportOrChannel} />
        <Item label="Outcome" value={delivery.outcome} />
        <Item label="Recipient count" value={delivery.recipientCount} />
      </Property.Table>
      {delivery.recipients
        ? <RecordedJson label="Recipients" value={delivery.recipients} />
        : <Unavailable>Recipients not captured</Unavailable>}
      <CapturedValuePreview label="Recipient identity" capture={delivery.recipientIdentity} />
      <TextPreview label="Subject" capture={delivery.subject} />
      <TextPreview label="Text body" capture={delivery.text} />
      {delivery.html
        ? <RecordedCode label="HTML body" code={delivery.html.value} language="markup" truncated={delivery.html.truncated} />
        : <Unavailable>HTML body not captured</Unavailable>}
      <CapturedValuePreview label="Message data" capture={delivery.messageData} />
      <CapturedValuePreview label="Operation data" capture={delivery.operationData} />
    </InspectorLayout>
  );
}

function StorageInspector({ presentation }: { presentation: PresentationOf<"storage"> }) {
  const { storage } = presentation;

  return (
    <InspectorLayout title="Storage operation" timing={presentation.timing} failure={presentation.failure}>
      <Property.Table>
        <Item label="Operation" value={storage.operation} />
        <Item label="Disk" value={storage.disk} />
        <Item label="Driver" value={storage.driver} />
        <Item label="Path" value={storage.pathCaptured ? storage.path : "Not captured"} breakWords />
        <Item label="Destination" value={storage.destinationCaptured ? storage.destination : "Not captured"} breakWords />
        <Item label="Bytes" value={storage.bytes} />
        <Item label="Outcome" value={storage.outcome} />
        <LinkItem label="Object URL" href={storage.url} />
        <LinkItem label="Destination URL" href={storage.destinationUrl} />
        <LinkItem label="Local file" href={storage.localFile?.href ?? null} value={storage.localFile?.path} />
        <LinkItem label="Destination file" href={storage.destinationLocalFile?.href ?? null} value={storage.destinationLocalFile?.path} />
      </Property.Table>
      <CapturedValuePreview label="Content" capture={storage.content} />
      <RecordedJson label="Recorded result" value={storage.result} />
    </InspectorLayout>
  );
}

function ProcessInspector({ presentation }: { presentation: PresentationOf<"process"> }) {
  const { process } = presentation;

  return (
    <InspectorLayout title="Process operation" timing={presentation.timing} failure={presentation.failure}>
      <Property.Table>
        <Item label="Executable" value={process.executable} />
        <Item label="Mode" value={process.async === null ? "Not captured" : process.async ? "Asynchronous" : "Synchronous"} />
        <Item label="Timeout" value={process.timeoutSeconds === null ? null : `${process.timeoutSeconds} s`} />
        <Item label="Exit code" value={process.exitCode} />
        <Item label="Timed out" value={process.timedOut === null ? "Not captured" : process.timedOut ? "Yes" : "No"} />
        <Item label="Outcome" value={process.outcome} />
      </Property.Table>
      <CapturedValuePreview label="Command" capture={process.command} />
      <CapturedValuePreview label="Environment" capture={process.environment} />
      <CapturedValuePreview label="Standard input" capture={process.input} />
      <CapturedValuePreview label="Standard output" capture={process.stdout} />
      <CapturedValuePreview label="Standard error" capture={process.stderr} />
    </InspectorLayout>
  );
}

function BreadcrumbInspector({ presentation }: { presentation: PresentationOf<"breadcrumb"> }) {
  const { breadcrumb } = presentation;

  return (
    <section aria-label="Breadcrumb detail" className="flex min-w-0 flex-col gap-4">
      <Header3>Breadcrumb</Header3>
      <Property.Table>
        <Item label="Timestamp" value={breadcrumb.timestamp} />
        <Item label="Level" value={breadcrumb.level} />
        <Item label="Channel" value={breadcrumb.channel} />
      </Property.Table>
      <RecordedCode label="Message" code={breadcrumb.message} language="markup" />
      <RecordedJson label="Context" value={breadcrumb.context} />
    </section>
  );
}

function CustomInspector({ presentation }: { presentation: PresentationOf<"custom"> }) {
  return (
    <InspectorLayout title="Custom operation" timing={presentation.timing} failure={presentation.failure}>
      <Property.Table><Item label="Name" value={presentation.custom.name} /></Property.Table>
      <RecordedJson label="Attributes" value={presentation.custom.attributes} />
    </InspectorLayout>
  );
}

function SummaryInspector({ presentation }: { presentation: PresentationOf<"summary"> }) {
  const { resources, operations } = presentation.summary;

  return (
    <section aria-label="Resource summary detail" className="flex min-w-0 flex-col gap-4">
      <Header3>Resource summary</Header3>
      <Property.Table>
        <Item label="Peak memory" value={formatBytes(resources.peakMemoryBytes)} />
        <Item label="Memory change" value={formatSignedBytes(resources.memoryDeltaBytes)} />
        <Item label="CPU time" value={formatMicroseconds(resources.cpuTimeUs)} />
      </Property.Table>
      <RecordedJson label="Operations" value={operations} />
    </section>
  );
}

function GenericInspector({ inspector, presentation }: { inspector: ExternalInspector; presentation?: PresentationOf<"generic"> }) {
  return (
    <InspectorLayout title="Recorded operation" timing={presentation?.timing} failure={presentation?.failure}>
      {inspector.detailSections.length > 0
        ? inspector.detailSections.map((section) => <RecordedJson key={section.label} label={section.label} value={section.value} />)
        : <CodeBlock
            rowTitle="Recorded properties"
            label="Recorded properties"
            code={JSON.stringify(inspector.metadata.value, null, 2)}
            language="json"
            jsonValue={inspector.metadata.value}
            showLineNumbers={false}
            showTextWrapping
            maxLines={20}
          />}
    </InspectorLayout>
  );
}

function InspectorLayout({ title, timing, failure, children }: { title: string; timing?: InspectorTiming; failure?: InspectorFailure; children: ReactNode }) {
  return (
    <section aria-label={`${title} detail`} className="flex min-w-0 flex-col gap-4">
      <Header3>{title}</Header3>
      {timing && (
        <Property.Table>
          <Item label="Started" value={timing.startedAt ? <time dateTime={timing.startedAt}><DateTimeAccurate date={timing.startedAt} /></time> : null} />
          <Item label="Finished" value={timing.endedAt ? <time dateTime={timing.endedAt}><DateTimeAccurate date={timing.endedAt} /></time> : null} />
          <Item label="Duration" value={formatMicroseconds(timing.durationUs)} />
        </Property.Table>
      )}
      {failure && (
        <div role="alert" className="rounded border border-error/40 bg-error/10 p-3 text-sm">
          <div className="font-medium text-text-bright">{failure.type ?? "Operation failed"}</div>
          {failure.message && <div className="mt-1 whitespace-pre-wrap break-words text-text-dimmed">{failure.message}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

function MessageCapture({ title, capture }: { title: string; capture: HttpMessageCapture }) {
  return (
    <section aria-label={`${title} evidence`} className="flex min-w-0 flex-col gap-3">
      <Header3>{title}</Header3>
      {capture.headers
        ? <RecordedJson label={`${title} headers`} value={capture.headers.items} truncated={capture.headers.truncated} />
        : <Unavailable>{title} headers not captured</Unavailable>}
      {capture.body
        ? capture.body.isJson
          ? <RecordedJson label={`${title} body`} value={capture.body.json ?? capture.body.value} truncated={capture.body.truncated} summary={capture.body.contentType ?? undefined} />
          : <RecordedCode label={`${title} body`} code={capture.body.value} language="markup" truncated={capture.body.truncated} summary={capture.body.contentType ?? undefined} />
        : <Unavailable>{title} body not captured</Unavailable>}
    </section>
  );
}

function CapturedValuePreview({ label, capture }: { label: string; capture: CapturedValue | null }) {
  return capture
    ? <RecordedJson label={label} value={capture.value} truncated={capture.truncated} summary={capture.type} />
    : <Unavailable>{label} not captured</Unavailable>;
}

function TextPreview({ label, capture }: { label: string; capture: TextCapture | null }) {
  return capture
    ? <RecordedCode label={label} code={capture.value} language="markup" truncated={capture.truncated} />
    : <Unavailable>{label} not captured</Unavailable>;
}

function RecordedJson({ label, value, summary, truncated = false }: { label: string; value: unknown; summary?: string; truncated?: boolean }) {
  return (
    <RecordedCode
      label={label}
      code={stringifyRecordedValue(value)}
      language="json"
      jsonValue={typeof value === "object" && value !== null ? value : undefined}
      summary={summary}
      truncated={truncated}
    />
  );
}

function RecordedCode({ label, code, language, jsonValue, summary, truncated = false }: {
  label: string;
  code: string;
  language: Language;
  jsonValue?: unknown;
  summary?: string;
  truncated?: boolean;
}) {
  return (
    <CodeBlock
      rowTitle={<RecordedTitle label={label} summary={summary} truncated={truncated} />}
      label={label}
      code={code}
      language={language}
      jsonValue={jsonValue}
      maxLines={20}
      showLineNumbers={false}
      showTextWrapping
    />
  );
}

function RecordedTitle({ label, summary, truncated }: { label: string; summary?: string; truncated: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate">{label}</span>
      {summary && <span className="shrink-0 text-text-faint">· {summary}</span>}
      {truncated && <span className="shrink-0 rounded border border-amber-500/40 bg-amber-500/10 px-1 text-amber-300">Truncated</span>}
    </span>
  );
}

function stringifyRecordedValue(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function Unavailable({ children }: { children: ReactNode }) {
  return <p className="text-sm text-text-faint">{children}</p>;
}

function Item({ label, value, breakWords = false }: { label: string; value: ReactNode; breakWords?: boolean }) {
  return (
    <Property.Item>
      <Property.Label>{label}</Property.Label>
      <Property.Value className={breakWords ? "break-words font-mono" : undefined}>{display(value)}</Property.Value>
    </Property.Item>
  );
}

function LinkItem({ label, href, value }: { label: string; href: string | null; value?: string | null }) {
  if (!href && !value) return null;
  return (
    <Property.Item>
      <Property.Label>{label}</Property.Label>
      <Property.Value className="break-words font-mono">
        {href ? <a href={href} className="text-text-link">{value ?? href}</a> : value}
      </Property.Value>
    </Property.Item>
  );
}

function display(value: ReactNode): ReactNode {
  return value === null || value === undefined || value === "" ? "–" : value;
}

function formatMicroseconds(value: number | null): string {
  if (value === null) return "–";
  if (value < 1_000) return `${value} µs`;
  if (value < 1_000_000) return `${Number((value / 1_000).toFixed(2))} ms`;
  return `${Number((value / 1_000_000).toFixed(2))} s`;
}

function formatBytes(value: number): string {
  if (Math.abs(value) < 1_024) return `${value} B`;
  if (Math.abs(value) < 1_048_576) return `${Number((value / 1_024).toFixed(2))} KiB`;
  return `${Number((value / 1_048_576).toFixed(2))} MiB`;
}

function formatSignedBytes(value: number): string {
  return `${value > 0 ? "+" : ""}${formatBytes(value)}`;
}
