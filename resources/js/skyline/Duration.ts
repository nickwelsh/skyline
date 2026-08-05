export function formatDuration(microseconds: number | null | undefined): string {
  if (microseconds === null || microseconds === undefined) return "—";
  if (microseconds < 1_000) return `${microseconds}µs`;
  const milliseconds = microseconds / 1_000;
  if (milliseconds < 1_000) return `${milliseconds.toFixed(milliseconds >= 100 ? 0 : 2)}ms`;
  return `${(milliseconds / 1_000).toFixed(milliseconds >= 10_000 ? 1 : 2)}s`;
}
