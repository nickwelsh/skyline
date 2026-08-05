import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}{ext}",
  use: {
    baseURL: "http://127.0.0.1:4174",
    colorScheme: "dark",
    locale: "en-US",
    screenshot: "only-on-failure",
    timezoneId: "America/New_York",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node scripts/serve-fixture.mjs",
      reuseExistingServer: true,
      timeout: 30_000,
      url: "http://127.0.0.1:4174/skyline",
    },
    {
      command: "bunx vite tests/browser/trigger-failure-reference --host 127.0.0.1 --port 4175",
      reuseExistingServer: true,
      timeout: 30_000,
      url: "http://127.0.0.1:4175",
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 960 } },
    },
  ],
});
