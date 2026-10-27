import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: "full-audit.spec.ts",
  outputDir: "test-results/full-audit",
  workers: 1,
  use: {
    ...base.use,
    baseURL: process.env.TELEO_AUDIT_URL || base.use?.baseURL,
    serviceWorkers: "block",
  },
  webServer: process.env.TELEO_AUDIT_URL ? undefined : base.webServer,
  projects: [
    { name: "full-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "full-webkit", use: { ...devices["Desktop Safari"] } },
    { name: "full-firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});
