declare module "virtual:pinned-trigger-run-error" {
  export function PinnedTriggerRunError({ error }: {
    error: {
      type: "BUILT_IN_ERROR";
      name: string;
      message: string;
      stackTrace: string;
    };
  }): React.JSX.Element;
}

declare module "virtual:pinned-trigger-errors" {
  export function PinnedTriggerErrors({
    scenario,
    detail,
  }: {
    scenario: Record<string, unknown>;
    detail: boolean;
  }): React.JSX.Element;
}

declare module "virtual:pinned-trigger-state-inspector" {
  export function PinnedTriggerStateInspector({ scenario }: {
    scenario: "sql-captured" | "transaction-committed" | "cache-long" | "redis-truncated";
  }): React.JSX.Element;
}

declare module "virtual:pinned-trigger-logs" {
  import type { ComponentType } from "react";
  export const PinnedTriggerLogs: ComponentType<{ logs: Array<{ id: string; runId: string; taskIdentifier: string; spanId: string; triggeredTimestamp: string; level: string; message: string; attributes: Record<string, unknown> }> }>;
}
