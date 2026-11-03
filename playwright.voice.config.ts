import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: [
    "voice-follow.spec.ts",
    "reader-keys.spec.ts",
    "ui-alignment.spec.ts",
    "editor-tools.spec.ts",
    "intro.spec.ts",
    "import-docx.spec.ts",
    "voice-ipad.spec.ts",
    "topbar.spec.ts",
    "tour.spec.ts",
  ],
  outputDir: "test-results/voice-follow",
  workers: 1,
  use: {
    ...base.use,
    // Optional override when the installed browser revision differs.
    launchOptions: process.env.TELEO_CHROMIUM
      ? { executablePath: process.env.TELEO_CHROMIUM }
      : undefined,
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
  projects: [
    { name: "voice-chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "voice-phone",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    // Safari's engine (needs `npx playwright install webkit`, e.g. on a Mac).
    { name: "voice-safari", use: { ...devices["Desktop Safari"] } },
    { name: "voice-iphone-safari", use: { ...devices["iPhone 13"] } },
  ],
});
