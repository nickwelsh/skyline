import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/skyline/assets/",
  plugins: [react(), tailwindcss()],
  esbuild: { legalComments: "inline" },
  build: {
    emptyOutDir: true,
    manifest: "manifest.json",
    outDir: "dist",
    rollupOptions: {
      input: "resources/js/app.tsx",
      output: {
        hashCharacters: "hex",
        entryFileNames: "skyline.[hash].js",
        assetFileNames: (assetInfo) =>
          assetInfo.name?.endsWith(".css")
            ? "skyline.[hash].css"
            : "skyline-[name].[hash][extname]",
      },
    },
  },
});
