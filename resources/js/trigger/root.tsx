/*!
 * Derived from Trigger.dev apps/webapp/app/root.tsx and components/layout/AppLayout.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Remix document/server providers are replaced by static-router inputs.
 */
import { Outlet } from "@remix-run/react";
import { AppContainer } from "~/components/layout/AppLayout";
import { FavoritesProvider, type JobFavorite } from "~/components/navigation/JobFavorites";
import { SideMenu, type AppearancePreference, type SideMenuCapabilities, type SideMenuPreferences } from "~/components/navigation/SideMenu";
import type { SidebarCustomizationPayload } from "~/components/navigation/CustomizeSidebarDialog";
import { PanelPersistenceProvider } from "~/components/primitives/Resizable";

type TriggerShellProps = {
  applicationName: string;
  brandMark: React.ReactNode;
  environmentLabel: string;
  capabilities: SideMenuCapabilities;
  preferences: SideMenuPreferences;
  appearance: AppearancePreference;
  favorites: JobFavorite[];
  warning: string | null;
  onFavoritesChange: (favorites: JobFavorite[]) => void;
  onPreferencesChange: (preferences: Partial<SideMenuPreferences>) => void;
  onAppearanceChange: (appearance: Partial<AppearancePreference>) => void;
  onCustomize: (payload: SidebarCustomizationPayload) => void;
  panelPersistence: React.ComponentProps<typeof PanelPersistenceProvider>["port"];
  children?: React.ReactNode;
};

export const TRIGGER_SHELL_CLASS_NAME = "isolate h-screen min-w-[1024px] bg-background-dimmed text-text-dimmed antialiased";

export function TriggerShell({ applicationName, brandMark, environmentLabel, capabilities, preferences, appearance, favorites, warning, onFavoritesChange, onPreferencesChange, onAppearanceChange, onCustomize, panelPersistence, children }: TriggerShellProps) {
  return (
    <PanelPersistenceProvider port={panelPersistence}>
      <FavoritesProvider favorites={favorites} onChange={onFavoritesChange} enabled={capabilities.shell.favorites}>
      <AppContainer className={TRIGGER_SHELL_CLASS_NAME}>
        <div className="grid h-full min-w-0 grid-cols-[auto_1fr] overflow-hidden">
          <SideMenu applicationName={applicationName} brandMark={brandMark} environmentLabel={environmentLabel} capabilities={capabilities} preferences={preferences} appearance={appearance} warning={warning} onPreferencesChange={onPreferencesChange} onAppearanceChange={onAppearanceChange} onCustomize={onCustomize} />
          <main className="min-w-0 overflow-hidden">{children ?? <Outlet />}</main>
        </div>
      </AppContainer>
      </FavoritesProvider>
    </PanelPersistenceProvider>
  );
}
