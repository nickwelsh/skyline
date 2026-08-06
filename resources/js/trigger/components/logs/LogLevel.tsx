/*!
 * Adapted from Trigger.dev apps/webapp/app/components/logs/LogLevel.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * The external contract supplies the pinned display-level union.
 */
import { cn } from "~/utils/cn";

export type LogLevelValue = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR";

export function LogLevel({ level }: { level: LogLevelValue }) {
  return (
    <span className={cn("inline-flex items-center rounded border px-1 py-0.5 text-xxs font-medium uppercase tracking-wider", levelColor(level))}>
      {level}
    </span>
  );
}

function levelColor(level: LogLevelValue): string {
  switch (level) {
    case "ERROR": return "text-error bg-error/10 border-error/20";
    case "WARN": return "text-warning bg-warning/10 border-warning/20";
    case "TRACE": return "text-purple-400 bg-purple-500/10 border-purple-500/20";
    case "DEBUG": return "text-charcoal-400 bg-charcoal-700 border-charcoal-600";
    case "INFO": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  }
}
