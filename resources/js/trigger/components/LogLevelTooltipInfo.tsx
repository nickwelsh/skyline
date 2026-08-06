/*!
 * Trigger.dev LogLevelTooltipInfo at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 */
import { Header3 } from "./primitives/Headers";
import { Paragraph } from "./primitives/Paragraph";
import { LogLevel } from "./logs/LogLevel";

export function LogLevelTooltipInfo() {
  return (
    <div className="flex max-w-xs flex-col gap-4 p-1 pb-2">
      <div><Header3>Log Levels</Header3><Paragraph variant="small" className="text-text-dimmed">Structured logging helps you debug and monitor your tasks.</Paragraph></div>
      <Level level="TRACE">Traces and spans representing the execution flow of your tasks.</Level>
      <Level level="INFO">General informational messages about task execution.</Level>
      <Level level="WARN">Warning messages indicating potential issues that don&apos;t prevent execution.</Level>
      <Level level="ERROR">Error messages for failures and exceptions during task execution.</Level>
      <Level level="DEBUG">Detailed diagnostic information for development and debugging.</Level>
    </div>
  );
}

function Level({ level, children }: { level: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR"; children: React.ReactNode }) {
  return <div><div className="mb-1"><LogLevel level={level} /></div><Paragraph variant="small" className="text-text-dimmed">{children}</Paragraph></div>;
}
