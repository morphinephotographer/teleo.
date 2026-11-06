import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "quick-send-feedback.spec.ts",
  outputDir: "test-results/quick-send-feedback",
  workers: 1,
  timeout: 45000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.TELEO_QUICK_SEND_URL || "http://127.0.0.1:8796",
    trace: "retain-on-failure",
  },
  webServer: process.env.TELEO_QUICK_SEND_URL
    ? undefined
    : {
        command:
          "npx wrangler dev --config services/production/wrangler.local.jsonc --port 8796 --inspector-port 9246 --var APP_ORIGIN:http://127.0.0.1:8796 --persist-to .wrangler/quick-send-feedback",
        url: "http://127.0.0.1:8796",
        reuseExistingServer: false,
      },
});
