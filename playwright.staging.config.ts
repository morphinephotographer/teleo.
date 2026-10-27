import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  outputDir: "test-results/staging",
  testMatch: "staging.spec.ts",
  webServer: process.env.TELEO_STAGING_URL
    ? undefined
    : [
        {
          command: "npm run staging:local",
          url: "http://127.0.0.1:8788",
          reuseExistingServer: true,
        },
      ],
});
