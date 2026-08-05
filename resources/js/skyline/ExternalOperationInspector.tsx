import type { ReactNode } from "react";
import {
  HtmlCapturePreview,
  JsonCapturePreview,
  TextCapturePreview,
} from "../trigger/CapturePreview";
import { Header3 } from "../trigger/components/primitives/Headers";
import * as Property from "../trigger/components/primitives/PropertyTable";
import type {
  CapturedValue,
  ExternalInspector,
  HttpMessageCapture,
  InspectorFailure,
  InspectorTiming,
  TextCapture,
} from "./InspectorPresentation";

export function ExternalOperationInspector({ inspector }: { inspector: ExternalInspector }) {
  const presentation = inspector.presentation;

  if (!presentation) return <GenericInspector inspector={inspector} />;

  switch (presentation.type) {
    case "http":
      return <HttpInspector inspector={inspector} />;
    case "delivery":
      return <DeliveryInspector inspector={inspector} />;
    case "storage":
      return <StorageInspector inspector={inspector} />;
    case "process":
      return <ProcessInspector inspector={inspector} />;
    case "breadcrumb":
      return <BreadcrumbInspector inspector={inspector} />;
    case "custom":
      return <CustomInspector inspector={inspector} />;
    case "summary":
      return <SummaryInspector inspector={inspector} />;
    case "generic":
      return <GenericInspector inspector={inspector} />;
  }
}

function HttpInspector({ inspector }: { inspector: ExternalInspector }) {
  const presentation = inspector.presentation;
  if (presentation?.type !== "http") return null;
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
      <JsonCapturePreview label="Context" value={inspector.overview} />
    </InspectorLayout>
  );
}

function DeliveryInspector({ inspector }: { inspector: ExternalInspector }) {
  const presentation = inspector.presentation;
  if (presentation?.type !== "delivery") return null;
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

function StorageInspector({ inspector }: { inspector: ExternalInspector }) {
  const presentation = inspector.presentation;
  if (presentation?.type !== "storage") return null;
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

function ProcessInspector({ inspector }: { inspector: ExternalInspector }) {
  const presentation = inspector.presentation;
  if (presentation?.type !== "process") return null;
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

function BreadcrumbInspector({ inspector }: { inspector: ExternalInspector }) {
  const presentation = inspector.presentation;
  if (presentation?.type !== "breadcrumb") return null;
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

function CustomInspector({ inspector }: { inspector: ExternalInspector }) {
  const presentation = inspector.presentation;
  if (presentation?.type !== "custom") return null;

  return (
    <InspectorLayout title="Custom operation" timing={presentation.timing} failure={presentation.failure}>
      <Property.Table><Item label="Name" value={presentation.custom.name} /></Property.Table>
      <JsonCapturePreview label="Attributes" value={presentation.custom.attributes} />
    </InspectorLayout>
  );
}

function SummaryInspector({ inspector }: { inspector: ExternalInspector }) {
  const presentation = inspector.presentation;
  if (presentation?.type !== "summary") return null;
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

function GenericInspector({ inspector }: { inspector: ExternalInspector }) {
  const timing = inspector.presentation?.type === "generic" ? inspector.presentation.timing : undefined;
  const failure = inspector.presentation?.type === "generic" ? inspector.presentation.failure : undefined;

  return (
    <InspectorLayout title="Recorded operation" timing={timing} failure={failure}>
      {inspector.detailSections.length > 0
        ? inspector.detailSections.map((section) => <JsonCapturePreview key={section.label} label={section.label} value={section.value} />)
        : <JsonCapturePreview label="Recorded properties" value={inspector.metadata.value} truncated={inspector.metadata.isTruncated} />}
    </InspectorLayout>
  );
}

function InspectorLayout({ title, timing, failure, children }: { title: string; timing?: InspectorTiming; failure?: InspectorFailure; children: ReactNode }) {
  return (
    <section aria-label={`${title} detail`} className="flex min-w-0 flex-col gap-4">
      <Header3>{title}</Header3>
      {timing && (
        <Property.Table>
          <Item label="Started" value={timing.startedAt} />
          <Item label="Finished" value={timing.endedAt} />
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

function Item({ label, value, breakWords = false }: { label: string; value: unknown; breakWords?: boolean }) {
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

function display(value: unknown): string {
  return value === null || value === undefined || value === "" ? "–" : String(value);
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
