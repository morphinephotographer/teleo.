import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: "v07.spec.ts",
  outputDir: "test-results/v07",
  webServer: process.env.TELEO_V07_URL ? undefined : base.webServer,
  projects: [
    { name: "v07-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "v07-webkit", use: { ...devices["Desktop Safari"] } },
    { name: "v07-firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});
