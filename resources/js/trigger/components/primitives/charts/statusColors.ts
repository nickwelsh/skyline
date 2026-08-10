/**
 * Derived from Trigger.dev apps/webapp/app/components/primitives/charts/statusColors.ts
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0; unreached Agent-session statuses omitted.
 */
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
