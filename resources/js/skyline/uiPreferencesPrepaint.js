(function installSkylineUiPreferences(scope) {
  const themes = ["classic", "system", "dark", "light"];
  const fallback = { theme: "classic", contrast: 50 };
  const normalizeBasePath = (basePath) => `/${String(basePath).split("/").filter(Boolean).join("/")}`;
  const parseAppearance = (value) => {
    const input = typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
    return {
      theme: themes.includes(input.theme) ? input.theme : fallback.theme,
      contrast: Number.isInteger(input.contrast) && input.contrast >= 0 && input.contrast <= 100 ? input.contrast : fallback.contrast,
    };
  };

  scope.__skylineUiPreferences = Object.freeze({
    storageKey: (basePath) => `skyline.ui-preferences.v1:${normalizeBasePath(basePath)}`,
    parseAppearance,
    prepaint: (basePath) => {
      let appearance = fallback;
      try {
        const stored = JSON.parse(scope.localStorage.getItem(scope.__skylineUiPreferences.storageKey(basePath)) || "null");
        appearance = parseAppearance(stored);
      } catch {}
      const theme = appearance.theme === "system"
        ? (scope.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : appearance.theme;
      scope.document.documentElement.dataset.theme = theme;
      scope.document.documentElement.style.setProperty("--theme-contrast", String(appearance.contrast / 100));
    },
  });
})(window);
