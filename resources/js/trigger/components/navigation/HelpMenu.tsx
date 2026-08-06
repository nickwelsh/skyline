/*!
 * Adapted from Trigger.dev apps/webapp/app/components/navigation/HelpAndFeedbackPopover.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server-backed help actions remain dormant behind explicit capabilities.
 */
import { DropdownIcon } from "~/assets/icons/DropdownIcon";
import { KeyboardIcon } from "~/assets/icons/KeyboardIcon";
import { QuestionMarkIcon } from "~/assets/icons/QuestionMarkIcon";
import { cn } from "~/utils/cn";
import { useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/Popover";
import { ShortcutKey } from "../primitives/ShortcutKey";

export type HelpCapabilities = {
  menu: boolean;
  shortcuts: boolean;
  askAi: boolean;
  documentation: boolean;
  status: boolean;
  suggestFeature: boolean;
  contact: boolean;
  changelog: boolean;
};

export function HelpMenu({ collapsed, capabilities, shortcutsOpen, onOpenShortcuts, labelOpacity }: { collapsed: boolean; capabilities: HelpCapabilities; shortcutsOpen: boolean; onOpenShortcuts: (returnFocus: HTMLButtonElement) => void; labelOpacity: number }) {
  const [open, setOpen] = useState(false);
  const preserveOpenRef = useRef(false);
  return <div className={collapsed ? undefined : "min-w-0 flex-1"}><Popover open={open} onOpenChange={(next) => { if (!next && preserveOpenRef.current) return; setOpen(next); }}><PopoverTrigger onPointerDown={() => { if (open && !shortcutsOpen) preserveOpenRef.current = false; }} className={cn("group flex h-8 items-center gap-1.5 rounded pl-1.75 pr-2 hover:bg-background-hover focus-custom", collapsed ? "w-full" : "w-full justify-between")}>
    <span className="flex min-w-0 items-center gap-1.5 overflow-hidden"><QuestionMarkIcon className="size-5 min-w-5 shrink-0 text-success" /><span className="min-w-0 overflow-hidden whitespace-nowrap text-[0.90625rem] font-medium tracking-[-0.01em] text-text-dimmed group-hover:text-text-bright" style={{ maxWidth: "calc(var(--sm-label-opacity, 1) * 150px)", opacity: labelOpacity }}>Help &amp; Feedback</span></span>
    {!collapsed && <span className="overflow-hidden opacity-0 group-hover:opacity-100" style={{ maxWidth: "calc(var(--sm-label-opacity, 1) * 16px)" }}><DropdownIcon className="size-4 min-w-4 text-text-dimmed group-hover:text-text-bright" /></span>}
  </PopoverTrigger><PopoverContent side={collapsed ? "right" : "top"} align="start" onPointerDownOutside={() => { preserveOpenRef.current = false; }} onEscapeKeyDown={() => { if (!shortcutsOpen) preserveOpenRef.current = false; }} className="min-w-56 p-1">
    {capabilities.askAi && <HelpButton name="Ask AI" />}
    {capabilities.documentation && <HelpLink name="Documentation" href="https://trigger.dev/docs" />}
    {capabilities.status && <HelpLink name="Status" href="https://status.trigger.dev" />}
    {capabilities.suggestFeature && <HelpLink name="Suggest a feature" href="https://feedback.trigger.dev" />}
    {capabilities.shortcuts && <button type="button" data-action="shortcuts" onClick={(event) => { preserveOpenRef.current = true; onOpenShortcuts(event.currentTarget); }} className="flex h-8 w-full items-center gap-2 rounded px-2 text-left hover:bg-background-hover focus-custom"><KeyboardIcon className="size-5 text-text-dimmed" /><span className="flex-1">Shortcuts</span><ShortcutKey shortcut={{ modifiers: ["shift"], key: "?" }} variant="medium" /></button>}
    {capabilities.contact && <HelpButton name="Contact us…" />}
    {capabilities.changelog && <HelpButton name="Changelog" />}
  </PopoverContent></Popover></div>;
}

function HelpButton({ name }: { name: string }) {
  return <button type="button" className="flex h-8 w-full items-center rounded px-2 text-left hover:bg-background-hover focus-custom">{name}</button>;
}

function HelpLink({ name, href }: { name: string; href: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="flex h-8 items-center rounded px-2 hover:bg-background-hover focus-custom">{name}</a>;
}
