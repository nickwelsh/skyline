/*!
 * Adapted from Trigger.dev apps/webapp/app/components/primitives/BreadcrumbIcon.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: local cn import only.
 */
import { cn } from "../../utils/cn";

export function BreadcrumbIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("text-border-bright", className)}
      width="9"
      height="20"
      viewBox="0 0 9 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <line
        x1="9"
        y1="0.7"
        x2="0.7"
        y2="25"
        strokeWidth={1.4}
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}
