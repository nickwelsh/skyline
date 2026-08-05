import type {
  InspectorDto,
  JobDetailDto,
  JobRunsQuery,
  JobsPageDto,
  JobsQuery,
  RunsPageDto,
  RunsQuery,
  RunsUpdatesDto,
  SkylineDtoAdapter,
  TracePageDto,
} from "./dto";

type ApiErrorPayload = { error?: { code?: string; message?: string; correlationId?: string } };

export class SkylineApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly correlationId?: string,
  ) {
    super(message);
  }
}

export class HttpAdapter implements SkylineDtoAdapter {
  private readonly cache = new Map<string, { etag: string; value: unknown }>();

  constructor(private readonly basePath: string) {}

  jobs(query: JobsQuery = {}, signal?: AbortSignal): Promise<JobsPageDto> {
    return this.get<JobsPageDto>("api/jobs", this.jobsQuery(query), signal);
  }

  job(jobId: string, query: JobRunsQuery = {}, signal?: AbortSignal): Promise<JobDetailDto> {
    return this.get<JobDetailDto>(`api/jobs/${encodeURIComponent(jobId)}`, this.jobQuery(query), signal);
  }

  runs(query: RunsQuery = {}, signal?: AbortSignal): Promise<RunsPageDto> {
    return this.get<RunsPageDto>("api/runs", this.query(query), signal);
  }

  updates(query: RunsQuery, since: string, runIds: string[] = [], signal?: AbortSignal): Promise<RunsUpdatesDto> {
    const params = this.query(query);
    params.set("since", since);
    runIds.forEach((runId) => params.append("runIds[]", runId));

    return this.get<RunsUpdatesDto>("api/runs/updates", params, signal);
  }

  trace(runId: string, tableState?: string, signal?: AbortSignal): Promise<TracePageDto> {
    const params = new URLSearchParams();
    if (tableState) params.set("tableState", tableState);

    return this.get<TracePageDto>(`api/runs/${encodeURIComponent(runId)}`, params, signal);
  }

  inspector(nodeId: string, runId: string, signal?: AbortSignal): Promise<InspectorDto> {
    return this.get<{ node: InspectorDto }>(
      `api/runs/${encodeURIComponent(runId)}/nodes/${encodeURIComponent(nodeId)}`,
      new URLSearchParams(),
      signal,
    ).then((response) => response.node);
  }

  private query(query: RunsQuery): URLSearchParams {
    const params = new URLSearchParams();
    if (query.cursor) params.set("cursor", query.cursor);
    if (query.search) params.set("search", query.search);
    query.status?.forEach((status) => params.append("status[]", status));
    if (query.job) params.set("job", query.job);
    if (query.connection) params.set("connection", query.connection);
    if (query.queue) params.set("queue", query.queue);
    if (query.trace) params.set("trace", query.trace);
    if (query.rootOnly !== undefined) params.set("rootOnly", String(query.rootOnly));
    if (query.triggeredFrom) params.set("triggeredFrom", query.triggeredFrom);
    if (query.triggeredTo) params.set("triggeredTo", query.triggeredTo);
    return params;
  }

  private jobsQuery(query: JobsQuery): URLSearchParams {
    const params = new URLSearchParams();
    if (query.search) params.set("search", query.search);
    if (query.period) params.set("period", query.period);
    return params;
  }

  private jobQuery(query: JobRunsQuery): URLSearchParams {
    const params = new URLSearchParams();
    if (query.cursor) params.set("cursor", query.cursor);
    query.status?.forEach((status) => params.append("status[]", status));
    if (query.period) params.set("period", query.period);
    return params;
  }

  private async get<T>(path: string, params: URLSearchParams, signal?: AbortSignal): Promise<T> {
    const query = params.size ? `?${params}` : "";
    const url = `${this.basePath}/${path}${query}`;
    const cached = this.cache.get(url);
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(cached ? { "If-None-Match": cached.etag } : {}),
      },
      signal,
    });

    if (response.status === 304 && cached) return cached.value as T;

    if (!response.ok) {
      const payload = await response.json().catch((): ApiErrorPayload => ({})) as ApiErrorPayload;
      throw new SkylineApiError(
        response.status,
        payload.error?.code ?? "request_failed",
        payload.error?.message ?? "Skyline could not load telemetry.",
        payload.error?.correlationId,
      );
    }

    const value = await response.json() as T;
    const etag = response.headers.get("ETag");
    if (etag) this.cache.set(url, { etag, value });
    return value;
  }
}
