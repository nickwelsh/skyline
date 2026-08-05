/*!
 * Adapted from Trigger.dev apps/webapp/app/components/primitives/CopyableText.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: local imports and a native minimal button replace the Buttons dependency.
 */
import { ClipboardCheckIcon, ClipboardIcon } from "lucide-react";
import { useState } from "react";
import { SimpleTooltip } from "./Tooltip";
import { useCopy } from "../../hooks/useCopy";
import { cn } from "../../utils/cn";

export function CopyableText({
  value,
  copyValue,
  className,
  asChild,
  variant,
  hideTooltip,
}: {
  value: string;
  copyValue?: string;
  className?: string;
  asChild?: boolean;
  variant?: "icon-right" | "text-below";
  /**
   * Hide the "Copy"/"Copied" hint tooltip. Use when this is rendered inside another
   * Radix tooltip (e.g. the admin debug panel): the nested tooltip would otherwise
   * fire Radix's global "one tooltip open at a time" close and dismiss the parent.
   */
  hideTooltip?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const { copy, copied } = useCopy(copyValue ?? value);

  const resolvedVariant = variant ?? "icon-right";

  if (resolvedVariant === "icon-right") {
    const iconButton = (
      <span
        className={cn(
          "ml-1 flex size-6 items-center justify-center rounded border border-border-bright bg-background-hover",
          asChild && "p-1",
          copied
            ? "text-green-500"
            : "text-text-dimmed hover:border-border-bright hover:bg-background-raised hover:text-text-bright"
        )}
      >
        {copied ? (
          <ClipboardCheckIcon className="size-3.5" />
        ) : (
          <ClipboardIcon className="size-3.5" />
        )}
      </span>
    );

    return (
      <span
        className={cn("group relative inline-flex h-6 items-center", className)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span onMouseEnter={() => setIsHovered(true)}>{value}</span>
        <span
          onClick={copy}
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            "absolute -right-6 top-0 z-10 size-6 font-sans",
            isHovered ? "flex" : "hidden"
          )}
        >
          {hideTooltip ? (
            iconButton
          ) : (
            <SimpleTooltip
              button={iconButton}
              content={copied ? "Copied!" : "Copy"}
              className="font-sans"
              disableHoverableContent
              asChild={asChild}
            />
          )}
        </span>
      </span>
    );
  }

  if (resolvedVariant === "text-below") {
    return (
      <SimpleTooltip
        button={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              copy();
            }}
            className={cn(
              "group/button flex h-6 w-fit cursor-pointer select-none items-center justify-center rounded-[3px] bg-transparent px-1 py-0 text-left font-sans text-xs font-normal text-text-dimmed transition duration-150 outline-hidden focus-custom hover:bg-transparent",
              className
            )}
          >
            <span className="transition-colors group-hover/button:text-text-bright">{value}</span>
          </button>
        }
        content={copied ? "Copied" : "Copy"}
        className="px-2 py-1 font-sans"
        disableHoverableContent
        open={isHovered || copied}
        onOpenChange={setIsHovered}
        asChild
      />
    );
  }

  return null;
}
