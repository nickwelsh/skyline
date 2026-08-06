import type { ExceptionDetails, InspectorDto, TracePageDto } from "../../../resources/js/skyline/dto";
import failureScenario from "../../browser/fixtures/nw-222-failure-scenario.json" with { type: "json" };

export type Nw222State =
  | "exception"
  | "exception-expanded"
  | "exception-long"
  | "exception-retry"
  | "exception-loading"
  | "exception-error"
  | "exception-unavailable";

const states = new Set<Nw222State>([
  "exception",
  "exception-expanded",
  "exception-long",
  "exception-retry",
  "exception-loading",
  "exception-error",
  "exception-unavailable",
]);

export function isNw222State(value: string): value is Nw222State {
  return states.has(value as Nw222State);
}

export function nw222TraceState(value: TracePageDto, state: Nw222State): TracePageDto {
  const detail = structuredClone(value);
  if (state !== "exception-retry") return detail;

  const retry = detail.attempts[1];
  if (!retry) throw new Error("NW-222 retry fixture lacks Attempt 2.");
  retry.status = "failed";
  retry.failure = { class: "LogicException", message: "Retry failed differently.", messageTruncated: false };
  const node = detail.trace.nodes.find((candidate) => candidate.id === retry.id);
  if (!node) throw new Error("NW-222 retry fixture lacks the Attempt 2 trace node.");
  node.status = "failed";
  node.isError = true;
  return detail;
}

export function nw222InspectorState(value: InspectorDto, nodeId: string, state: Nw222State): InspectorDto {
  const inspector = structuredClone(value);
  if (inspector.kind !== "attempt") return inspector;

  if (state === "exception-unavailable") {
    inspector.exception = null;
    return inspector;
  }

  if (state === "exception-retry" && nodeId.endsWith("_2")) {
    inspector.status = "failed";
    inspector.isError = true;
    inspector.exception = {
      class: "LogicException",
      message: "Retry failed differently.",
      messageTruncated: false,
      messageOriginalBytes: 25,
      code: null,
      location: null,
      frames: [],
      framesTruncated: false,
      markdown: "# LogicException - Job failed\n\nRetry failed differently.\n",
    };
    return inspector;
  }

  if (inspector.exception) inspector.exception = capturedException(state === "exception-long");
  return inspector;
}

function capturedException(long: boolean): ExceptionDetails {
  const exception = structuredClone(failureScenario.skylineException) as ExceptionDetails;
  if (!long) exception.frames = exception.frames.slice(0, 2);
  return exception;
}
