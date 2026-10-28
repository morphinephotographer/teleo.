import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "approval-v3.spec.ts",
  workers: 1,
  timeout: 45000,
  outputDir: "test-results/approval-v3",
  use: {
    baseURL: "http://127.0.0.1:5173",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    reducedMotion: "reduce",
  },
  projects: [
    { name: "approval-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "approval-webkit", use: { ...devices["Desktop Safari"] } },
    { name: "approval-firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: [
    {
      command: "npm run dev",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
    },
    {
      command: "npm run relay",
      url: "http://127.0.0.1:8787",
      reuseExistingServer: true,
    },
  ],
});
