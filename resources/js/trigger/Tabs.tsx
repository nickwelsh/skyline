/*!
 * Derived from Trigger.dev apps/webapp/app/components/primitives/Tabs.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Modified for Skyline: button-only tabs, local shortcuts, and no Remix dependency.
 */
import { motion } from "framer-motion";
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export function TabContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div role="tablist" className={`flex gap-x-6 overflow-x-auto border-b border-grid-bright ${className}`}>{children}</div>;
}

export function TabButton({
  active,
  layoutId,
  shortcut,
  children,
  className = "",
  ...props
}: {
  active: boolean;
  layoutId: string;
  shortcut?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!shortcut || props.disabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || isEditable(event.target)) return;
      if (event.key.toLowerCase() !== shortcut.toLowerCase()) return;
      event.preventDefault();
      ref.current?.click();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props.disabled, shortcut]);

  return (
    <button
      {...props}
      ref={ref}
      type="button"
      role="tab"
      aria-selected={active}
      className={`group flex h-10 shrink-0 flex-col items-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 ${className}`}
    >
      <span className="flex flex-1 items-center gap-1 text-sm">
        <span className={active ? "text-text-bright" : "text-text-dimmed group-hover:text-text-bright"}>{children}</span>
        {shortcut && <kbd className="rounded-sm border border-border-bright px-1 font-mono text-xxs text-text-faint">{shortcut.toUpperCase()}</kbd>}
      </span>
      {active ? (
        <motion.span
          layoutId={layoutId}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="h-0.5 w-full bg-indigo-500"
        />
      ) : (
        <span className="h-0.5 w-full bg-surface-control-active opacity-0 group-hover:opacity-100" />
      )}
    </button>
  );
}

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));
}
