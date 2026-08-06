import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/fidelity",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4184",
    colorScheme: "light",
    deviceScaleFactor: 1,
    locale: "en-US",
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    timezoneId: "UTC",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "SKYLINE_PORT=4184 node scripts/serve-fixture.mjs",
      reuseExistingServer: false,
      timeout: 30_000,
      url: "http://127.0.0.1:4184/skyline",
    },
    {
      command: "pnpm exec vite preview --config tests/fidelity/reference/vite.config.ts --host 127.0.0.1 --port 4185 --strictPort",
      reuseExistingServer: false,
      timeout: 30_000,
      url: "http://127.0.0.1:4185/oracle/runs-populated",
    },
  ],
  projects: [{ name: "chromium", use: { viewport: { width: 1440, height: 960 } } }],
});
