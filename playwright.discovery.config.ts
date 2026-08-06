import { defineConfig } from "@playwright/test";
import oracle from "./playwright.oracle.config";

export default defineConfig({
  ...oracle,
  testMatch: ["**/framework-extension.discovery.ts", "**/presenter-extension.discovery.ts", "**/nw223-presenter-extension.discovery.ts", "**/queue-capability.discovery.ts"],
  reporter: "line",
  timeout: 10 * 60_000,
});
