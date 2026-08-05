/*!
 * Derived from Trigger.dev apps/webapp/app/components/primitives/Popover.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Narrowed to the run-view popover root, trigger, content, and arrow trigger.
 */
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";

import { DropdownIcon } from "../../assets/icons/DropdownIcon";
import { cn } from "../../utils/cn";
import { Paragraph } from "./Paragraph";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      avoidCollisions={true}
      className={cn(
        "z-50 min-w-max rounded border border-grid-bright bg-background-bright p-4 shadow-md outline-hidden animate-in data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      style={{
        maxHeight: "var(--radix-popover-content-available-height)",
      }}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

const popoverArrowTriggerVariants = {
  minimal: {
    trigger: "text-text-dimmed hover:bg-background-raised hover:text-text-bright",
    text: "group-hover:text-text-bright",
    icon: "text-text-dimmed group-hover:text-text-bright",
  },
  primary: {
    trigger:
      "bg-indigo-600 border border-indigo-500 text-text-bright hover:bg-indigo-500 hover:border-indigo-400 disabled:opacity-50 disabled:pointer-events-none",
    text: "text-text-bright hover:text-white",
    icon: "text-text-bright",
  },
  secondary: {
    trigger:
      "bg-secondary border border-border-bright text-text-bright hover:bg-surface-control hover:border-border-brighter disabled:opacity-60 disabled:pointer-events-none",
    text: "text-text-bright",
    icon: "text-text-bright",
  },
  tertiary: {
    trigger: "bg-tertiary text-text-bright hover:bg-surface-control",
    text: "text-text-bright",
    icon: "text-text-bright",
  },
} as const;

export type PopoverArrowTriggerVariant = keyof typeof popoverArrowTriggerVariants;

function PopoverArrowTrigger({
  isOpen,
  children,
  fullWidth = false,
  overflowHidden = false,
  variant = "minimal",
  className,
  ...props
}: {
  isOpen?: boolean;
  fullWidth?: boolean;
  overflowHidden?: boolean;
  variant?: PopoverArrowTriggerVariant;
} & React.ComponentPropsWithoutRef<typeof PopoverTrigger>) {
  const variantStyles = popoverArrowTriggerVariants[variant];

  return (
    <PopoverTrigger
      {...props}
      className={cn(
        "group flex h-6 items-center gap-1 rounded pl-2 pr-1 transition focus-custom",
        variantStyles.trigger,
        fullWidth && "w-full justify-between",
        className
      )}
    >
      <Paragraph
        variant="extra-small"
        className={cn("flex transition", variantStyles.text, overflowHidden && "overflow-hidden")}
      >
        {children}
      </Paragraph>
      <DropdownIcon className={cn("size-4 min-w-4 transition", variantStyles.icon)} />
    </PopoverTrigger>
  );
}

export { Popover, PopoverArrowTrigger, PopoverContent, PopoverTrigger };
