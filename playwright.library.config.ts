import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "library-panel.spec.ts",
  outputDir: "test-results/library",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: process.env.TELEO_LIBRARY_URL || "http://127.0.0.1:5173",
    serviceWorkers: "block",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: process.env.TELEO_LIBRARY_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: true,
      },
});
