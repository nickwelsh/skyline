import type { RunStatus } from "./dto";

export function queryValue(params: URLSearchParams, key: string) {
  return params.get(key) || undefined;
}

export function queryStatuses(params: URLSearchParams, key = "status"): RunStatus[] | undefined {
  const statuses = params.getAll(key).filter(isRunStatus);
  return statuses.length > 0 ? statuses : undefined;
}

export function compactQuery<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function isRunStatus(value: string): value is RunStatus {
  return ["queued", "running", "retrying", "completed", "failed"].includes(value);
}
