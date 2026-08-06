import type { InspectorDto, TracePageDto } from "../../../resources/js/skyline/dto";

type TriggerRunResource = {
  type: "run";
  run: Record<string, unknown>;
  queueMetrics?: unknown;
};

type TriggerSpanResource = {
  type: "span";
  span: Record<string, unknown>;
};

export function triggerRunInspectorResources(
  detail: TracePageDto,
  inspectors: Record<string, InspectorDto>,
  baseRunResource: TriggerRunResource,
): Record<string, TriggerRunResource | TriggerSpanResource> {
  return Object.fromEntries(detail.trace.nodes.map((node) => {
    const inspector = inspectors[node.id];
    if (!inspector) throw new Error(`Missing Trigger reference inspector fixture: ${node.id}`);

    if (node.kind === "run" && node.runId === detail.run.id) {
      return [node.id, structuredClone(baseRunResource)];
    }

    if (node.kind === "attempt" && inspector.exception) {
      const attempt = detail.attempts.find((candidate) => candidate.id === node.id);
      if (!attempt) throw new Error(`Missing Trigger reference Attempt fixture: ${node.id}`);
      return [node.id, failedAttemptResource(baseRunResource, attempt, inspector.exception)];
    }

    return [node.id, spanResource(detail, inspector)];
  }));
}

function failedAttemptResource(
  base: TriggerRunResource,
  attempt: TracePageDto["attempts"][number],
  exception: NonNullable<InspectorDto["exception"]>,
): TriggerRunResource {
  return {
    ...structuredClone(base),
    run: {
      ...structuredClone(base.run),
      status: "COMPLETED_WITH_ERRORS",
      isFinished: true,
      isRunning: false,
      isError: true,
      startedAt: attempt.startedAt,
      executedAt: attempt.startedAt,
      updatedAt: attempt.finishedAt ?? attempt.startedAt,
      completedAt: attempt.finishedAt,
      error: {
        type: "BUILT_IN_ERROR",
        name: exception.class,
        message: exception.message,
        stackTrace: stackTrace(exception),
      },
    },
  };
}

function spanResource(detail: TracePageDto, inspector: InspectorDto): TriggerSpanResource {
  const rootStartedAt = Date.parse(detail.trace.rootStartedAt ?? detail.run.startedAt ?? detail.run.triggeredAt);
  const evidence = inspector.presentation ?? inspector.metadata.value;
  const properties = evidence && typeof evidence === "object"
    ? JSON.stringify(evidence, null, 2)
    : undefined;

  return {
    type: "span",
    span: {
      spanId: inspector.id,
      parentId: inspector.parentId ?? null,
      message: inspector.label,
      isError: inspector.isError,
      isPartial: inspector.isPartial,
      isCancelled: false,
      level: inspector.logLevel ?? "TRACE",
      startTime: new Date(rootStartedAt + inspector.offsetUs / 1_000).toISOString(),
      duration: (inspector.durationUs ?? 0) * 1_000,
      events: inspector.timelineEvents.map((event) => ({
        name: event.name,
        time: new Date(rootStartedAt + event.offsetUs / 1_000).toISOString(),
        properties: {},
      })),
      style: { icon: inspector.kind === "query" ? "database" : inspector.kind, variant: inspector.isError ? "failed" : "primary" },
      properties,
      resourceProperties: undefined,
      entity: inspector.kind === "attempt" ? { type: "attempt", object: {} } : null,
      metadata: undefined,
      triggeredRuns: [],
      aiData: undefined,
    },
  };
}

function stackTrace(exception: NonNullable<InspectorDto["exception"]>) {
  return exception.frames.map((frame) => {
    const location = `${frame.file}:${frame.line ?? "?"}`;
    const call = frame.class && frame.type ? `${frame.class}${frame.type}${frame.function}` : frame.function;
    return call ? `${location} ${call}` : location;
  }).join("\n");
}
