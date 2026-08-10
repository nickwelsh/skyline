/*!
 * Adapted from Trigger.dev apps/webapp/app/components/runs/v3/LiveTimer.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Host adaptation: local duration utility.
 */
import { useEffect, useState } from "react";
import { formatDuration } from "~/utils/durations";

export function LiveTimer({ startTime, endTime, updateInterval = 250 }: { startTime: Date; endTime?: Date; updateInterval?: number }) {
  const [now, setNow] = useState<Date>();

  useEffect(() => {
    const interval = window.setInterval(() => {
      const date = new Date();
      setNow(date);
      if (endTime && date > endTime) window.clearInterval(interval);
    }, updateInterval);
    return () => window.clearInterval(interval);
  }, [endTime, startTime, updateInterval]);

  return <>{formatDuration(startTime, endTime ?? now, { style: "short", maxDecimalPoints: 0, units: ["d", "h", "m", "s"] })}</>;
}
