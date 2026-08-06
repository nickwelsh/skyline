/*!
 * Adapted from Trigger.dev apps/webapp/app/components/navigation/HelpAndFeedbackPopover.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server-backed help actions remain dormant behind explicit capabilities.
 */
import { QuestionMarkCircleIcon } from "@heroicons/react/20/solid";
import { KeyboardIcon } from "~/assets/icons/KeyboardIcon";
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
  return <Popover open={open} onOpenChange={(next) => { if (!next && preserveOpenRef.current) return; setOpen(next); }}><PopoverTrigger onPointerDown={() => { if (open && !shortcutsOpen) preserveOpenRef.current = false; }} className={cn("flex h-8 items-center gap-1.5 rounded pl-1.75 pr-2 text-text-dimmed hover:bg-background-hover hover:text-text-bright focus-custom", collapsed ? "w-8" : "min-w-0 flex-1")}>
    <QuestionMarkCircleIcon className="size-5 min-w-5 text-success" /><span className="truncate text-[0.90625rem] font-medium" style={{ opacity: labelOpacity }}>Help &amp; Feedback</span>
  </PopoverTrigger><PopoverContent side={collapsed ? "right" : "top"} align="start" onPointerDownOutside={() => { preserveOpenRef.current = false; }} onEscapeKeyDown={() => { if (!shortcutsOpen) preserveOpenRef.current = false; }} className="min-w-56 p-1">
    {capabilities.askAi && <HelpButton name="Ask AI" />}
    {capabilities.documentation && <HelpLink name="Documentation" href="https://trigger.dev/docs" />}
    {capabilities.status && <HelpLink name="Status" href="https://status.trigger.dev" />}
    {capabilities.suggestFeature && <HelpLink name="Suggest a feature" href="https://feedback.trigger.dev" />}
    {capabilities.shortcuts && <button type="button" data-action="shortcuts" onClick={(event) => { preserveOpenRef.current = true; onOpenShortcuts(event.currentTarget); }} className="flex h-8 w-full items-center gap-2 rounded px-2 text-left hover:bg-background-hover focus-custom"><KeyboardIcon className="size-5 text-text-dimmed" /><span className="flex-1">Shortcuts</span><ShortcutKey shortcut={{ modifiers: ["shift"], key: "?" }} variant="medium" /></button>}
    {capabilities.contact && <HelpButton name="Contact us…" />}
    {capabilities.changelog && <HelpButton name="Changelog" />}
  </PopoverContent></Popover>;
}

function HelpButton({ name }: { name: string }) {
  return <button type="button" className="flex h-8 w-full items-center rounded px-2 text-left hover:bg-background-hover focus-custom">{name}</button>;
}

function HelpLink({ name, href }: { name: string; href: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="flex h-8 items-center rounded px-2 hover:bg-background-hover focus-custom">{name}</a>;
}
