import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@remix-run/react", replacement: fileURLToPath(new URL("./resources/js/skyline/remix-react.ts", import.meta.url)) },
      { find: "remix-typedjson", replacement: fileURLToPath(new URL("./resources/js/skyline/remix-typedjson.ts", import.meta.url)) },
      { find: "~", replacement: fileURLToPath(new URL("./resources/js/trigger", import.meta.url)) },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["resources/js/**/*.test.ts", "resources/js/**/*.test.tsx", "tests/fidelity/**/*.test.ts"],
  },
});
