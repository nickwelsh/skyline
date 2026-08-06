declare module "@trigger.dev/database" {
  export type TaskRunStatus =
    | "queued"
    | "running"
    | "retrying"
    | "completed"
    | "failed";
}
