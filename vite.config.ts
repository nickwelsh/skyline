import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/skyline/assets/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: "@remix-run/react",
        replacement: fileURLToPath(new URL("./resources/js/skyline/remix-react.ts", import.meta.url)),
      },
      {
        find: "remix-typedjson",
        replacement: fileURLToPath(new URL("./resources/js/skyline/remix-typedjson.ts", import.meta.url)),
      },
      {
        find: "~",
        replacement: fileURLToPath(new URL("./resources/js/trigger", import.meta.url)),
      },
    ],
  },
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
