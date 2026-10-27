import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: "welcome.spec.ts",
  outputDir: "test-results/welcome",
  use: {
    ...base.use,
    baseURL: process.env.TELEO_WELCOME_URL || base.use?.baseURL,
  },
  webServer: process.env.TELEO_WELCOME_URL ? undefined : base.webServer,
  projects: [
    { name: "welcome-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "welcome-webkit", use: { ...devices["iPhone 13"] } },
  ],
});
