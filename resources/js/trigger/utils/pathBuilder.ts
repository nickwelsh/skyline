export function v3RunSpanPath(
  _organization: unknown,
  _project: unknown,
  _environment: unknown,
  run: { friendlyId: string },
  _span: { spanId: string },
) {
  return `/runs/${encodeURIComponent(run.friendlyId)}`;
}
