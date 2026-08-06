/*!
 * Derived from Trigger.dev apps/webapp/app/components/metrics/ActivityBarChart.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 */
import { type ReactElement, type ReactNode } from "react";
import { BarChart, ReferenceLine, Tooltip, YAxis } from "recharts";
import { SimpleTooltip } from "~/components/primitives/Tooltip";

export const ACTIVITY_CHART_WIDTH = 112;
export const ACTIVITY_CHART_HEIGHT = 24;
export const ACTIVITY_CHART_PEAK_CLASS =
  "-mt-1 inline-block min-w-7 text-xxs tabular-nums text-text-dimmed";

type ActivityBarChartProps = {
  data: ReadonlyArray<Record<string, unknown>>;
  max: number;
  children: ReactNode;
  tooltip: ReactElement;
  peak: ReactNode;
  peakTooltip?: ReactNode;
  width?: number;
};

export function ActivityBarChart({
  data,
  max,
  children,
  tooltip,
  peak,
  peakTooltip,
  width = ACTIVITY_CHART_WIDTH,
}: ActivityBarChartProps) {
  return (
    <div className="flex items-start gap-1.5">
      <div className="rounded-sm" style={{ width, height: ACTIVITY_CHART_HEIGHT }}>
        <BarChart
          data={data as Record<string, unknown>[]}
          width={width}
          height={ACTIVITY_CHART_HEIGHT}
          margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
        >
          <YAxis domain={[0, max || 1]} hide />
          <Tooltip
            cursor={{ fill: "rgba(255, 255, 255, 0.06)" }}
            content={tooltip}
            allowEscapeViewBox={{ x: true, y: true }}
            wrapperStyle={{ zIndex: 1000 }}
            animationDuration={0}
          />
          {children}
          <ReferenceLine y={0} stroke="var(--color-border-bright)" strokeWidth={1} />
          {max > 0 ? (
            <ReferenceLine
              y={max}
              stroke="var(--color-border-brighter)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          ) : null}
        </BarChart>
      </div>
      <ActivityPeakLabel tooltip={peakTooltip}>{peak}</ActivityPeakLabel>
    </div>
  );
}

function ActivityPeakLabel({ tooltip, children }: { tooltip?: ReactNode; children: ReactNode }) {
  const label = <span className={ACTIVITY_CHART_PEAK_CLASS}>{children}</span>;
  return tooltip ? <SimpleTooltip asChild button={label} content={tooltip} /> : label;
}
