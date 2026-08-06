/*!
 * Adapted from Trigger.dev apps/webapp/app/components/navigation/SideMenuItem.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Active state remains an injected route decision.
 */
import { Link } from "@remix-run/react";
import { motion } from "framer-motion";
import type { FunctionComponent } from "react";
import { cn } from "~/utils/cn";
import { Icon } from "../primitives/Icon";
import { SimpleTooltip } from "../primitives/Tooltip";

type SideMenuItemProps = {
  name: string;
  to: string;
  icon: FunctionComponent<{ className?: string }>;
  activeIconColor: string;
  active: boolean;
  isCollapsed: boolean;
  "data-action": string;
  "data-skyline-extension"?: string;
};

export function SideMenuItem({ name, to, icon, activeIconColor, active, isCollapsed, "data-action": dataAction, "data-skyline-extension": skylineExtension }: SideMenuItemProps) {
  const link = (
    <Link
      to={to}
      data-action={dataAction}
      data-skyline-extension={skylineExtension}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/menulink flex h-8 items-center gap-2 overflow-hidden rounded pl-1.75 pr-2 focus-custom",
        "w-full",
        active
          ? "bg-tertiary text-text-bright"
          : "text-text-dimmed group-hover/menuitem:bg-background-hover group-hover/menuitem:text-text-bright hover:bg-background-hover hover:text-text-bright",
      )}
    >
      <Icon
        icon={icon}
        className={cn(
          "size-5 shrink-0",
          active ? cn(activeIconColor, "side-menu-active-icon") : "text-text-dimmed",
          !active && "group-hover/menuitem:text-text-bright group-hover/menulink:text-text-bright",
        )}
      />
      <motion.div className="min-w-0 flex-1 overflow-hidden" initial={false} animate={{ width: isCollapsed ? 0 : "auto" }} transition={{ duration: 0.2, ease: "easeOut" }}>
        <div className="flex w-full min-w-0 items-center justify-between" style={{ opacity: "var(--sm-label-opacity, 1)" }}>
          <span className="overflow-hidden whitespace-nowrap min-w-0 flex-1 select-none text-left text-[0.90625rem] font-medium tracking-[-0.01em]">{name}</span>
        </div>
      </motion.div>
    </Link>
  );

  return (
    <SimpleTooltip
      button={link}
      content={name}
      side="right"
      sideOffset={8}
      buttonClassName="h-8! block w-full"
      hidden={!isCollapsed}
      asChild
      tabbable
      disableHoverableContent
    />
  );
}
