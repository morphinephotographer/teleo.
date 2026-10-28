import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: ["r400.spec.ts", "remote-permissions.spec.ts"],
  outputDir: "test-results/r400",
  workers: 1,
  use: {
    ...base.use,
    baseURL: process.env.TELEO_R400_URL || base.use?.baseURL,
    serviceWorkers: "block",
  },
  webServer: process.env.TELEO_R400_URL ? undefined : base.webServer,
  projects: [
    { name: "r400-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "r400-webkit", use: { ...devices["Desktop Safari"] } },
    { name: "r400-firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});
