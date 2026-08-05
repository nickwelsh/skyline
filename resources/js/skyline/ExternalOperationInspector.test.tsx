import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ExternalOperationInspector } from "./ExternalOperationInspector";
import type { RunDetailInspector } from "./RunDetailAdapter";

describe("ExternalOperationInspector", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("presents captured HTTP evidence without implying missing response headers", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);
    const inspector = {
      overview: { runId: "run-1", attemptNumber: 1, traceId: "trace-1", spanId: "span-1" },
      presentation: {
        type: "http",
        timing: { startedAt: "2026-08-05T12:00:00.000000000Z", endedAt: "2026-08-05T12:00:00.125000000Z", durationUs: 125_000 },
        failure: null,
        http: {
          method: "POST",
          url: "https://api.example.test/people",
          statusCode: 201,
          request: {
            headers: { items: { Accept: ["application/json"] }, truncated: false },
            body: { value: '{"name":"Laravel"}', contentType: "application/json", originalBytes: 18, truncated: false, isJson: true, json: { name: "Laravel" } },
          },
          response: { headers: null, body: null },
        },
      },
      detailSections: [],
      metadata: { value: {}, isTruncated: false, truncated: [] },
    } as unknown as RunDetailInspector;

    flushSync(() => root.render(<ExternalOperationInspector inspector={inspector} />));

    expect(container.textContent).toContain("POST");
    expect(container.textContent).toContain("201");
    expect(container.textContent).toContain("125 ms");
    expect(container.textContent).toContain("Response headers not captured");
    expect(container.textContent).toContain("Response body not captured");
    expect(container.querySelector('button[aria-label="Wrap Request body"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Copy Request body"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Expand Request body"]')).not.toBeNull();

    flushSync(() => root.unmount());
  });

  it("presents delivery evidence without inventing recipient or provider state", () => {
    const { container, root } = renderInspector({
      type: "delivery",
      timing: timing(),
      failure: null,
      delivery: {
        kind: "notification",
        messageType: "App\\Notifications\\InvoiceReady",
        transportOrChannel: "slack",
        recipientCount: 1,
        outcome: "sent",
        recipients: null,
        recipientIdentity: { type: "object", value: { id: 42 }, originalBytes: 9, truncated: false },
        subject: null,
        text: null,
        html: null,
        messageData: null,
        operationData: { type: "array", value: { route: "billing" }, originalBytes: 19, truncated: false },
      },
    });

    expect(container.textContent).toContain("Notification delivery");
    expect(container.textContent).toContain("Recipients not captured");
    expect(container.textContent).toContain("Subject not captured");
    expect(container.textContent).toContain("slack");
    expect(container.querySelector('button[aria-label="Copy Operation data"]')).not.toBeNull();

    flushSync(() => root.unmount());
  });

  it("presents recorded storage targets, results, content, and failure", () => {
    const { container, root } = renderInspector({
      type: "storage",
      timing: timing(),
      failure: { type: "League\\Flysystem\\UnableToReadFile", message: "Unable to read file" },
      storage: {
        operation: "read",
        disk: "documents",
        driver: "local",
        path: "private/report.txt",
        pathCaptured: true,
        destination: null,
        destinationCaptured: false,
        bytes: 2048,
        outcome: "failed",
        url: null,
        destinationUrl: null,
        localFile: { path: "/srv/app/storage/private/report.txt", href: "vscode://file//srv/app/storage/private/report.txt:1" },
        destinationLocalFile: null,
        content: { type: "string", value: "captured content", originalBytes: 16, truncated: false },
        result: { exists: null, lastModified: null, mimeType: null, visibility: null },
      },
    });

    expect(container.textContent).toContain("private/report.txt");
    expect(container.textContent).toContain("Unable to read file");
    expect(container.querySelector('a[href="vscode://file//srv/app/storage/private/report.txt:1"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Expand Content"]')).not.toBeNull();

    flushSync(() => root.unmount());
  });

  it("presents process command, result, and independently controlled streams", () => {
    const { container, root } = renderInspector({
      type: "process",
      timing: timing(),
      failure: null,
      process: {
        executable: "php",
        async: false,
        timeoutSeconds: 10,
        exitCode: 0,
        timedOut: false,
        outcome: "completed",
        command: captured(["php", "artisan", "queue:work"]),
        environment: null,
        input: null,
        stdout: captured("processed 100 records"),
        stderr: captured("warning"),
      },
    });

    expect(container.textContent).toContain("Process operation");
    expect(container.textContent).toContain("Environment not captured");
    expect(container.querySelector('button[aria-label="Wrap Standard output"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Wrap Standard error"]')).not.toBeNull();

    flushSync(() => root.unmount());
  });

  it("does not present uncaptured process flags as confirmed false", () => {
    const { container, root } = renderInspector({
      type: "process",
      timing: timing(),
      failure: null,
      process: {
        executable: "php",
        async: null,
        timeoutSeconds: null,
        exitCode: null,
        timedOut: null,
        outcome: null,
        command: null,
        environment: null,
        input: null,
        stdout: null,
        stderr: null,
      },
    });

    expect(container.textContent).toContain("ModeNot captured");
    expect(container.textContent).toContain("Timed outNot captured");
    expect(container.textContent).not.toContain("Synchronous");

    flushSync(() => root.unmount());
  });

  it("preserves breadcrumb, custom, summary, and generic source treatments", () => {
    const cases = [
      {
        presentation: { type: "breadcrumb", breadcrumb: { timestamp: "2026-08-05T12:00:00.000000000Z", level: "warning", channel: "stack", message: "Import delayed", context: { code: 429 } } },
        expected: ["Breadcrumb", "Import delayed", "429"],
      },
      {
        presentation: { type: "custom", timing: timing(), failure: null, custom: { name: "Generate PDF", attributes: { pages: 12 } } },
        expected: ["Custom operation", "Generate PDF", "12"],
      },
      {
        presentation: { type: "summary", summary: { resources: { peakMemoryBytes: 1_048_576, memoryDeltaBytes: 1024, cpuTimeUs: 1250 }, operations: { http: { count: 2, durationMs: 25 } } } },
        expected: ["Resource summary", "1 MiB", "+1 KiB", "http"],
      },
      {
        presentation: { type: "generic", timing: timing(), failure: null },
        expected: ["Recorded operation", "recorded"],
      },
    ] as const;

    for (const scenario of cases) {
      const { container, root } = renderInspector(scenario.presentation, { recorded: true });
      for (const expected of scenario.expected) expect(container.textContent).toContain(expected);
      flushSync(() => root.unmount());
    }
  });
});

function renderInspector(presentation: RunDetailInspector["presentation"], metadata: Record<string, unknown> = {}) {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.querySelector<HTMLDivElement>("#root")!;
  const root = createRoot(container);
  const inspector = {
    overview: { runId: "run-1", attemptNumber: 1, traceId: "trace-1", spanId: "span-1" },
    presentation,
    detailSections: [],
    metadata: { value: metadata, isTruncated: false, truncated: [] },
  } as unknown as RunDetailInspector;
  flushSync(() => root.render(<ExternalOperationInspector inspector={inspector} />));
  return { container, root };
}

function timing() {
  return { startedAt: "2026-08-05T12:00:00.000000000Z", endedAt: "2026-08-05T12:00:00.125000000Z", durationUs: 125_000 };
}

function captured(value: unknown) {
  return { type: Array.isArray(value) ? "array" : "string", value, originalBytes: JSON.stringify(value).length, truncated: false };
}
