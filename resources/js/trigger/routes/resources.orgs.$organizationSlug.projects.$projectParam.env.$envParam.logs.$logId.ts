import type { LogEntry } from "~/presenters/v3/LogsListPresenter.server";

export declare function loader(): Promise<(LogEntry & { runStatus?: never }) | { error: string } | null>;
