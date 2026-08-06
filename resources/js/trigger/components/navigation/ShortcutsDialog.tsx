/*!
 * Adapted from Trigger.dev apps/webapp/app/components/Shortcuts.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Narrowed to shortcuts supported by the external Skyline shell.
 */
import { KeyboardIcon } from "~/assets/icons/KeyboardIcon";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../primitives/Dialog";
import { ShortcutKey } from "../primitives/ShortcutKey";

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-md p-4"><DialogHeader className="h-7"><DialogTitle className="flex items-center gap-2"><KeyboardIcon className="size-5" />Keyboard shortcuts</DialogTitle></DialogHeader><div className="mt-5 space-y-3"><ShortcutRow name="Close"><ShortcutKey shortcut={{ key: "esc" }} variant="medium/bright" /></ShortcutRow><ShortcutRow name="Toggle side menu"><ShortcutKey shortcut={{ modifiers: ["mod"], key: "b" }} variant="medium/bright" /></ShortcutRow></div></DialogContent></Dialog>;
}

function ShortcutRow({ name, children }: { name: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-2"><span className="text-sm text-text-dimmed">{name}</span><span className="flex gap-0.5">{children}</span></div>;
}
