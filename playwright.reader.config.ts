import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: "reader-v12.spec.ts",
  outputDir: "test-results/reader-v12",
  workers: 1,
  projects: [
    { name: "reader-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "reader-webkit", use: { ...devices["Desktop Safari"] } },
    { name: "reader-firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});
