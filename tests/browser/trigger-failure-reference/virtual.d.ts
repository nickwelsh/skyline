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

declare module "virtual:pinned-trigger-logs-table" {
  import type { ComponentType } from "react";
  type Log = { id: string; runId: string; taskIdentifier: string; spanId: string; triggeredTimestamp: string; level: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR"; message: string; attributes: Record<string, unknown> };
  export const PinnedTriggerLogsTable: ComponentType<{ logs: Log[]; selectedLogId?: string; onLogSelect: (id: string) => void }>;
}

declare module "virtual:pinned-trigger-shell" {
  export function PinnedTriggerShortcuts(props: { open: boolean }): JSX.Element | null;
}

declare module "virtual:pinned-trigger-side-menu-section" {
  import type { ComponentType, ReactNode } from "react";
  export const SideMenuSection: ComponentType<{ title: string; children: ReactNode }>;
}

declare module "virtual:pinned-trigger-customize-sidebar" {
  import type { ComponentType } from "react";
  export const CustomizeSidebarDialog: ComponentType<{
    sections: Array<{ id: string; title: string; items: Array<{ id: string; name: string; icon: ComponentType<{ className?: string }> }> }>;
    prefs: { hiddenItems: Record<string, boolean> };
    onConfirm: (payload: { hiddenItems: Record<string, boolean> | null }) => void;
    isConfirming: boolean;
  }>;
}

declare module "virtual:pinned-trigger-log-detail" {
  import type { ComponentType } from "react";
  type Log = { id: string; runId: string; taskIdentifier: string; spanId: string; triggeredTimestamp: string; level: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR"; message: string; attributes: Record<string, unknown> };
  export const PinnedTriggerLogDetail: ComponentType<{ log: Log; onClose: () => void }>;
}
