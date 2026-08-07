/*!
 * Adapted from Trigger.dev apps/webapp/app/components/Shortcuts.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Narrowed to shortcuts supported by the external Skyline shell.
 */
import { KeyboardIcon } from "~/assets/icons/KeyboardIcon";
import { Header3 } from "../primitives/Headers";
import { Paragraph } from "../primitives/Paragraph";
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
            <div className="flex items-center gap-x-2">
              <KeyboardIcon className="size-5 text-text-bright" />
              <span className="font-sans text-base font-medium text-text-bright">
                Keyboard shortcuts
              </span>
            </div>
          </SheetTitle>
          <div className="space-y-6 px-4 pb-4 pt-2">
            <div className="space-y-3">
              <Header3>General</Header3>
              <Shortcut name="Close">
                <ShortcutKey shortcut={{ key: "esc" }} variant="medium/bright" />
              </Shortcut>
              {capabilities.sidebar && (
                <Shortcut name="Toggle side menu">
                  <ShortcutKey shortcut={{ modifiers: ["mod"] }} variant="medium/bright" />
                  <ShortcutKey shortcut={{ key: "b" }} variant="medium/bright" />
                </Shortcut>
              )}
              {capabilities.favorites && (
                <Shortcut name="Favorite this page">
                  <ShortcutKey shortcut={{ modifiers: ["alt"] }} variant="medium/bright" />
                  <ShortcutKey shortcut={{ key: "f" }} variant="medium/bright" />
                </Shortcut>
              )}
              {capabilities.pagination && (
                <>
                  <Shortcut name="Previous page">
                    <ShortcutKey shortcut={{ key: "j" }} variant="medium/bright" />
                  </Shortcut>
                  <Shortcut name="Next page">
                    <ShortcutKey shortcut={{ key: "k" }} variant="medium/bright" />
                  </Shortcut>
                </>
              )}
            </div>
            {capabilities.runs && (
              <div className="space-y-3">
                <Header3>Run page</Header3>
                <Shortcut name="Overview">
                  <ShortcutKey shortcut={{ key: "o" }} variant="medium/bright" />
                </Shortcut>
                <Shortcut name="Details">
                  <ShortcutKey shortcut={{ key: "d" }} variant="medium/bright" />
                </Shortcut>
                <Shortcut name="Context">
                  <ShortcutKey shortcut={{ key: "x" }} variant="medium/bright" />
                </Shortcut>
                <Shortcut name="Metadata">
                  <ShortcutKey shortcut={{ key: "m" }} variant="medium/bright" />
                </Shortcut>
                <Shortcut name="Navigate">
                  <ShortcutKey shortcut={{ key: "arrowup" }} variant="medium/bright" />
                  <ShortcutKey shortcut={{ key: "arrowdown" }} variant="medium/bright" />
                  <ShortcutKey shortcut={{ key: "arrowleft" }} variant="medium/bright" />
                  <ShortcutKey shortcut={{ key: "arrowright" }} variant="medium/bright" />
                </Shortcut>
                <Shortcut name="Jump to next/previous run">
                  <ShortcutKey shortcut={{ key: "j" }} variant="medium/bright" />
                  <ShortcutKey shortcut={{ key: "k" }} variant="medium/bright" />
                </Shortcut>
                <Shortcut name="Expand all">
                  <ShortcutKey shortcut={{ key: "e" }} variant="medium/bright" />
                </Shortcut>
                <Shortcut name="Collapse all">
                  <ShortcutKey shortcut={{ key: "w" }} variant="medium/bright" />
                </Shortcut>
                <Shortcut name="Toggle level">
                  <ShortcutKey shortcut={{ key: "0" }} variant="medium/bright" />
                  <Paragraph variant="small" className="ml-1.5">
                    to
                  </Paragraph>
                  <ShortcutKey shortcut={{ key: "9" }} variant="medium/bright" />
                </Shortcut>
                <Shortcut name="Jump to root run">
                  <ShortcutKey shortcut={{ key: "t" }} variant="medium/bright" />
                </Shortcut>
                <Shortcut name="Jump to parent run">
                  <ShortcutKey shortcut={{ key: "p" }} variant="medium/bright" />
                </Shortcut>
              </div>
            )}
          </div>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
}

function Shortcut({ children, name }: { children: React.ReactNode; name: string }) {
  return (
    <div className="flex items-center justify-between gap-x-2">
      <span className="text-sm text-text-dimmed">{name}</span>
      <span className="flex items-center gap-x-0.5">{children}</span>
    </div>
  );
}
