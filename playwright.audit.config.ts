import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: "audit.spec.ts",
  outputDir: "test-results/audit",
  projects: [
    { name: "audit-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "audit-webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
