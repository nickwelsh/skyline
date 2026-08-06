type SkylinePrepaintAppearance = {
  theme: "classic" | "system" | "dark" | "light";
  contrast: number;
};

interface Window {
  __skylineUiPreferences: {
    storageKey(basePath: string): string;
    parseAppearance(value: unknown): SkylinePrepaintAppearance;
    prepaint(basePath: string): void;
  };
}
