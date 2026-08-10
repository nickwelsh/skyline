import type { InspectorDto, RunStatus, TracePageDto } from "../../../resources/js/skyline/dto";

type RunStateTarget = TracePageDto | { node: InspectorDto };

export function applyRunState(target: RunStateTarget, status: RunStatus) {
  const active = status === "running";
  const failed = status === "failed";

  if ("run" in target) {
    if (active) {
      const representedEndUs = Math.max(1, ...target.trace.nodes.map((node) => node.offsetUs + (node.durationUs ?? 0)));
      target.trace.activeDurationUs = target.trace.activeDurationUs ?? target.trace.durationUs ?? representedEndUs;
      target.trace.durationUs = null;
      target.run.finishedAt = null;
      target.run.durationUs = null;
    }
    target.run.status = status;
    target.trace.rootStatus = active ? "executing" : failed ? "failed" : "completed";
    target.trace.polling = active;
    const root = target.trace.nodes.find((node) => node.parentId === null && node.kind === "run");
    if (root) applyRootNodeState(root, status);
    return target;
  }

  if (target.node.parentId === null && target.node.kind === "run") {
    applyRootNodeState(target.node, status);
  }
  return target;
}

function applyRootNodeState(node: InspectorDto | TracePageDto["trace"]["nodes"][number], status: RunStatus) {
  const active = status === "running";
  node.status = status;
  node.isPartial = active;
  node.isError = status === "failed";
  if (active) node.durationUs = null;
}
