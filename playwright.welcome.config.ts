import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: "welcome.spec.ts",
  outputDir: "test-results/welcome",
  projects: [
    { name: "welcome-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "welcome-webkit", use: { ...devices["iPhone 13"] } },
  ],
});
