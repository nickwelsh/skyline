import type { LogLevelValue } from "~/components/logs/LogLevel";

export type LogEntry = {
  id: string;
  runId: string;
  taskIdentifier: string;
  spanId: string;
  triggeredTimestamp: string;
  level: LogLevelValue;
  message: string;
  attributes?: Record<string, unknown>;
};
