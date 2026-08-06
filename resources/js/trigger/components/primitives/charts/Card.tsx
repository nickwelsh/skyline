/*!
 * Derived from Trigger.dev apps/webapp/app/components/primitives/charts/Card.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 */
import { type ReactNode } from "react";
import { Header3 } from "../Headers";
import { cn } from "~/utils/cn";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col rounded-lg border border-grid-bright bg-background-bright pb-1.5 pt-3", className)}>{children}</div>;
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <Header3 className="mb-3 flex items-start justify-between gap-2 pl-4 pr-3">{children}</Header3>;
}
