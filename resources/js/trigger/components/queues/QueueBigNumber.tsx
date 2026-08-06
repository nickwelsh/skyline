/*!
 * Adapted from Trigger.dev components/metrics/BigNumber.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline keeps source card geometry over externally captured values.
 */
import { Header3 } from "~/components/primitives/Headers";
import type { ReactNode } from "react";

export function QueueBigNumber({
  title,
  value,
  formattedValue,
  suffix,
  capabilityMarker,
}: {
  title: ReactNode;
  value?: number | null;
  formattedValue?: ReactNode;
  suffix?: ReactNode;
  capabilityMarker?: string;
}) {
  return (
    <div className="group flex flex-col justify-between gap-4 rounded-lg border border-grid-bright bg-background-bright pb-4 pl-4 pr-3 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Header3 className="leading-6">{title}</Header3>
      </div>
      <div data-skyline-capability={capabilityMarker} className="text-[3.75rem] font-normal tabular-nums leading-none text-text-bright">
        <div className="flex flex-wrap items-baseline gap-2">
          {formattedValue ?? (value == null ? "–" : value.toLocaleString())}
          {suffix && <div className="text-xs tabular-nums text-text-dimmed">{suffix}</div>}
        </div>
      </div>
    </div>
  );
}
