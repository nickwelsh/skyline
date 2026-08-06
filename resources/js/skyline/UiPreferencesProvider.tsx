import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSystemThemeSync } from "../trigger/hooks/useSystemThemeSync";
import type { UiPreferences, UiPreferencesAdapter } from "./UiPreferencesAdapter";

type UiPreferencesContextValue = {
  preferences: UiPreferences;
  adapter: UiPreferencesAdapter;
  warning: string | null;
};

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(null);

export function UiPreferencesProvider({ adapter, children }: { adapter: UiPreferencesAdapter; children: React.ReactNode }) {
  const [preferences, setPreferences] = useState(() => adapter.read());
  const [warning, setWarning] = useState(() => adapter.getWarning());

  useEffect(() => adapter.subscribe((next) => {
    setPreferences(next);
    setWarning(adapter.getWarning());
  }), [adapter]);

  useSystemThemeSync(preferences.theme);
  useEffect(() => {
    document.documentElement.style.setProperty("--theme-contrast", String(preferences.contrast / 100));
  }, [preferences.contrast]);

  const value = useMemo(() => ({ preferences, adapter, warning }), [preferences, adapter, warning]);
  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences(): UiPreferencesContextValue {
  const value = useContext(UiPreferencesContext);
  if (!value) throw new Error("UiPreferencesProvider is missing.");
  return value;
}
