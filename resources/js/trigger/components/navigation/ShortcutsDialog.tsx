/*!
 * Adapted from Trigger.dev apps/webapp/app/components/Shortcuts.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Narrowed to shortcuts supported by the external Skyline shell.
 */
import { KeyboardIcon } from "~/assets/icons/KeyboardIcon";
import { Header3 } from "../primitives/Headers";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../primitives/SheetV3";
import { ShortcutKey } from "../primitives/ShortcutKey";

export type ShortcutCapabilities = {
  sidebar: boolean;
  favorites: boolean;
  pagination: boolean;
  runs: boolean;
};

export function ShortcutsDialog({ open, onOpenChange, returnFocus, capabilities }: { open: boolean; onOpenChange: (open: boolean) => void; returnFocus?: HTMLButtonElement | null; capabilities: ShortcutCapabilities }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent onCloseAutoFocus={(event) => { if (!returnFocus) return; event.preventDefault(); returnFocus.focus(); }}>
        <SheetHeader>
          <SheetTitle>
            <span className="flex items-center gap-x-2 font-sans text-base font-medium text-text-bright">
              <KeyboardIcon className="size-5 text-text-bright" />
              Keyboard shortcuts
            </span>
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-4 pt-2">
          <ShortcutSection title="General">
            <ShortcutRow name="Close"><Key name="esc" /></ShortcutRow>
            {capabilities.sidebar && <ShortcutRow name="Toggle side menu"><Key name="b" modifiers={["mod"]} /></ShortcutRow>}
            {capabilities.favorites && <ShortcutRow name="Favorite this page"><Key name="f" modifiers={["alt"]} /></ShortcutRow>}
            {capabilities.pagination && <><ShortcutRow name="Previous page"><Key name="j" /></ShortcutRow><ShortcutRow name="Next page"><Key name="k" /></ShortcutRow></>}
          </ShortcutSection>
          {capabilities.runs && (
            <ShortcutSection title="Run page">
              <ShortcutRow name="Navigate trace"><Key name="arrowup" /><Key name="arrowdown" /><Key name="arrowleft" /><Key name="arrowright" /></ShortcutRow>
              <ShortcutRow name="Previous run"><Key name="j" /></ShortcutRow>
              <ShortcutRow name="Next run"><Key name="k" /></ShortcutRow>
              <ShortcutRow name="Parent run"><Key name="p" /></ShortcutRow>
              <ShortcutRow name="Root run"><Key name="t" /></ShortcutRow>
              <ShortcutRow name="Expand all"><Key name="e" /></ShortcutRow>
              <ShortcutRow name="Collapse all"><Key name="w" /></ShortcutRow>
              <ShortcutRow name="Toggle depth"><Key name="0" /><span className="ml-1 text-xs text-text-dimmed">to</span><Key name="9" /></ShortcutRow>
              <ShortcutRow name="Overview"><Key name="o" /></ShortcutRow>
              <ShortcutRow name="Detail"><Key name="d" /></ShortcutRow>
              <ShortcutRow name="Context"><Key name="x" /></ShortcutRow>
              <ShortcutRow name="Metadata"><Key name="m" /></ShortcutRow>
              <ShortcutRow name="Queue time"><Key name="q" /></ShortcutRow>
            </ShortcutSection>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ShortcutSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-3"><Header3>{title}</Header3>{children}</section>;
}

function ShortcutRow({ name, children }: { name: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-2"><span className="text-sm text-text-dimmed">{name}</span><span className="flex gap-0.5">{children}</span></div>;
}

function Key({ name, modifiers }: { name: string; modifiers?: Array<"alt" | "mod"> }) {
  return <ShortcutKey shortcut={{ key: name, modifiers }} variant="medium/bright" />;
}
