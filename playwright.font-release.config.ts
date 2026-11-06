import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "font-size-release.spec.ts",
  outputDir: "test-results/font-release",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: process.env.TELEO_FONT_URL || "http://127.0.0.1:8789",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "ipad",
      use: { ...devices["iPad (gen 7)"], defaultBrowserType: "webkit" },
    },
    {
      name: "iphone",
      use: { ...devices["iPhone 13"], defaultBrowserType: "webkit" },
    },
  ],
});
