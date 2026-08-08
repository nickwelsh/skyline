/*!
 * Exact from Trigger.dev packages/core/src/v3/utils/durations.ts
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 */
import type { Unit } from "humanize-duration";
import humanizeDuration from "humanize-duration";

function dateDifference(date1: Date, date2: Date) {
  return Math.abs(date1.getTime() - date2.getTime());
}

type DurationOptions = {
  style?: "long" | "short";
  maxDecimalPoints?: number;
  units?: Unit[];
  maxUnits?: number;
};

export function formatDuration(start?: Date | null, end?: Date | null, options?: DurationOptions): string {
  if (!start || !end) return "–";
  return formatDurationMilliseconds(dateDifference(start, end), options);
}

export function formatDurationMilliseconds(milliseconds: number, options?: DurationOptions): string {
  let duration = humanizeDuration(milliseconds, {
    units: options?.units ? options.units : milliseconds < 1000 ? ["ms"] : ["d", "h", "m", "s"],
    maxDecimalPoints: options?.maxDecimalPoints ?? 1,
    largest: options?.maxUnits ?? 2,
  });
  if (options?.style !== "short") return duration;
  return duration
    .replace(" milliseconds", "ms").replace(" millisecond", "ms")
    .replace(" seconds", "s").replace(" second", "s")
    .replace(" minutes", "m").replace(" minute", "m")
    .replace(" hours", "h").replace(" hour", "h")
    .replace(" days", "d").replace(" day", "d")
    .replace(" weeks", "w").replace(" week", "w")
    .replace(" months", "mo").replace(" month", "mo")
    .replace(" years", "y").replace(" year", "y");
}
