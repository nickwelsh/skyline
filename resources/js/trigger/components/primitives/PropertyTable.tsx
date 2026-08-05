/*!
 * Adapted from Trigger.dev apps/webapp/app/components/primitives/PropertyTable.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: local cn import only.
 */
import { type ReactNode } from "react";
import { cn } from "../../utils/cn";

type ChildrenClassName = {
  children: ReactNode;
  className?: string;
};

function PropertyTable({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-y-3", className)}>{children}</div>;
}

function PropertyItem({ children, className }: ChildrenClassName) {
  return <div className={cn("flex flex-col gap-0 text-sm", className)}>{children}</div>;
}

function PropertyLabel({ children, className }: ChildrenClassName) {
  return <div className={cn("font-medium text-text-bright", className)}>{children}</div>;
}

function PropertyValue({ children, className }: ChildrenClassName) {
  return <div className={cn("text-text-dimmed", className)}>{children}</div>;
}

export {
  PropertyItem as Item,
  PropertyLabel as Label,
  PropertyTable as Table,
  PropertyValue as Value,
};
