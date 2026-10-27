import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: ["approved.spec.ts", "audit.spec.ts"],
  outputDir: "test-results/approved",
  projects: [
    { name: "approved-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "approved-webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
