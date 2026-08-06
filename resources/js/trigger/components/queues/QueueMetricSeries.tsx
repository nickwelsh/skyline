/*!
 * Derived from Trigger.dev QueueMetricCards chart treatment
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: static captured metric points replace live metric queries.
 */
import { useMemo } from "react";
import { buildActivityTimeAxis } from "~/components/primitives/charts/activityTimeAxis";
import {
  Chart,
  type ChartConfig,
  type ChartLineRendererProps,
} from "~/components/primitives/charts/ChartCompound";

export type QueueMetricSeriesConfig = { key: string; label: string; color: string };
export type QueueMetricPoint = { timestamp: string } & Record<string, string | number | null>;

export function QueueMetricSeries({
  title,
  points,
  series,
  valueFormat,
  warningOverlay,
  thresholdStroke,
  capabilityMarker,
}: {
  title: string;
  points: QueueMetricPoint[];
  series: QueueMetricSeriesConfig[];
  valueFormat?: (value: number) => string;
  warningOverlay?: ChartLineRendererProps["warningOverlay"];
  thresholdStroke?: ChartLineRendererProps["thresholdStroke"];
  capabilityMarker?: string;
}) {
  const data = useMemo(() => queueMetricSeriesData(points), [points]);
  const config = useMemo<ChartConfig>(() => Object.fromEntries(
    series.map((item) => [item.key, { label: item.label, color: item.color }]),
  ), [series]);
  const { tickFormatter, tooltipLabelFormatter } = useMemo(() => buildActivityTimeAxis(data), [data]);

  return (
    <div role="img" aria-label={`${title} chart`} data-skyline-capability={capabilityMarker} className="h-full">
      <Chart.Root config={config} data={data} dataKey="bucket" series={series.map((item) => item.key)} fillContainer>
        <Chart.Line
          lineType="monotone"
          xAxisProps={{ tickFormatter }}
          yAxisProps={valueFormat ? { tickFormatter: valueFormat } : undefined}
          tooltipLabelFormatter={tooltipLabelFormatter}
          tooltipValueFormatter={valueFormat}
          warningOverlay={warningOverlay}
          thresholdStroke={thresholdStroke}
        />
      </Chart.Root>
    </div>
  );
}

export function queueMetricSeriesData(points: QueueMetricPoint[]) {
  return points.flatMap(({ timestamp, ...values }) => {
    const bucket = Date.parse(timestamp);
    if (!Number.isFinite(bucket)) return [];
    return [{ bucket, ...values }];
  });
}
