import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "quick-send.spec.ts",
  outputDir: "test-results/quick-send",
  timeout: 60000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  projects: [
    {
      name: "android-chrome",
      use: { ...devices["Pixel 7"], browserName: "chromium" },
    },
    {
      name: "iphone-safari",
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
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
