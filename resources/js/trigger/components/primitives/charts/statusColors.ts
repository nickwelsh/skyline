/** Shared status → color map for the task activity chart. */
export const STATUS_COLOR: Record<string, string> = {
  COMPLETED: "var(--color-success)",
  RUNNING: "var(--color-pending)",
  FAILED: "var(--color-error)",
  CANCELED: "var(--color-text-dimmed)",
};

export const STATUS_COLOR_FALLBACK = "var(--color-text-dimmed)";

export function statusColor(status: string): string {
  return STATUS_COLOR[status] ?? STATUS_COLOR_FALLBACK;
}
