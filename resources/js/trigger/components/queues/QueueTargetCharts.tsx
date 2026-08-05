/*!
 * Derived from Trigger.dev QueueMetricCards chart treatment
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: static observed Run/Queue-time series, no live broker metrics.
 */
import { Header3 } from "~/components/primitives/Headers";

type Point = { timestamp: string };

export function QueueTargetCharts({
  activity,
  queueTime,
}: {
  activity: Array<Point & { recordedRuns: number }>;
  queueTime: Array<Point & { sampleCount: number; medianUs: number; p95Us: number; maximumUs: number }>;
}) {
  return (
    <section aria-label="Queue-target activity" className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
      <SeriesCard title="Recorded Run activity" points={activity.map((point) => ({ ...point, value: point.recordedRuns }))} color="var(--color-queues-chart)" />
      <SeriesCard
        title="Queue time"
        points={queueTime.map((point) => ({ ...point, value: point.p95Us }))}
        color="var(--color-queues-chart-ref)"
        insufficient={queueTime.reduce((total, point) => total + point.sampleCount, 0) < 2}
      />
    </section>
  );
}

function SeriesCard({
  title,
  points,
  color,
  insufficient = false,
}: {
  title: string;
  points: Array<Point & { value: number }>;
  color: string;
  insufficient?: boolean;
}) {
  const path = line(points.map((point) => point.value));
  return (
    <figure className="h-52 rounded-lg border border-grid-bright bg-background-bright p-3">
      <Header3>{title}</Header3>
      {points.length === 0 ? (
        <div className="grid h-36 place-items-center text-xs text-text-dimmed">No recorded activity</div>
      ) : (
        <svg role="img" aria-label={`${title} chart`} viewBox="0 0 400 128" className="h-32 w-full overflow-visible">
          <title>{title}</title>
          <line x1="0" x2="400" y1="126" y2="126" stroke="var(--color-grid-bright)" />
          <polyline points={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {insufficient && <figcaption className="text-xs text-text-dimmed">Insufficient samples for a queue-time trend.</figcaption>}
    </figure>
  );
}

function line(values: number[]) {
  const maximum = Math.max(...values, 1);
  return values.map((value, index) => {
    const x = values.length === 1 ? 200 : (index / (values.length - 1)) * 400;
    const y = 124 - (value / maximum) * 112;
    return `${x},${y}`;
  }).join(" ");
}
