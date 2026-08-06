import type { ReactNode } from "react";
import {
  HtmlCapturePreview,
  JsonCapturePreview,
  SqlCapturePreview,
  TextCapturePreview,
} from "../trigger/CapturePreview";
import { Header3 } from "../trigger/components/primitives/Headers";
import { DateTimeAccurate } from "../trigger/components/primitives/DateTime";
import * as Property from "../trigger/components/primitives/PropertyTable";
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

export function ExternalOperationInspector({ inspector }: { inspector: ExternalInspector }) {
  const presentation = inspector.presentation;

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

function SqlInspector({ presentation }: { presentation: PresentationOf<"sql"> }) {
  const { statement, bindings, result } = presentation.sql;

  return (
    <InspectorLayout title="SQL query" timing={presentation.timing} failure={presentation.failure} extensionId="database-state-operation-inspector">
      <SqlCapturePreview
        sql={statement.value}
        bindings={bindings?.items}
        sqlTruncated={statement.isTruncated}
        bindingsTruncated={bindings?.truncated}
      />
      {!bindings && <Unavailable>Bindings not captured</Unavailable>}
      {result
        ? <JsonCapturePreview label="Result preview" value={result} truncated={result.truncated} summary={result.kind === "rows" ? `${result.rowCount.toLocaleString()} rows` : `${result.affectedRows.toLocaleString()} affected`} />
        : <Unavailable>Result not captured</Unavailable>}
    </InspectorLayout>
  );
}

function TransactionInspector({ presentation }: { presentation: PresentationOf<"transaction"> }) {
  const { transaction } = presentation;

  return (
    <InspectorLayout title="Database transaction" timing={presentation.timing} failure={presentation.failure} extensionId="database-state-operation-inspector">
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
    <InspectorLayout title="Cache operation" timing={presentation.timing} failure={presentation.failure} extensionId="database-state-operation-inspector">
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
    <InspectorLayout title="Redis command" timing={presentation.timing} failure={presentation.failure} extensionId="database-state-operation-inspector">
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

  return (
    <InspectorLayout title="HTTP request" timing={presentation.timing} failure={presentation.failure}>
      <Property.Table>
        <Item label="Method" value={http.method} />
        <Item label="URL" value={http.url} breakWords />
        <Item label="Status" value={http.statusCode} />
      </Property.Table>
      <MessageCapture title="Request" capture={http.request} />
      <MessageCapture title="Response" capture={http.response} />
      <JsonCapturePreview label="Context" value={overview} />
    </InspectorLayout>
  );
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
        ? <JsonCapturePreview label="Recipients" value={delivery.recipients} />
        : <Unavailable>Recipients not captured</Unavailable>}
      <CapturedValuePreview label="Recipient identity" capture={delivery.recipientIdentity} />
      <TextPreview label="Subject" capture={delivery.subject} />
      <TextPreview label="Text body" capture={delivery.text} />
      {delivery.html
        ? <HtmlCapturePreview label="HTML body" value={delivery.html.value} truncated={delivery.html.truncated} />
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
      <JsonCapturePreview label="Recorded result" value={storage.result} />
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
      <TextCapturePreview label="Message" value={breadcrumb.message} />
      <JsonCapturePreview label="Context" value={breadcrumb.context} />
    </section>
  );
}

function CustomInspector({ presentation }: { presentation: PresentationOf<"custom"> }) {
  return (
    <InspectorLayout title="Custom operation" timing={presentation.timing} failure={presentation.failure}>
      <Property.Table><Item label="Name" value={presentation.custom.name} /></Property.Table>
      <JsonCapturePreview label="Attributes" value={presentation.custom.attributes} />
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
      <JsonCapturePreview label="Operations" value={operations} />
    </section>
  );
}

function GenericInspector({ inspector, presentation }: { inspector: ExternalInspector; presentation?: PresentationOf<"generic"> }) {
  return (
    <InspectorLayout title="Recorded operation" timing={presentation?.timing} failure={presentation?.failure}>
      {inspector.detailSections.length > 0
        ? inspector.detailSections.map((section) => <JsonCapturePreview key={section.label} label={section.label} value={section.value} />)
        : <JsonCapturePreview label="Recorded properties" value={inspector.metadata.value} truncated={inspector.metadata.isTruncated} />}
    </InspectorLayout>
  );
}

function InspectorLayout({ title, timing, failure, extensionId, children }: { title: string; timing?: InspectorTiming; failure?: InspectorFailure; extensionId?: string; children: ReactNode }) {
  return (
    <section aria-label={`${title} detail`} data-skyline-extension={extensionId} className="flex min-w-0 flex-col gap-4">
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
          <div className="font-medium text-error">{failure.type ?? "Operation failed"}</div>
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
        ? <JsonCapturePreview label={`${title} headers`} value={capture.headers.items} truncated={capture.headers.truncated} />
        : <Unavailable>{title} headers not captured</Unavailable>}
      {capture.body
        ? capture.body.isJson
          ? <JsonCapturePreview label={`${title} body`} value={capture.body.json ?? capture.body.value} truncated={capture.body.truncated} summary={capture.body.contentType ?? undefined} />
          : <TextCapturePreview label={`${title} body`} value={capture.body.value} truncated={capture.body.truncated} summary={capture.body.contentType ?? undefined} />
        : <Unavailable>{title} body not captured</Unavailable>}
    </section>
  );
}

function CapturedValuePreview({ label, capture }: { label: string; capture: CapturedValue | null }) {
  return capture
    ? <JsonCapturePreview label={label} value={capture.value} truncated={capture.truncated} summary={capture.type} />
    : <Unavailable>{label} not captured</Unavailable>;
}

function TextPreview({ label, capture }: { label: string; capture: TextCapture | null }) {
  return capture
    ? <TextCapturePreview label={label} value={capture.value} truncated={capture.truncated} />
    : <Unavailable>{label} not captured</Unavailable>;
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
