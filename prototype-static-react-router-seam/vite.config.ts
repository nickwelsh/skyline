import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@remix-run/react",
        replacement: fileURLToPath(new URL("./src/compat/remix-react.ts", import.meta.url)),
      },
      {
        find: "~",
        replacement: fileURLToPath(new URL("./src/compat/app", import.meta.url)),
      },
    ],
  },
});
