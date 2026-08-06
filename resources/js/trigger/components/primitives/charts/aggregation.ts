/*!
 * Adapted from Trigger.dev components/primitives/charts/aggregation.ts
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 */
export type AggregationType = "sum" | "avg" | "count" | "min" | "max";

/**
 * Aggregate an array of numbers using the specified aggregation function.
 *
 * Shared utility so both QueryResultsChart (data transformation) and chart
 * legend components can reuse the same logic without circular imports.
 */
export function aggregateValues(values: number[], aggregation: AggregationType): number {
  if (values.length === 0) return 0;
  switch (aggregation) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "count":
      return values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
  }
}
