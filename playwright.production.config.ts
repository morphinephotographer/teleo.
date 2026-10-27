import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
const prefix = process.env.TELEO_PRODUCTION_URL ? "live" : "production";
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: ["production.spec.ts", "v061.spec.ts"],
  outputDir: "test-results/production",
  use: {
    ...base.use,
    baseURL: process.env.TELEO_PRODUCTION_URL || "http://127.0.0.1:8789",
  },
  projects: [
    { name: `${prefix}-chromium`, use: { ...devices["Desktop Chrome"] } },
    { name: `${prefix}-webkit`, use: { ...devices["Desktop Safari"] } },
    { name: `${prefix}-iphone`, use: { ...devices["iPhone 13"] } },
    { name: `${prefix}-ipad`, use: { ...devices["iPad (gen 7)"] } },
  ],
  webServer: process.env.TELEO_PRODUCTION_URL
    ? undefined
    : {
        command: "npm run production:local",
        url: "http://127.0.0.1:8789",
        reuseExistingServer: true,
      },
});
