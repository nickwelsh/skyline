/*!
 * Derived from Trigger.dev apps/webapp/app/components/primitives/charts/ChartCard.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: fullscreen controls are structurally omitted.
 */
import { type ReactNode } from "react";
import { Card, CardHeader } from "./Card";
import { cn } from "~/utils/cn";

export function ChartCard({ title, children, className }: { title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className="group h-full min-h-0 overflow-hidden">
      <Card className={cn("h-full overflow-hidden px-0 pb-2 pt-3", className)}>
        <CardHeader><div className="flex items-center gap-1.5">{title}</div></CardHeader>
        <div className="min-h-0 flex-1 px-2">{children}</div>
      </Card>
    </div>
  );
}
