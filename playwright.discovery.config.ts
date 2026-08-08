import { defineConfig } from "@playwright/test";
import oracle from "./playwright.oracle.config";

export default defineConfig({
  ...oracle,
  testMatch: ["**/framework-extension.discovery.ts", "**/jobs-capability.discovery.ts", "**/presenter-extension.discovery.ts", "**/nw223-presenter-extension.discovery.ts", "**/nw226-shell-extension.discovery.ts", "**/queue-capability.discovery.ts", "**/queue-connection-extension.discovery.ts", "**/queue-recorded-runs-extension.discovery.ts", "**/renderer-rasterization.discovery.ts"],
  reporter: "line",
  timeout: 10 * 60_000,
});
