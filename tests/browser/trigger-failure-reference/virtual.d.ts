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

declare module "virtual:pinned-trigger-state-inspector" {
  export function PinnedTriggerStateInspector({ scenario }: {
    scenario: "sql-captured" | "transaction-committed" | "cache-long" | "redis-truncated";
  }): React.JSX.Element;
}
