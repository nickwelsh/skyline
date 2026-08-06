export type QueueUrlApplication = "trigger" | "skyline";

const observedConnections = new Set(["database", "redis", "sqs"]);

export function normalizeQueueFilterUrl(value: string, application: QueueUrlApplication) {
  const url = new URL(value, "https://fidelity.invalid");
  if (url.pathname !== "/queues") return canonical(url);

  const query = url.searchParams.getAll("query");
  const search = url.searchParams.getAll("search");
  const connection = url.searchParams.getAll("connection");
  const invalid = application === "trigger"
    ? search.length > 0 || connection.length > 0 || query.length > 1 || query.some((entry) => entry.trim().length === 0)
    : query.length > 0 || search.length > 1 || search.some((entry) => entry.trim().length === 0)
      || connection.length > 1 || connection.some((entry) => !observedConnections.has(entry));

  if (invalid) return `invalid-${application}-queue-filter:${canonical(url)}`;

  if (application === "trigger" && query.length === 1) {
    url.searchParams.delete("query");
    url.searchParams.set("search", query[0]);
  }
  if (application === "skyline" && connection.length === 1) url.searchParams.delete("connection");
  return canonical(url);
}

function canonical(url: URL) {
  url.searchParams.sort();
  return `${url.pathname}${url.search}${url.hash}`;
}
