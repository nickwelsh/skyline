import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { transformWithEsbuild, type Plugin } from "vite";

export function pinnedShell(appRoot: string): Plugin {
  const shortcutsId = "virtual:pinned-trigger-shell";
  const shortcutsResolvedId = `\0${shortcutsId}.tsx`;
  const sectionId = "virtual:pinned-trigger-side-menu-section";
  const sectionResolvedId = `${resolve(appRoot, "components/navigation/SideMenuSection.tsx")}?pinned-shell`;
  const customizeId = "virtual:pinned-trigger-customize-sidebar";
  const customizeResolvedId = `${resolve(appRoot, "components/navigation/CustomizeSidebarDialog.tsx")}?pinned-shell`;

  return {
    name: "pinned-trigger-shell",
    resolveId(id) {
      if (id === shortcutsId) return shortcutsResolvedId;
      if (id === sectionId) return sectionResolvedId;
      if (id === customizeId) return customizeResolvedId;
      return undefined;
    },
    async load(id) {
      if (id === sectionResolvedId) return readFileSync(resolve(appRoot, "components/navigation/SideMenuSection.tsx"), "utf8");
      if (id === customizeResolvedId) return readFileSync(resolve(appRoot, "components/navigation/CustomizeSidebarDialog.tsx"), "utf8");
      if (id !== shortcutsResolvedId) return undefined;
      const shortcuts = readFileSync(resolve(appRoot, "components/Shortcuts.tsx"), "utf8");
      const content = shortcuts.slice(shortcuts.indexOf("function ShortcutContent()"));
      if (!content.startsWith("function ShortcutContent()")) throw new Error("Pinned Trigger shortcut content could not be extracted.");

      const module = `
import type { ReactNode } from "react";
import { KeyboardIcon } from ${JSON.stringify(resolve(appRoot, "assets/icons/KeyboardIcon.tsx"))};
import { Header3 } from ${JSON.stringify(resolve(appRoot, "components/primitives/Headers.tsx"))};
import { Paragraph } from ${JSON.stringify(resolve(appRoot, "components/primitives/Paragraph.tsx"))};
import { ShortcutKey } from ${JSON.stringify(resolve(appRoot, "components/primitives/ShortcutKey.tsx"))};
const SheetContent = ({ children }: { children: ReactNode }) => <div role="dialog" aria-label="Keyboard shortcuts" className="fixed bottom-4 right-4 h-[80vh] w-[430px] overflow-y-auto border border-grid-bright bg-background-bright">{children}</div>;
const SheetHeader = ({ children }: { children: ReactNode }) => <div>{children}</div>;
const SheetTitle = ({ children }: { children: ReactNode }) => <div>{children}</div>;
${content}
export function PinnedTriggerShortcuts({ open }: { open: boolean }) { return open ? <ShortcutContent /> : null; }
`;
      return (await transformWithEsbuild(module, "PinnedTriggerShell.tsx", { loader: "tsx", jsx: "automatic" })).code;
    },
  };
}
